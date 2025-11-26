import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import AdsAccount from "../models/ads/adsAccount.model.js";
import SyncMeta from "../models/ads/syncMeta.model.js";
import "../models/user.model.js";
import { startBackfill, processNextBackfillChunk } from "../services/backfillService.js";

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

async function hasPendingOrInProgressChunks(accountId) {
  const count = await SyncMeta.countDocuments({
    account_id: accountId,
    sync_type: "backfill",
    status: { $in: ["pending", "in_progress"] },
  });
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

  console.log("🧩 Creating 30-day backfill chunks via startBackfill...");
  await startBackfill(account._id.toString(), startDate, endDate);

  let processedChunks = 0;

  while (await hasPendingOrInProgressChunks(account._id)) {
    processedChunks += 1;
    console.log(`\n[Chunk ${processedChunks}] Processing next backfill chunk...`);
    await processNextBackfillChunk();
    await delay(1000);
  }

  const doneChunks = await SyncMeta.countDocuments({
    account_id: account._id,
    sync_type: "backfill",
    status: "done",
  });
  const failedChunks = await SyncMeta.countDocuments({
    account_id: account._id,
    sync_type: "backfill",
    status: "failed",
  });

  console.log("\n📌 Backfill summary:", {
    account_id: account._id.toString(),
    external_id: account.external_id,
    processed_chunks: processedChunks,
    done_chunks: doneChunks,
    failed_chunks: failedChunks,
  });
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


