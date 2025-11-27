import AdsAccount from "../models/ads/adsAccount.model.js";
import SyncMeta from "../models/ads/syncMeta.model.js";
import { fetchAccountInsights, saveInsightsToAdPerformance } from "./fbAdsService.js";

function getDateString(date) {
  return date.toISOString().slice(0, 10);
}

function buildChunks(startDate, endDate) {
  const chunks = [];
  let currentStart = new Date(startDate);
  const end = new Date(endDate);

  while (currentStart <= end) {
    const chunkStart = new Date(currentStart);
    const chunkEnd = new Date(currentStart);
    chunkEnd.setDate(chunkEnd.getDate() + 6); // ✅ 7 ngày (0-6 = 7 ngày)
    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }

    chunks.push({
      start: getDateString(chunkStart),
      end: getDateString(chunkEnd),
    });

    currentStart.setDate(currentStart.getDate() + 7); // ✅ Move to next 7-day chunk
  }

  return chunks;
}

export async function startBackfill(accountId, startDate, endDate) {
  const account = await AdsAccount.findById(accountId);
  if (!account) {
    throw new Error("AdsAccount not found");
  }

  const chunks = buildChunks(new Date(startDate), new Date(endDate));

  const bulkOps = chunks.map((chunk) => ({
    insertOne: {
      document: {
        account_id: account._id,
        sync_type: "backfill",
        date_range_start: chunk.start,
        date_range_end: chunk.end,
        status: "pending",
      },
    },
  }));

  if (bulkOps.length > 0) {
    await SyncMeta.bulkWrite(bulkOps);
  }

  await AdsAccount.updateOne(
    { _id: account._id },
    {
      $set: {
        "sync_metadata.backfill_status": "in_progress",
        "sync_metadata.backfill_progress_percent": 0,
        "sync_metadata.backfill_start_date": getDateString(new Date(startDate)),
        "sync_metadata.backfill_end_date": getDateString(new Date(endDate)),
        "sync_metadata.backfill_error": null,
      },
    }
  );
}

export async function processNextBackfillChunk() {
  const chunk = await SyncMeta.findOneAndUpdate(
    { sync_type: "backfill", status: "pending" },
    {
      $set: {
        status: "in_progress",
        started_at: new Date(),
      },
    },
    { sort: { createdAt: 1 }, new: true }
  );

  if (!chunk) {
    return;
  }

  const account = await AdsAccount.findById(chunk.account_id).populate({
    path: "shop_admin_id",
    select: "+facebookAccessToken",
  });

  if (!account || !account.shop_admin_id?.facebookAccessToken) {
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
    return;
  }

  const accessToken = account.shop_admin_id.facebookAccessToken;

  try {
    const insights = await fetchAccountInsights(accessToken, account.external_id, {
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
      await saveInsightsToAdPerformance(insights, account._id.toString());
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
  } catch (err) {
    await SyncMeta.updateOne(
      { _id: chunk._id },
      {
        $set: {
          status: "failed",
          error: err.message || String(err),
          completed_at: new Date(),
        },
      }
    );
  }

  const accountChunks = await SyncMeta.find({
    account_id: chunk.account_id,
    sync_type: "backfill",
  }).select("status");

  const total = accountChunks.length;
  if (total === 0) {
    return;
  }

  const doneCount = accountChunks.filter((c) => c.status === "done").length;
  const failedCount = accountChunks.filter((c) => c.status === "failed").length;
  const progress = Math.round((doneCount / total) * 100);

  await AdsAccount.updateOne(
    { _id: chunk.account_id },
    {
      $set: {
        "sync_metadata.backfill_progress_percent": progress,
        "sync_metadata.backfill_status":
          doneCount + failedCount === total
            ? failedCount > 0
              ? "failed"
              : "done"
            : "in_progress",
        "sync_metadata.backfill_current_date": chunk.date_range_end,
        "sync_metadata.backfill_error": failedCount > 0 ? "Some chunks failed" : null,
      },
    }
  );
}


