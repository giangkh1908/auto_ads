import dotenv from "dotenv";
import pLimit from "p-limit";
import { connectDB } from "../config/db.js";
import AdsAccount from "../models/ads/adsAccount.model.js";
import SyncMeta from "../models/ads/syncMeta.model.js";
import "../models/user.model.js";
import { startBackfill } from "../services/backfillService.js";
import { fetchAccountInsights, saveInsightsToAdPerformance } from "../services/fbAdsService.js";

dotenv.config();

function normalizeAccountPair(accountId) {
  const hasPrefix = String(accountId).startsWith("act_");
  const withPrefix = hasPrefix ? String(accountId) : `act_${accountId}`;
  const withoutPrefix = hasPrefix ? String(accountId).substring(4) : String(accountId);
  return { withPrefix, withoutPrefix };
}

function getDateString(date) {
  return date.toISOString().slice(0, 10);
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveAccountByExternalId(externalAccountId) {
  const { withPrefix, withoutPrefix } = normalizeAccountPair(externalAccountId);

  const account = await AdsAccount.findOne({
    external_id: { $in: [withPrefix, withoutPrefix] },
    status: "ACTIVE",
  });

  if (!account) {
    throw new Error(`AdsAccount not found for external_id=${externalAccountId}`);
  }

  return account;
}

async function hasPendingOrInProgressChunks(accountId, createdAfter = null) {
  const filter = {
    account_id: accountId,
    sync_type: "backfill",
    status: { $in: ["pending", "in_progress"] },
  };

  if (createdAfter) {
    filter.createdAt = { $gte: createdAfter };
  }

  const count = await SyncMeta.countDocuments(filter);
  return count > 0;
}

async function backfillSingleAccountTwoYears(externalAccountId) {
  console.log(`\n🚀 Starting 2-year backfill for account ${externalAccountId}`);

  const account = await resolveAccountByExternalId(externalAccountId);
  console.log(`✅ Resolved AdsAccount: _id=${account._id}, external_id=${account.external_id}`);

  const today = new Date();
  const endDate = getDateString(today);

  const start = new Date(today);
  start.setFullYear(start.getFullYear() - 2);
  const startDate = getDateString(start);

  console.log(`📅 Backfill range: ${startDate} → ${endDate}`);

  console.log("🧹 Clearing existing pending/in_progress backfill chunks for this account...");
  await SyncMeta.updateMany(
    {
      account_id: account._id,
      sync_type: "backfill",
      status: { $in: ["pending", "in_progress"] },
    },
    {
      $set: {
        status: "failed",
        error: "superseded by backfillSingleAccountTwoYears",
        completed_at: new Date(),
      },
    }
  );

  const runStartedAt = new Date();

  console.log("🧩 Creating 7-day backfill chunks via startBackfill...");
  await startBackfill(account._id.toString(), startDate, endDate);

  const totalChunks = await SyncMeta.countDocuments({
    account_id: account._id,
    sync_type: "backfill",
    createdAt: { $gte: runStartedAt },
  });
  console.log(`📊 Total chunks created: ${totalChunks}`);

  const requestedConcurrency = parseInt(process.env.BACKFILL_CONCURRENCY) || 3;
  const CONCURRENCY = Math.min(Math.max(requestedConcurrency, 1), 5);
  if (CONCURRENCY !== requestedConcurrency) {
    console.log(
      `⚠️  Requested ${requestedConcurrency} workers, capping at ${CONCURRENCY} to avoid rate limits`
    );
  }
  console.log(`⚡ Processing with ${CONCURRENCY} concurrent workers\n`);

  const limit = pLimit(CONCURRENCY);
  let processedChunks = 0;
  let lastProgress = 0;
  let lastProgressTime = Date.now();

  const processChunk = async () => {
    const chunk = await SyncMeta.findOneAndUpdate(
      { 
        account_id: account._id,
        sync_type: "backfill", 
        status: "pending",
        createdAt: { $gte: runStartedAt },
      },
      {
        $set: {
          status: "in_progress",
          started_at: new Date(),
        },
      },
      { sort: { createdAt: 1 }, new: true }
    );

    if (!chunk) {
      return null;
    }

    try {
      const accountDoc = await AdsAccount.findById(chunk.account_id).populate({
        path: "shop_admin_id",
        select: "+facebookAccessToken",
      });

      if (!accountDoc || !accountDoc.shop_admin_id?.facebookAccessToken) {
        await SyncMeta.updateOne(
          { _id: chunk._id },
          {
            $set: {
              status: "failed",
              error: "Missing Facebook access token for backfill",
              completed_at: new Date(),
            },
          }
        );
        return { success: false, chunkId: chunk._id, error: "Missing access token" };
      }

      const accessToken = accountDoc.shop_admin_id.facebookAccessToken;

      const insights = await fetchAccountInsights(accessToken, accountDoc.external_id, {
        level: "ad",
        timeIncrement: 1,
        needActions: true,
        actionBreakdowns: "action_type,action_destination",
        timeRange: {
          since: chunk.date_range_start,
          until: chunk.date_range_end,
        },
      });

      if (Array.isArray(insights) && insights.length > 0) {
        await saveInsightsToAdPerformance(insights, accountDoc._id.toString());
      }

      await SyncMeta.updateOne(
        { _id: chunk._id },
        {
          $set: {
            status: "done",
            records_processed: Array.isArray(insights) ? insights.length : 0,
            completed_at: new Date(),
          },
        }
      );

      processedChunks += 1;
      
      const doneCount = await SyncMeta.countDocuments({
        account_id: account._id,
        sync_type: "backfill",
        status: "done",
        createdAt: { $gte: runStartedAt },
      });
      const failedCount = await SyncMeta.countDocuments({
        account_id: account._id,
        sync_type: "backfill",
        status: "failed",
        createdAt: { $gte: runStartedAt },
      });
      const progress = totalChunks > 0 ? Math.round((doneCount / totalChunks) * 100) : 0;
      const now = Date.now();
      
      if (progress !== lastProgress || (now - lastProgressTime) > 5000) {
        console.log(`[Progress] ${doneCount}/${totalChunks} chunks done (${progress}%)`);
        lastProgress = progress;
        lastProgressTime = now;
        
        await AdsAccount.updateOne(
          { _id: account._id },
          {
            $set: {
              "sync_metadata.backfill_progress_percent": progress,
              "sync_metadata.backfill_status": doneCount + failedCount === totalChunks
                ? failedCount > 0 ? "failed" : "done"
                : "in_progress",
              "sync_metadata.backfill_current_date": chunk.date_range_end,
              "sync_metadata.backfill_error": failedCount > 0 ? "Some chunks failed" : null,
            },
          }
        );
      }
      
      return { success: true, chunkId: chunk._id, records: insights?.length || 0 };
    } catch (err) {
      const fbError = err.response?.data?.error;
      const errorMsg = fbError?.message || err.message;
      console.error(`[Error] Failed to process chunk ${chunk.date_range_start} → ${chunk.date_range_end}:`, errorMsg);
      
      await SyncMeta.updateOne(
        { _id: chunk._id },
        {
          $set: {
            status: "failed",
            error: errorMsg,
            completed_at: new Date(),
          },
        }
      );
      
      return { success: false, chunkId: chunk._id, error: errorMsg };
    }
  };

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(
      limit(async () => {
        while (await hasPendingOrInProgressChunks(account._id, runStartedAt)) {
          const result = await processChunk();
          if (!result) {
            await delay(1000);
            continue;
          }
          await delay(2000);
        }
      })
    );
  }

  await Promise.all(workers);

  const doneChunks = await SyncMeta.countDocuments({
    account_id: account._id,
    sync_type: "backfill",
    status: "done",
    createdAt: { $gte: runStartedAt },
  });
  const failedChunks = await SyncMeta.countDocuments({
    account_id: account._id,
    sync_type: "backfill",
    status: "failed",
    createdAt: { $gte: runStartedAt },
  });

  console.log("\n📌 Backfill summary:", {
    account_id: account._id.toString(),
    external_id: account.external_id,
    total_chunks: totalChunks,
    processed_chunks: processedChunks,
    done_chunks: doneChunks,
    failed_chunks: failedChunks,
    success_rate: totalChunks > 0 ? `${Math.round((doneChunks / totalChunks) * 100)}%` : "0%",
  });

  if (failedChunks > 0) {
    console.log(`\n⚠️  ${failedChunks} chunks failed. You can retry failed chunks using:`);
    console.log(`   node src/scripts/retryBackfillChunk.js ${account.external_id} <startDate> <endDate>`);
    
    const failedChunkList = await SyncMeta.find({
      account_id: account._id,
      sync_type: "backfill",
      status: "failed",
      createdAt: { $gte: runStartedAt },
    }).select("date_range_start date_range_end error").limit(5);
    
    if (failedChunkList.length > 0) {
      console.log(`\n   First ${Math.min(5, failedChunkList.length)} failed chunks:`);
      failedChunkList.forEach((chunk, idx) => {
        console.log(`   ${idx + 1}. ${chunk.date_range_start} → ${chunk.date_range_end}: ${chunk.error?.substring(0, 50) || 'Unknown error'}`);
      });
    }
  }
}

async function main() {
  try {
    const externalAccountId = process.argv[2];
    if (!externalAccountId) {
      console.error(
        "Usage: node src/scripts/backfillSingleAccount2Years.js <account_external_id>"
      );
      process.exit(1);
    }

    await connectDB();
    console.log("✅ Connected to database");

    await backfillSingleAccountTwoYears(externalAccountId);

    console.log("\n✅ 2-year backfill completed.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error during 2-year backfill:", err.message);
    process.exit(1);
  }
}

main();


