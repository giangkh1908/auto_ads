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
  const performanceDateIso = performance?.date ? new Date(performance.date).toISOString() : null;
  const metrics = {
    impressions: performance?.impressions ?? 0,
    reach: performance?.reach ?? 0,
    clicks: performance?.clicks ?? 0,
    spend: performance?.spend ?? 0,
    conversions: performance?.conversions ?? 0,
    frequency: performance?.frequency ?? 0,
    cpc: performance?.cpc ?? null,
    cpm: performance?.cpm ?? null,
    ctr: performance?.ctr ?? null,
    conversion_rate: performance?.conversion_rate ?? null,
    cost_per_conversion: performance?.cost_per_conversion ?? null,
    results: performance?.results ?? 0,
    cost_per_result: performance?.cost_per_result ?? null,
    link_clicks: performance?.link_clicks ?? 0,
    link_cpc: performance?.link_cpc ?? null,
    link_ctr: performance?.link_ctr ?? null,
    website_purchases: performance?.website_purchases ?? 0,
    website_purchase_roas: performance?.website_purchase_roas ?? null,
    audience_reach_percentage: performance?.audience_reach_percentage ?? null,
  };

  const fallbackBudget = resolveBudget(adset, campaign);
  const dailyBudget = performance?.daily_budget ?? fallbackBudget;
  const totalSpend = metrics.spend ?? 0;
  const dailySpendRate = performance?.daily_spend_rate
    ?? (dailyBudget && totalSpend ? toNumber((totalSpend / dailyBudget) * 100, 2) : null);

  const ruleEvaluations = performance?.meta?.rule_evaluations
    ?? performance?.rule_evaluations
    ?? {};

  return {
    account_id: account._id, // ✅ SỬA: Dùng account._id thay vì ad.account_id
    campaign_id: campaign?._id || null,
    adset_id: adset?._id || null,
    ad_id: ad._id,
    delivery_status: ad.effective_status || ad.status || ad.configured_status || "UNKNOWN",
    impressions: metrics.impressions,
    reach: metrics.reach,
    clicks: metrics.clicks,
    spend: metrics.spend,
    conversions: metrics.conversions,
    frequency: metrics.frequency,
    cpc: metrics.cpc,
    cpm: metrics.cpm,
    ctr: metrics.ctr,
    conversion_rate: metrics.conversion_rate,
    cost_per_conversion: metrics.cost_per_conversion,
    results: metrics.results,
    cost_per_result: metrics.cost_per_result,
    campaign_name: performance?.campaign_name || campaign?.name || null,
    adset_name: performance?.adset_name || adset?.name || null,
    ad_name: performance?.ad_name || ad.name || null,
    page_name: performance?.page_name || adset?.page_name || campaign?.page_name || null,
    daily_budget: dailyBudget,
    daily_spend_rate: dailySpendRate,
    total_amount_spent: performance?.total_amount_spent ?? metrics.spend,
    link_clicks: metrics.link_clicks,
    link_cpc: metrics.link_cpc,
    link_ctr: metrics.link_ctr,
    website_purchases: metrics.website_purchases,
    website_purchase_roas: metrics.website_purchase_roas,
    audience_reach_percentage: metrics.audience_reach_percentage,
    rule_evaluations: ruleEvaluations,
    insight_at: retrievedAtHour,
    retrieved_at: retrievedAtHour,
    retrieved_at_hour: retrievedAtHour, // ✅ THÊM FIELD NÀY để filter chính xác
    meta: {
      source: "ad_performance_snapshot",
      retrieved_at_hour: retrievedAtHour.toISOString(),
      performance_date: performanceDateIso,
      account_external_id: account.external_id || null,
      performance_document_id: hasPerformance && performance?._id ? performance._id.toString() : null,
      performance_available: hasPerformance,
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

  const adIds = ads.map(ad => ad._id); // ✅ THÊM DÒNG NÀY
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

  // 🔥 LẤY PERFORMANCE DATA MỚI NHẤT CHO TỪNG AD (không giới hạn theo ngày)
  const performances = await AdPerformance.find({
    ads_id: { $in: adIds },
  })
    .sort({ date: -1, created_at: -1 }) // Sắp xếp theo ngày mới nhất
    .select(
      "_id ads_id date impressions reach clicks spend conversions frequency cpc cpm ctr conversion_rate cost_per_conversion results cost_per_result link_clicks link_cpc link_ctr website_purchases website_purchase_roas audience_reach_percentage daily_budget daily_spend_rate total_amount_spent campaign_name adset_name ad_name page_name rule_evaluations meta"
    )
    .lean();

  // Group performance theo ads_id, chỉ lấy record mới nhất của mỗi ad
  const performanceByAdId = new Map();
  for (const perf of performances) {
    const adIdStr = perf.ads_id.toString();
    if (!performanceByAdId.has(adIdStr)) {
      performanceByAdId.set(adIdStr, perf); // Lấy record đầu tiên (mới nhất do đã sort)
    }
  }

  const hourlyInsights = [];
  let missingPerformanceCount = 0;

  for (const ad of ads) {
    const adsetId = ad.set_id ? ad.set_id.toString() : null;
    const adset = adsetId ? adsetsMap.get(adsetId) || null : null;
    const campaignId = adset?.campaign_id ? adset.campaign_id.toString() : null;
    const campaign = campaignId ? campaignsMap.get(campaignId) || null : null;
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
    }
  }

  // 🔍 THÊM LOG DEBUG CHI TIẾT
  console.log(`[${retrievedAtHourIso}] 🔍 DEBUG hourlyInsights:`, {
    totalAds: ads.length,
    insightsCreated: hourlyInsights.length,
    firstInsight: hourlyInsights[0] ? {
      ad_id: hourlyInsights[0].ad_id,
      account_id: hourlyInsights[0].account_id,
      retrieved_at_hour: hourlyInsights[0].retrieved_at_hour,
      hasPerformance: Boolean(performanceByAdId.get(ads[0]._id.toString()))
    } : null,
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

  // Lưu hourly insights vào database
  let upsertedCount = 0;
  if (hourlyInsights.length > 0) {
    try {
      const result = await AdHourlyInsight.insertMany(hourlyInsights, { 
        ordered: false 
      });
      upsertedCount = result.length;
      console.log(`[${retrievedAtHourIso}] ✅ Inserted ${upsertedCount} new hourly snapshots`);
    } catch (error) {
      console.error(`[${retrievedAtHourIso}] ❌ INSERT ERROR:`, {
        name: error.name,
        code: error.code,
        message: error.message,
        writeErrorsCount: error.writeErrors?.length,
        firstWriteError: error.writeErrors?.[0],
        validationErrors: error.errors
      });
      
      if (error.name === 'MongoBulkWriteError' && error.code === 11000) {
        const successCount = hourlyInsights.length - (error.writeErrors?.length || 0);
        upsertedCount = successCount;
        console.log(`[${retrievedAtHourIso}] ⚠️ Inserted ${successCount} snapshots, ${error.writeErrors?.length || 0} duplicates skipped`);
      } else {
        throw error;
      }
    }
  } else {
    console.log(`[${retrievedAtHourIso}] ⚠️ No hourly insights to insert (empty array)`);
  }

  console.log(`[${retrievedAtHourIso}] ✅ Synced hourly insights for account ${account.external_id || account._id}: processed ${ads.length} ads, upserted ${upsertedCount}, missing performance ${missingPerformanceCount} (retrieved_at_hour=${retrievedAtHourIso})`);

  return {
    retrievedAtHour: retrievedAtHourIso,
    processedAds: ads.length,
    upserts: upsertedCount,
    skipped: missingPerformanceCount,
  };
}
