import cron from "node-cron";
import AdPerformance from "../models/ads/adPerformance.model.js";
import AdPerformanceCampaignDaily from "../models/ads/adPerformanceCampaignDaily.model.js";
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

async function populateCampaignDailyForAccount(accountId, targetDateStr) {
  const { start, end } = getUtcDateRange(targetDateStr);

  const campaigns = await AdPerformance.aggregate([
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
        _id: "$campaign_id",
        campaign_name: { $first: "$campaign_name" },
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

  if (campaigns.length === 0) {
    return { created: 0 };
  }

  const bulkOps = campaigns.map((campaign) => ({
    updateOne: {
      filter: {
        account_id: accountId,
        campaign_id: campaign._id,
        date: start,
      },
      update: {
        $set: {
          campaign_name: campaign.campaign_name || "",
          total_spend: campaign.total_spend || 0,
          total_impressions: campaign.total_impressions || 0,
          total_clicks: campaign.total_clicks || 0,
          total_reach: campaign.total_reach || 0,
          total_results: campaign.total_results || 0,
          total_conversions: campaign.total_conversions || 0,
          avg_ctr: campaign.avg_ctr || 0,
          avg_cpc: campaign.avg_cpc || 0,
          avg_cpm: campaign.avg_cpm || 0,
          avg_frequency: campaign.avg_frequency || 0,
          avg_cost_per_result: campaign.avg_cost_per_result || 0,
          last_updated: new Date(),
        },
      },
      upsert: true,
    },
  }));

  const result = await AdPerformanceCampaignDaily.bulkWrite(bulkOps);

  return {
    created: result.upsertedCount,
    updated: result.modifiedCount,
  };
}

async function populateCampaignDailyForDate(targetDateStr) {
  const activeAccounts = await AdsAccount.find({
    status: "ACTIVE",
  }).select("_id");

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  for (const account of activeAccounts) {
    try {
      const result = await populateCampaignDailyForAccount(
        account._id,
        targetDateStr
      );
      totalProcessed++;
      totalCreated += result.created || 0;
      totalUpdated += result.updated || 0;
    } catch (error) {
      console.error(
        `Error populating campaign daily for account ${account._id}:`,
        error.message
      );
    }
  }

  return { totalProcessed, totalCreated, totalUpdated };
}

export async function populateCampaignDaily(targetDate = null) {
  const dateStr = resolveTargetDateString(targetDate);

  console.log(
    `[${new Date().toISOString()}] 📊 Starting populate campaign daily for date: ${dateStr}`
  );

  try {
    const result = await populateCampaignDailyForDate(dateStr);
    console.log(
      `[${new Date().toISOString()}] ✅ Campaign daily populated: ${result.totalCreated} created, ${result.totalUpdated} updated across ${result.totalProcessed} accounts`
    );
    return result;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] ❌ Error populating campaign daily:`,
      error.message
    );
    throw error;
  }
}

export const startPopulateCampaignDailyCron = () => {
  cron.schedule("*/30 * * * *", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDateStr = formatVietnamDateString(yesterday);
    await populateCampaignDaily(targetDateStr);
  });

  console.log(
    "✅ Populate campaign daily cronjob started - runs every minute (TEST MODE), populates yesterday's data"
  );
  console.log(
    "⚠️  TODO: Change to '0 0 * * *' for production (runs at 0:00 AM server time)"
  );
};

