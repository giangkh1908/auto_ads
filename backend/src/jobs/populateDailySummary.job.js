import cron from "node-cron";
import AdPerformance from "../models/ads/adPerformance.model.js";
import AdPerformanceDailySummary from "../models/ads/adPerformanceDailySummary.model.js";
import AdsAccount from "../models/ads/adsAccount.model.js";

const VN_TIMEZONE = "Asia/Ho_Chi_Minh";

function formatVietnamDateString(date) {
  return date.toLocaleDateString("en-CA", { timeZone: VN_TIMEZONE });
}

function resolveTargetDateString(targetDate) {
  if (!targetDate) {
    return formatVietnamDateString(new Date());
  }

  if (typeof targetDate === "string") {
    return targetDate.slice(0, 10);
  }

  if (targetDate instanceof Date) {
    return formatVietnamDateString(targetDate);
  }

  return formatVietnamDateString(new Date(targetDate));
}

function getUtcDateRange(dateStr) {
  const start = new Date(`${dateStr}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function populateDailySummaryForAccount(accountId, targetDateStr) {
  const { start, end } = getUtcDateRange(targetDateStr);

  const summary = await AdPerformance.aggregate([
    {
      $match: {
        account_id: accountId,
        date: {
          $gte: start,
          $lt: end,
        },
      },
    },
    {
      $group: {
        _id: null,
        total_ads: { $addToSet: "$ads_id" },
        total_campaigns: { $addToSet: "$campaign_id" },
        total_adsets: { $addToSet: "$set_id" },
        total_spend: { $sum: "$spend" },
        total_impressions: { $sum: "$impressions" },
        total_clicks: { $sum: "$clicks" },
        total_reach: { $sum: "$reach" },
        total_results: { $sum: "$results" },
        total_conversions: { $sum: "$conversions" },
        avg_ctr: { $avg: "$ctr" },
        avg_cpc: { $avg: "$cpc" },
        avg_cpm: { $avg: "$cpm" },
        avg_frequency: { $avg: "$frequency" },
        avg_cost_per_result: { $avg: "$cost_per_result" },
      },
    },
  ]);

  if (summary.length === 0) {
    return { created: false, reason: "no_data" };
  }

  const data = summary[0];

  await AdPerformanceDailySummary.findOneAndUpdate(
    {
      account_id: accountId,
      date: start,
    },
    {
      $set: {
        total_ads: data.total_ads?.length || 0,
        total_campaigns: data.total_campaigns?.length || 0,
        total_adsets: data.total_adsets?.length || 0,
        total_spend: data.total_spend || 0,
        total_impressions: data.total_impressions || 0,
        total_clicks: data.total_clicks || 0,
        total_reach: data.total_reach || 0,
        total_results: data.total_results || 0,
        total_conversions: data.total_conversions || 0,
        avg_ctr: data.avg_ctr || 0,
        avg_cpc: data.avg_cpc || 0,
        avg_cpm: data.avg_cpm || 0,
        avg_frequency: data.avg_frequency || 0,
        avg_cost_per_result: data.avg_cost_per_result || 0,
        last_updated: new Date(),
      },
    },
    { upsert: true }
  );

  return { created: true };
}

async function populateDailySummaryForDate(targetDateStr) {
  const activeAccounts = await AdsAccount.find({
    status: "ACTIVE",
  }).select("_id");

  let totalProcessed = 0;
  let totalCreated = 0;

  for (const account of activeAccounts) {
    try {
      const result = await populateDailySummaryForAccount(
        account._id,
        targetDateStr
      );
      totalProcessed++;
      if (result.created) {
        totalCreated++;
      }
    } catch (error) {
      console.error(
        `Error populating daily summary for account ${account._id}:`,
        error.message
      );
    }
  }

  return { totalProcessed, totalCreated };
}

export async function populateDailySummary(targetDate = null) {
  const dateStr = resolveTargetDateString(targetDate);

  console.log(
    `[${new Date().toISOString()}] 📊 Starting populate daily summary for date: ${dateStr}`
  );

  try {
    const result = await populateDailySummaryForDate(dateStr);
    console.log(
      `[${new Date().toISOString()}] ✅ Daily summary populated: ${result.totalCreated}/${result.totalProcessed} accounts`
    );
    return result;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] ❌ Error populating daily summary:`,
      error.message
    );
    throw error;
  }
}

export const startPopulateDailySummaryCron = () => {
  cron.schedule("*/30 * * * *", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDateStr = formatVietnamDateString(yesterday);
    await populateDailySummary(targetDateStr);
  });

  console.log(
    "✅ Populate daily summary cronjob started - runs every minute (TEST MODE), populates yesterday's data"
  );
  console.log(
    "⚠️  TODO: Change to '0 0 * * *' for production (runs at 0:00 AM server time)"
  );
};

