import cron from "node-cron";
import AdPerformance from "../models/ads/adPerformance.model.js";
import AdPerformanceTrendDaily from "../models/ads/adPerformanceTrendDaily.model.js";
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

async function calculateTrendChanges(accountId, campaignId, dateStr) {
  const { start } = getUtcDateRange(dateStr);
  const current = start;
  const previous = new Date(current);
  previous.setUTCDate(previous.getUTCDate() - 1);

  const [currentData, previousData] = await Promise.all([
    AdPerformanceTrendDaily.findOne({
      account_id: accountId,
      campaign_id: campaignId || null,
      date: current,
    }).lean(),
    AdPerformanceTrendDaily.findOne({
      account_id: accountId,
      campaign_id: campaignId || null,
      date: previous,
    }).lean(),
  ]);

  if (!currentData || !previousData) {
    return {
      spend_change: null,
      ctr_change: null,
      impressions_change: null,
      clicks_change: null,
    };
  }

  const spendChange =
    previousData.spend > 0
      ? ((currentData.spend - previousData.spend) / previousData.spend) * 100
      : null;

  const ctrChange =
    previousData.ctr > 0
      ? ((currentData.ctr - previousData.ctr) / previousData.ctr) * 100
      : null;

  const impressionsChange =
    previousData.impressions > 0
      ? ((currentData.impressions - previousData.impressions) /
          previousData.impressions) *
        100
      : null;

  const clicksChange =
    previousData.clicks > 0
      ? ((currentData.clicks - previousData.clicks) / previousData.clicks) *
        100
      : null;

  return {
    spend_change: spendChange,
    ctr_change: ctrChange,
    impressions_change: impressionsChange,
    clicks_change: clicksChange,
  };
}

async function populateTrendDailyForAccount(accountId, targetDateStr) {
  const { start, end } = getUtcDateRange(targetDateStr);

  const accountData = await AdPerformance.aggregate([
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
        spend: { $sum: "$spend" },
        impressions: { $sum: "$impressions" },
        clicks: { $sum: "$clicks" },
        reach: { $sum: "$reach" },
        results: { $sum: "$results" },
        conversions: { $sum: "$conversions" },
        ctr: { $avg: "$ctr" },
        cpc: { $avg: "$cpc" },
        cpm: { $avg: "$cpm" },
        frequency: { $avg: "$frequency" },
        cost_per_result: { $avg: "$cost_per_result" },
      },
    },
  ]);

  if (accountData.length === 0) {
    return { created: 0 };
  }

  const data = accountData[0];
  const trendChanges = await calculateTrendChanges(accountId, null, targetDateStr);

  await AdPerformanceTrendDaily.findOneAndUpdate(
    {
      account_id: accountId,
      campaign_id: null,
      date: start,
    },
    {
      $set: {
        spend: data.spend || 0,
        impressions: data.impressions || 0,
        clicks: data.clicks || 0,
        reach: data.reach || 0,
        results: data.results || 0,
        conversions: data.conversions || 0,
        ctr: data.ctr || 0,
        cpc: data.cpc || 0,
        cpm: data.cpm || 0,
        frequency: data.frequency || 0,
        cost_per_result: data.cost_per_result || 0,
        spend_change: trendChanges.spend_change,
        ctr_change: trendChanges.ctr_change,
        impressions_change: trendChanges.impressions_change,
        clicks_change: trendChanges.clicks_change,
        last_updated: new Date(),
      },
    },
    { upsert: true }
  );

  const campaignData = await AdPerformance.aggregate([
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
        spend: { $sum: "$spend" },
        impressions: { $sum: "$impressions" },
        clicks: { $sum: "$clicks" },
        reach: { $sum: "$reach" },
        results: { $sum: "$results" },
        conversions: { $sum: "$conversions" },
        ctr: { $avg: "$ctr" },
        cpc: { $avg: "$cpc" },
        cpm: { $avg: "$cpm" },
        frequency: { $avg: "$frequency" },
        cost_per_result: { $avg: "$cost_per_result" },
      },
    },
  ]);

  let campaignCreated = 0;

  for (const campaign of campaignData) {
    if (!campaign._id) continue;

    const campaignTrendChanges = await calculateTrendChanges(
      accountId,
      campaign._id,
      targetDateStr
    );

    await AdPerformanceTrendDaily.findOneAndUpdate(
      {
        account_id: accountId,
        campaign_id: campaign._id,
        date: start,
      },
      {
        $set: {
          spend: campaign.spend || 0,
          impressions: campaign.impressions || 0,
          clicks: campaign.clicks || 0,
          reach: campaign.reach || 0,
          results: campaign.results || 0,
          conversions: campaign.conversions || 0,
          ctr: campaign.ctr || 0,
          cpc: campaign.cpc || 0,
          cpm: campaign.cpm || 0,
          frequency: campaign.frequency || 0,
          cost_per_result: campaign.cost_per_result || 0,
          spend_change: campaignTrendChanges.spend_change,
          ctr_change: campaignTrendChanges.ctr_change,
          impressions_change: campaignTrendChanges.impressions_change,
          clicks_change: campaignTrendChanges.clicks_change,
          last_updated: new Date(),
        },
      },
      { upsert: true }
    );

    campaignCreated++;
  }

  return { created: 1 + campaignCreated };
}

async function populateTrendDailyForDate(targetDateStr) {
  const activeAccounts = await AdsAccount.find({
    status: "ACTIVE",
  }).select("_id");

  let totalProcessed = 0;
  let totalCreated = 0;

  for (const account of activeAccounts) {
    try {
      const result = await populateTrendDailyForAccount(
        account._id,
        targetDateStr
      );
      totalProcessed++;
      totalCreated += result.created || 0;
    } catch (error) {
      console.error(
        `Error populating trend daily for account ${account._id}:`,
        error.message
      );
    }
  }

  return { totalProcessed, totalCreated };
}

export async function populateTrendDaily(targetDate = null) {
  const dateStr = resolveTargetDateString(targetDate);

  console.log(
    `[${new Date().toISOString()}] 📊 Starting populate trend daily for date: ${dateStr}`
  );

  try {
    const result = await populateTrendDailyForDate(dateStr);
    console.log(
      `[${new Date().toISOString()}] ✅ Trend daily populated: ${result.totalCreated} records across ${result.totalProcessed} accounts`
    );
    return result;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] ❌ Error populating trend daily:`,
      error.message
    );
    throw error;
  }
}

export const startPopulateTrendDailyCron = () => {
  cron.schedule("*/30 * * * *", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDateStr = formatVietnamDateString(yesterday);
    await populateTrendDaily(targetDateStr);
  });

  console.log(
    "✅ Populate trend daily cronjob started - runs every minute (TEST MODE), populates yesterday's data"
  );
  console.log(
    "⚠️  TODO: Change to '0 0 * * *' for production (runs at 0:00 AM server time)"
  );
};

