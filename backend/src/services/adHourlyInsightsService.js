import AdHourlyInsight from "../models/ads/adHourlyInsight.model.js";
import Ads from "../models/ads/ads.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import AdsCampaign from "../models/ads/adsCampaign.model.js";
import AdPerformance from "../models/ads/adPerformance.model.js";

const VIETNAM_OFFSET_MINUTES = 7 * 60;
const VIETNAM_OFFSET_MS = VIETNAM_OFFSET_MINUTES * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toNumber(value, fractionDigits = 2) {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return null;
  return typeof fractionDigits === "number" ? Number(numeric.toFixed(fractionDigits)) : numeric;
}

function resolveBudget(adset, campaign) {
  const rawBudget = adset?.daily_budget ?? campaign?.daily_budget ?? 0;
  return rawBudget ? toNumber(rawBudget / 100, 2) : 0;
}

function getVietnamDayRange(date) {
  const shifted = date.getTime() + VIETNAM_OFFSET_MS;
  const startVietnamMs = Math.floor(shifted / DAY_IN_MS) * DAY_IN_MS;
  const startUtcMs = startVietnamMs - VIETNAM_OFFSET_MS;
  return {
    startUtc: new Date(startUtcMs),
    endUtc: new Date(startUtcMs + DAY_IN_MS),
  };
}

function buildInsightFromPerformance({
  ad,
  adset,
  campaign,
  performance,
  retrievedAtHour,
  account,
}) {
  const hasPerformance = Boolean(performance);
  
  // 📊 DAILY METRICS: Từ latestPerformance (ngày mới nhất) - ✅ ROOT LEVEL
  const latestPerf = performance?.latestPerformance || null;
  const performanceDateIso = performance?.latestDate ? new Date(performance.latestDate).toISOString() : null;
  
  const dailyMetrics = {
    impressions: latestPerf?.impressions ?? 0,
    reach: latestPerf?.reach ?? 0,
    clicks: latestPerf?.clicks ?? 0,
    spend: latestPerf?.spend ?? 0,
    conversions: latestPerf?.conversions ?? 0,
    frequency: latestPerf?.frequency ?? 0,
    cpc: latestPerf?.cpc ?? null,
    cpm: latestPerf?.cpm ?? null,
    ctr: latestPerf?.ctr ?? null,
    conversion_rate: latestPerf?.conversion_rate ?? null,
    cost_per_conversion: latestPerf?.cost_per_conversion ?? null,
    results: latestPerf?.results ?? 0,
    cost_per_result: latestPerf?.cost_per_result ?? null,
    link_clicks: latestPerf?.link_clicks ?? 0,
    link_cpc: latestPerf?.link_cpc ?? null,
    link_ctr: latestPerf?.link_ctr ?? null,
    website_purchases: latestPerf?.website_purchases ?? 0,
    website_purchase_roas: latestPerf?.website_purchase_roas ?? null,
    audience_reach_percentage: latestPerf?.audience_reach_percentage ?? null,
  };

  // 📊 CUMULATIVE METRICS: Tổng từ đầu đến giờ
  const cumulativeMetrics = {
    total_spend: performance?.totalSpend ?? 0,
    total_impressions: performance?.totalImpressions ?? 0,
    total_reach: performance?.totalReach ?? 0,
    total_clicks: performance?.totalClicks ?? 0,
    total_results: performance?.totalResults ?? 0,
    total_conversions: performance?.totalConversions ?? 0,
    total_purchases: performance?.totalPurchases ?? 0,
    
    // Tính các metrics trung bình từ cumulative
    avg_cpc: performance?.totalClicks > 0 
      ? toNumber(performance.totalSpend / performance.totalClicks, 2) 
      : null,
    avg_cpm: performance?.totalImpressions > 0 
      ? toNumber((performance.totalSpend / performance.totalImpressions) * 1000, 2) 
      : null,
    avg_ctr: performance?.totalImpressions > 0 
      ? toNumber((performance.totalClicks / performance.totalImpressions) * 100, 2) 
      : null,
    avg_cost_per_result: performance?.totalResults > 0 
      ? toNumber(performance.totalSpend / performance.totalResults, 2) 
      : null,
    avg_conversion_rate: performance?.totalClicks > 0 
      ? toNumber((performance.totalConversions / performance.totalClicks) * 100, 2) 
      : null,
    
    // Thống kê
    days_with_data: performance?.recordCount ?? 0,
    first_performance_date: performance?.firstDate ? new Date(performance.firstDate).toISOString() : null,
  };

  const fallbackBudget = resolveBudget(adset, campaign);
  const dailyBudget = latestPerf?.daily_budget ?? fallbackBudget;
  const totalSpend = dailyMetrics.spend ?? 0;
  const dailySpendRate = latestPerf?.daily_spend_rate
    ?? (dailyBudget && totalSpend ? toNumber((totalSpend / dailyBudget) * 100, 2) : null);

  return {
    account_id: account._id,
    campaign_id: campaign?._id || null,
    adset_id: adset?._id || null,
    ad_id: ad._id,
    delivery_status: ad.effective_status || ad.status || ad.configured_status || "UNKNOWN",
    
    // 📊 DAILY METRICS (Ngày mới nhất)
    impressions: dailyMetrics.impressions,
    reach: dailyMetrics.reach,
    clicks: dailyMetrics.clicks,
    spend: dailyMetrics.spend,
    conversions: dailyMetrics.conversions,
    frequency: dailyMetrics.frequency,
    cpc: dailyMetrics.cpc,
    cpm: dailyMetrics.cpm,
    ctr: dailyMetrics.ctr,
    conversion_rate: dailyMetrics.conversion_rate,
    cost_per_conversion: dailyMetrics.cost_per_conversion,
    results: dailyMetrics.results,
    cost_per_result: dailyMetrics.cost_per_result,
    link_clicks: dailyMetrics.link_clicks,
    link_cpc: dailyMetrics.link_cpc,
    link_ctr: dailyMetrics.link_ctr,
    website_purchases: dailyMetrics.website_purchases,
    website_purchase_roas: dailyMetrics.website_purchase_roas,
    audience_reach_percentage: dailyMetrics.audience_reach_percentage,
    
    // Thông tin chung
    campaign_name: latestPerf?.campaign_name || campaign?.name || null,
    adset_name: latestPerf?.adset_name || adset?.name || null,
    ad_name: latestPerf?.ad_name || ad.name || null,
    page_name: latestPerf?.page_name || adset?.page_name || campaign?.page_name || null,
    daily_budget: dailyBudget,
    daily_spend_rate: dailySpendRate,
    total_amount_spent: latestPerf?.total_amount_spent ?? dailyMetrics.spend,
    
    // Timestamp
    insight_at: retrievedAtHour,
    retrieved_at: retrievedAtHour,
    retrieved_at_hour: retrievedAtHour,
    
    meta: {
      source: "ad_performance_snapshot",
      retrieved_at_hour: retrievedAtHour.toISOString(),
      performance_date: performanceDateIso, // Ngày của daily metrics
      account_external_id: account.external_id || null,
      performance_document_id: hasPerformance && latestPerf?._id ? latestPerf._id.toString() : null,
      performance_available: hasPerformance,
      
      // ✅ CUMULATIVE METRICS (Tổng từ đầu)
      cumulative: cumulativeMetrics,
    },
  };
}

function ensureDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  return new Date(value);
}

export async function syncAdHourlyInsightsForAccount(account, options = {}) {
  const { retrievedAtHour } = options;

  if (!account || !account._id) {
    throw new Error("Account document is required to sync hourly insights");
  }

  if (!retrievedAtHour) {
    throw new Error("retrievedAtHour is required when syncing hourly insights");
  }

  const normalizedRetrievedAtHour = ensureDate(retrievedAtHour);
  const retrievedAtHourIso = normalizedRetrievedAtHour.toISOString();

  // Lấy account ID number (bỏ prefix "act_" nếu có)
  const accountIdNumber = account.external_id ? account.external_id.replace(/^act_/, '') : null;

  const ads = await Ads.find({ 
    external_account_id: accountIdNumber 
  })
    .select("_id set_id account_id external_account_id name status effective_status configured_status")
    .lean();

  console.log(`🔍 Found ${ads.length} ads for account ${account.external_id} (external_account_id=${accountIdNumber})`);

  if (!ads.length) {
    console.log(`[${retrievedAtHourIso}] ℹ️ No ads found for account ${account.external_id || account._id} when generating hourly insights`);
    return {
      retrievedAtHour: retrievedAtHourIso,
      processedAds: 0,
      upserts: 0,
      skipped: 0,
    };
  }

  const adIds = ads.map(ad => ad._id);
  const adsetIds = ads.map(ad => ad.set_id).filter(Boolean);
  const adsets = adsetIds.length > 0
    ? await AdsSet.find({ _id: { $in: adsetIds } })
        .select("_id name campaign_id page_name daily_budget")
        .lean()
    : [];
  const adsetsMap = new Map(adsets.map(set => [set._id.toString(), set]));

  const campaignIds = adsets
    .map(set => set.campaign_id)
    .filter(Boolean);
  const campaigns = campaignIds.length > 0
    ? await AdsCampaign.find({ _id: { $in: campaignIds } })
        .select("_id name page_name daily_budget")
        .lean()
    : [];
  const campaignsMap = new Map(campaigns.map(campaign => [campaign._id.toString(), campaign]));

  // ✅ LẤY CẢ DAILY (ngày mới nhất) VÀ CUMULATIVE (tổng từ đầu) CỦA MỖI AD
  // Dùng aggregation để tính 2 loại metrics
  const performances = await AdPerformance.aggregate([
    {
      $match: {
        ads_id: { $in: adIds },
        date: { $lte: normalizedRetrievedAtHour } // Chỉ lấy data <= thời điểm snapshot
      }
    },
    {
      $sort: {
        ads_id: 1,
        date: -1,      // Ngày mới nhất trước
        updated_at: -1
      }
    },
    {
      $group: {
        _id: "$ads_id",
        // 📊 DAILY: Chỉ số ngày mới nhất
        latestPerformance: { $first: "$$ROOT" },
        latestDate: { $first: "$date" },
        
        // 📊 CUMULATIVE: Tổng tất cả các ngày (✅ SỬA: Lấy từ ROOT LEVEL)
        totalSpend: { $sum: "$spend" },
        totalImpressions: { $sum: "$impressions" },
        totalReach: { $sum: "$reach" },
        totalClicks: { $sum: "$clicks" },
        totalResults: { $sum: "$results" },
        totalConversions: { $sum: "$conversions" },
        totalPurchases: { $sum: "$website_purchases" },
        
        // Metrics khác (lấy từ latest)
        firstDate: { $last: "$date" }, // Ngày đầu tiên có data
        recordCount: { $sum: 1 } // Số ngày có data
      }
    }
  ]);

  console.log(`[${retrievedAtHourIso}] 📊 Found ${performances.length} ads with performance data (date <= ${retrievedAtHourIso})`);

  // ✅ Map performance theo ads_id
  const performanceByAdId = new Map();
  for (const perf of performances) {
    performanceByAdId.set(perf._id.toString(), perf);
  }

  console.log(`[${retrievedAtHourIso}] 🎯 Mapped ${performanceByAdId.size} ads with daily + cumulative performance data`);

  const hourlyInsights = [];
  let missingPerformanceCount = 0;
  let performanceDateCounts = {}; // Thống kê số ads theo từng ngày performance

  for (const ad of ads) {
    const adsetId = ad.set_id ? ad.set_id.toString() : null;
    const adset = adsetId ? adsetsMap.get(adsetId) || null : null;
    const campaignId = adset?.campaign_id ? adset.campaign_id.toString() : null;
    const campaign = campaignId ? campaignsMap.get(campaignId) || null : null;
    
    // ✅ Lấy performance data (có cả daily và cumulative)
    const performance = performanceByAdId.get(ad._id.toString()) || null;

    const insight = buildInsightFromPerformance({
      ad,
      adset,
      campaign,
      performance,
      retrievedAtHour: normalizedRetrievedAtHour,
      account,
    });

    hourlyInsights.push(insight);

    if (!performance) {
      missingPerformanceCount += 1;
    } else {
      // Thống kê theo ngày performance (latest date)
      const perfDate = performance.latestDate ? new Date(performance.latestDate).toISOString().split('T')[0] : 'unknown';
      performanceDateCounts[perfDate] = (performanceDateCounts[perfDate] || 0) + 1;
    }
  }

  // 🔍 LOG THỐNG KÊ CHI TIẾT
  console.log(`[${retrievedAtHourIso}] � Hourly snapshot statistics:`, {
    retrievedAtHour: retrievedAtHourIso,
    totalAds: ads.length,
    adsWithPerformance: ads.length - missingPerformanceCount,
    adsMissingPerformance: missingPerformanceCount,
    performanceBreakdownByDate: performanceDateCounts,
    accountId: account._id,
    accountExternalId: account.external_id
  });

  if (!hourlyInsights.length) {
    console.log(`[${retrievedAtHourIso}] ℹ️ No hourly insights generated for account ${account.external_id || account._id}`);
    return {
      retrievedAtHour: retrievedAtHourIso,
      processedAds: ads.length,
      upserts: 0,
      skipped: ads.length,
    };
  }

  // � LOG TRƯỚC KHI INSERT
  console.log(`[${retrievedAtHourIso}] 📝 About to insert ${hourlyInsights.length} insights, sample data:`, 
    JSON.stringify(hourlyInsights[0], null, 2)
  );

  // ✅ LUÔN INSERT MỚI - Không check duplicate
  let upsertedCount = 0;
  if (hourlyInsights.length > 0) {
    try {
      const result = await AdHourlyInsight.insertMany(hourlyInsights, { 
        ordered: false // Tiếp tục insert nếu có lỗi
      });
      upsertedCount = result.length;
      console.log(`[${retrievedAtHourIso}] ✅ Inserted ${upsertedCount} new hourly snapshots`);
    } catch (error) {
      if (error.name === 'MongoBulkWriteError' && error.code === 11000) {
        // Có duplicate key errors
        const successCount = hourlyInsights.length - (error.writeErrors?.length || 0);
        upsertedCount = successCount;
        console.warn(`[${retrievedAtHourIso}] ⚠️ Inserted ${successCount} snapshots, ${error.writeErrors?.length || 0} duplicates skipped`);
        console.log(`[${retrievedAtHourIso}] 💡 Note: Duplicates may occur if cronjob runs multiple times at same hour`);
      } else {
        console.error(`[${retrievedAtHourIso}] ❌ INSERT ERROR:`, {
          name: error.name,
          code: error.code,
          message: error.message,
          writeErrorsCount: error.writeErrors?.length,
        });
        throw error;
      }
    }
  }

  console.log(`[${retrievedAtHourIso}] ✅ Synced hourly insights for account ${account.external_id || account._id}: processed ${ads.length} ads, inserted ${upsertedCount} new snapshots, missing performance ${missingPerformanceCount}`);

  return {
    retrievedAtHour: retrievedAtHourIso,
    processedAds: ads.length,
    upserts: upsertedCount,
    skipped: missingPerformanceCount,
  };
}
