import { tool } from "@langchain/core/tools";
import { z } from "zod";
import mongoose from "mongoose";
import AdPerformance from "../../models/ads/adPerformance.model.js";
// import AdHourlyInsight from "../../models/ads/adHourlyInsight.model.js"; // ❌ DISABLED: Feature removed
import AdsAccount from "../../models/ads/adsAccount.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";
import AnalyticsSnapshot from "../../models/analytics/analyticsSnapshot.model.js";

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getAccountObjectId(account_id) {
  // Check if it's already a valid MongoDB ObjectId
  if (account_id.match(/^[0-9a-fA-F]{24}$/)) {
    const account = await AdsAccount.findById(account_id).select("_id");
    if (account) return account._id;
  }

  // Otherwise, search by external_id (Facebook account ID)
  const hasPrefix = String(account_id).startsWith("act_");
  const account = await AdsAccount.findOne({
    $or: [
      { external_id: account_id },
      {
        external_id: hasPrefix
          ? account_id.slice(4)
          : `act_${account_id}`,
      },
    ],
  }).select("_id");

  if (!account) throw new Error(`Account ${account_id} not found`);
  return account._id;
}

function formatCurrency(value) {
  if (!value && value !== 0) return "0đ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value) {
  if (!value && value !== 0) return "0%";
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value) {
  if (!value && value !== 0) return "0";
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatMetric(metric, value) {
  switch (metric) {
    case "ctr":
      return formatPercent(value);
    case "cpc":
    case "cpm":
    case "spend":
    case "cost_per_result":
      return formatCurrency(value);
    default:
      return formatNumber(value);
  }
}

// ============================================
// NEW: UNIVERSAL QUERY DATA TOOL
// Replaces: get_overview, get_total_metrics, compare_entities, list_entities, get_ranking
// ============================================

export const queryDataTool = tool(
  async ({ account_id, query_type, entity_type, entity_ids, date_from, date_to, metric, limit }, config) => {
    try {
      const writer = config?.streamWriter;
      writer?.(`🔍 Đang truy vấn ${query_type}...`);

      const accountObjId = await getAccountObjectId(account_id);

      // QUERY TYPE 1: OVERVIEW (account or entity summary)
      if (query_type === "overview") {
        const matchStage = {
          account_id: accountObjId,
          date: {
            $gte: new Date(date_from),
            $lte: new Date(date_to),
          },
        };

        // If entity_ids provided, filter by them
        if (entity_ids && entity_ids.length > 0) {
          const fieldMap = {
            campaign: "external_campaign_id",
            adset: "external_adset_id",
            ad: "external_ad_id",
          };
          matchStage[fieldMap[entity_type || "campaign"]] = { $in: entity_ids };
        }

        const result = await AdPerformance.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: null,
              total_spend: { $sum: "$spend" },
              total_impressions: { $sum: "$impressions" },
              total_clicks: { $sum: "$clicks" },
              total_results: { $sum: "$results" },
              avg_ctr: { $avg: "$ctr" },
              avg_cpc: { $avg: "$cpc" },
              avg_cpm: { $avg: "$cpm" },
              days: { $addToSet: "$date" },
            },
          },
        ]);

        const data = result[0] || {};
        writer?.(`✅ Tìm thấy dữ liệu từ ${data.days?.length || 0} ngày`);

        return JSON.stringify({
          query_type: "overview",
          period: { from: date_from, to: date_to },
          entity_type: entity_type || "account",
          entity_ids: entity_ids || [],
          metrics: {
            spend: { value: data.total_spend || 0, formatted: formatCurrency(data.total_spend) },
            impressions: { value: data.total_impressions || 0, formatted: formatNumber(data.total_impressions) },
            clicks: { value: data.total_clicks || 0, formatted: formatNumber(data.total_clicks) },
            results: { value: data.total_results || 0, formatted: formatNumber(data.total_results) },
            ctr: { value: data.avg_ctr || 0, formatted: formatPercent(data.avg_ctr) },
            cpc: { value: data.avg_cpc || 0, formatted: formatCurrency(data.avg_cpc) },
            cpm: { value: data.avg_cpm || 0, formatted: formatCurrency(data.avg_cpm) },
          },
        });
      }

      // QUERY TYPE 2: COUNT (count campaigns/adsets/ads)
      if (query_type === "count") {
        const modelMap = {
          campaign: AdsCampaign,
          adset: AdsSet,
          ad: Ads,
        };
        
        let count;
        if (entity_type === "adset" || entity_type === "ad") {
          // AdsSet and Ads use external_account_id (String), not account_id (ObjectId)
          // Get account external_id: remove "act_" prefix if present
          const accountExternalId = account_id.startsWith('act_') 
            ? account_id.slice(4) 
            : account_id;
          
          count = await modelMap[entity_type || "campaign"].countDocuments({ 
            external_account_id: accountExternalId,
            status: { $ne: "DELETED" }
          });
        } else {
          // AdsCampaign uses account_id (ObjectId)
          count = await modelMap[entity_type || "campaign"].countDocuments({ 
            account_id: accountObjId,
            status: { $ne: "DELETED" }
          });
        }
        
        writer?.(`✅ Tìm thấy ${count} ${entity_type || "campaign"}`);

        return JSON.stringify({
          query_type: "count",
          entity_type: entity_type || "campaign",
          count,
        });
      }

      // QUERY TYPE 3: LIST (list campaigns/adsets/ads with basic info)
      if (query_type === "list") {
        const modelMap = {
          campaign: AdsCampaign,
          adset: AdsSet,
          ad: Ads,
        };
        const entities = await modelMap[entity_type || "campaign"]
          .find({ 
            account_id: accountObjId,
            status: { $ne: "DELETED" }
          })
          .select("name external_id status")
          .limit(limit || 20)
          .lean();

        writer?.(`✅ Tìm thấy ${entities.length} ${entity_type || "campaign"}`);

        return JSON.stringify({
          query_type: "list",
          entity_type: entity_type || "campaign",
          entities: entities.map(e => ({
            id: e.external_id,
            name: e.name,
            status: e.status,
          })),
        });
      }

      // QUERY TYPE 4: TOP_BOTTOM (best/worst performing entities)
      if (query_type === "top_bottom") {
        const dateFrom = new Date(date_from);
        const dateTo = new Date(date_to);
        const daysDiff = Math.ceil((dateTo - dateFrom) / (1000 * 60 * 60 * 24));
        
        // Get list of non-deleted entity IDs
        const modelMap = {
          campaign: AdsCampaign,
          adset: AdsSet,
          ad: Ads,
        };
        const activeEntities = await modelMap[entity_type || "campaign"]
          .find({ 
            account_id: accountObjId,
            status: { $ne: "DELETED" }
          })
          .select("external_id")
          .lean();
        
        const activeIds = activeEntities.map(e => e.external_id);
        
        // Try AdPerformance first (for recent data <= 90 days)
        let results = [];
        if (daysDiff <= 90) {
          const entityIdField = entity_type === "campaign" ? "external_campaign_id" : 
                                entity_type === "adset" ? "external_adset_id" : "external_ad_id";
          const fieldMap = {
            campaign: { group: "$external_campaign_id", name: "$campaign_name" },
            adset: { group: "$external_adset_id", name: "$adset_name" },
            ad: { group: "$external_ad_id", name: "$ad_name" },
          };
          const sortField = metric === "spend" ? "total_spend" : `avg_${metric}`;
          
          results = await AdPerformance.aggregate([
            {
              $match: {
                account_id: accountObjId,
                date: { $gte: dateFrom, $lte: dateTo },
                [entityIdField]: { $in: activeIds },
              },
            },
            {
              $group: {
                _id: fieldMap[entity_type || "campaign"].group,
                entity_name: { $first: fieldMap[entity_type || "campaign"].name },
                total_spend: { $sum: "$spend" },
                avg_ctr: { $avg: "$ctr" },
                avg_cpc: { $avg: "$cpc" },
                total_clicks: { $sum: "$clicks" },
              },
            },
            { $sort: { [sortField]: -1 } },
            { $limit: limit || 5 },
          ]);
        }
        
        // Fallback to AnalyticsSnapshot if no data or range > 90 days
        if (results.length === 0 || daysDiff > 90) {
          writer?.(`📊 Query từ AnalyticsSnapshot (lifetime data, filter theo campaign start_time)...`);
          
          // For campaigns: filter by start_time, then aggregate from AnalyticsSnapshot
          if (entity_type === "campaign" || !entity_type) {
            const campaigns = await AdsCampaign.find({
              account_id: accountObjId,
              status: { $ne: "DELETED" },
              start_time: { $gte: dateFrom, $lte: dateTo },
            })
              .select("_id external_id name")
              .lean();
            
            const campaignObjIds = campaigns.map(c => c._id);
            const campaignMap = new Map(campaigns.map(c => [c._id.toString(), c]));
            
            if (campaignObjIds.length > 0) {
              const sortField = metric === "spend" ? "total_spend" : `avg_${metric}`;
              const resultsFromSnapshot = await AnalyticsSnapshot.aggregate([
                {
                  $match: {
                    account_id: accountObjId,
                    campaign_id: { $in: campaignObjIds },
                  },
                },
                {
                  $group: {
                    _id: "$campaign_id",
                    entity_name: { $first: "$campaign_name" },
                    total_spend: { $sum: "$spend" },
                    avg_ctr: { $avg: "$ctr" },
                    avg_cpc: { $avg: "$cpc" },
                    total_clicks: { $sum: "$clicks" },
                  },
                },
                { $sort: { [sortField]: -1 } },
                { $limit: limit || 5 },
              ]);
              
              // Map campaign_id back to external_id
              results = resultsFromSnapshot.map(r => {
                const campaign = campaignMap.get(r._id.toString());
                return {
                  ...r,
                  _id: campaign?.external_id || r._id.toString(),
                  entity_name: campaign?.name || r.entity_name,
                };
              });
            }
          } else if (entity_type === "adset") {
            // For adsets: get adsets with campaigns in date range
            const campaigns = await AdsCampaign.find({
              account_id: accountObjId,
              status: { $ne: "DELETED" },
              start_time: { $gte: dateFrom, $lte: dateTo },
            })
              .select("_id")
              .lean();
            
            const campaignObjIds = campaigns.map(c => c._id);
            
            const adsets = await AdsSet.find({
              account_id: accountObjId,
              status: { $ne: "DELETED" },
              campaign_id: { $in: campaignObjIds },
            })
              .select("_id external_id name")
              .lean();
            
            const adsetObjIds = adsets.map(a => a._id);
            const adsetMap = new Map(adsets.map(a => [a._id.toString(), a]));
            
            if (adsetObjIds.length > 0) {
              const sortField = metric === "spend" ? "total_spend" : `avg_${metric}`;
              const resultsFromSnapshot = await AnalyticsSnapshot.aggregate([
                {
                  $match: {
                    account_id: accountObjId,
                    adset_id: { $in: adsetObjIds },
                  },
                },
                {
                  $group: {
                    _id: "$adset_id",
                    entity_name: { $first: "$adset_name" },
                    total_spend: { $sum: "$spend" },
                    avg_ctr: { $avg: "$ctr" },
                    avg_cpc: { $avg: "$cpc" },
                    total_clicks: { $sum: "$clicks" },
                  },
                },
                { $sort: { [sortField]: -1 } },
                { $limit: limit || 5 },
              ]);
              
              // Map adset_id back to external_id
              results = resultsFromSnapshot.map(r => {
                const adset = adsetMap.get(r._id.toString());
                return {
                  ...r,
                  _id: adset?.external_id || r._id.toString(),
                  entity_name: adset?.name || r.entity_name,
                };
              });
            }
          } else if (entity_type === "ad") {
            // For ads: get ads with campaigns in date range
            const campaigns = await AdsCampaign.find({
              account_id: accountObjId,
              status: { $ne: "DELETED" },
              start_time: { $gte: dateFrom, $lte: dateTo },
            })
              .select("_id")
              .lean();
            
            const campaignObjIds = campaigns.map(c => c._id);
            
            const adsets = await AdsSet.find({
              account_id: accountObjId,
              status: { $ne: "DELETED" },
              campaign_id: { $in: campaignObjIds },
            })
              .select("_id")
              .lean();
            
            const adsetObjIds = adsets.map(a => a._id);
            
            const ads = await Ads.find({
              account_id: accountObjId,
              status: { $ne: "DELETED" },
              set_id: { $in: adsetObjIds },
            })
              .select("_id external_id name")
              .lean();
            
            const adObjIds = ads.map(a => a._id);
            const adMap = new Map(ads.map(a => [a._id.toString(), a]));
            
            if (adObjIds.length > 0) {
              const sortField = metric === "spend" ? "total_spend" : `avg_${metric}`;
              const resultsFromSnapshot = await AnalyticsSnapshot.aggregate([
                {
                  $match: {
                    account_id: accountObjId,
                    ad_id: { $in: adObjIds },
                  },
                },
                {
                  $group: {
                    _id: "$ad_id",
                    entity_name: { $first: "$ad_name" },
                    total_spend: { $sum: "$spend" },
                    avg_ctr: { $avg: "$ctr" },
                    avg_cpc: { $avg: "$cpc" },
                    total_clicks: { $sum: "$clicks" },
                  },
                },
                { $sort: { [sortField]: -1 } },
                { $limit: limit || 5 },
              ]);
              
              // Map ad_id back to external_id
              results = resultsFromSnapshot.map(r => {
                const ad = adMap.get(r._id.toString());
                return {
                  ...r,
                  _id: ad?.external_id || r._id.toString(),
                  entity_name: ad?.name || r.entity_name,
                };
              });
            }
          }
        }

        writer?.(`✅ Tìm thấy ${results.length} ${entity_type || "campaign"}`);

        return JSON.stringify({
          query_type: "top_bottom",
          metric: metric || "spend",
          entity_type: entity_type || "campaign",
          results: results.map(r => ({
            id: r._id,
            name: r.entity_name,
            spend: { value: r.total_spend, formatted: formatCurrency(r.total_spend) },
            ctr: { value: r.avg_ctr, formatted: formatPercent(r.avg_ctr) },
            cpc: { value: r.avg_cpc, formatted: formatCurrency(r.avg_cpc) },
            clicks: { value: r.total_clicks, formatted: formatNumber(r.total_clicks) },
          })),
        });
      }

      throw new Error(`Unknown query_type: ${query_type}`);
    } catch (error) {
      console.error("Error in queryData:", error);
      throw error;
    }
  },
  {
    name: "query_data",
    description: `UNIVERSAL DATA QUERY TOOL - Có thể trả lời MỌI câu hỏi về dữ liệu quảng cáo.

Supported query_type:
- "overview": Tổng quan metrics (spend, CTR, CPC, clicks, results) cho account hoặc entity cụ thể
- "count": Đếm số lượng campaigns/adsets/ads  
- "list": Liệt kê danh sách campaigns/adsets/ads với tên và status
- "top_bottom": Tìm top/bottom entities theo metric (VD: top 3 campaigns theo CTR)

Examples:
- "Chi tiêu hôm nay?" → query_type=overview, không cần entity_ids
- "Campaign X thế nào?" → query_type=overview, entity_ids=['X']
- "Có bao nhiêu chiến dịch?" → query_type=count, entity_type=campaign
- "Campaign nào tốt nhất?" → query_type=top_bottom, metric=ctr`,
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      query_type: z.enum(["overview", "count", "list", "top_bottom"]).describe("Loại query cần thực hiện"),
      entity_type: z.enum(["campaign", "adset", "ad"]).optional().describe("Loại entity (mặc định: campaign)"),
      entity_ids: z.array(z.string()).optional().describe("Danh sách external IDs của entities cần query"),
      date_from: z.string().describe("Ngày bắt đầu YYYY-MM-DD"),
      date_to: z.string().describe("Ngày kết thúc YYYY-MM-DD"),
      metric: z.string().optional().describe("Metric để sort/filter (spend, ctr, cpc,...)"),
      limit: z.number().optional().describe("Giới hạn số kết quả (mặc định: 20 cho list, 5 cho top_bottom)"),
    }),
  }
);

// ============================================
// TOOL 3: GET TREND
// ============================================

export const getTrendTool = tool(
  async (
    { account_id, metric, granularity, date_from, date_to, campaign_id, adset_id, ad_id }, // Added adset_id, ad_id
    config
  ) => {
    try {
      const writer = config?.streamWriter;
      writer?.(`📈 Đang phân tích xu hướng ${metric}...`);

      const accountObjId = await getAccountObjectId(account_id);

      const matchStage = {
        account_id: accountObjId,
        date: {
          $gte: new Date(date_from),
          $lte: new Date(date_to),
        },
      };

      if (campaign_id) {
        const campaign = await AdsCampaign.findOne({
          external_id: campaign_id,
        });
        if (campaign) {
          matchStage.campaign_id = campaign._id;
        }
      } else if (adset_id) { // Added adset_id logic
        const adset = await AdsSet.findOne({
            external_id: adset_id,
        });
        if (adset) {
            matchStage.set_id = adset._id;
        }
      } else if (ad_id) { // Added ad_id logic
        const ad = await Ads.findOne({
            external_id: ad_id,
        });
        if (ad) {
            matchStage.ads_id = ad._id;
        }
      } else {
        matchStage.campaign_id = null; // Default to account-level if no specific entity
      }

      // ❌ HOURLY INSIGHTS FEATURE DISABLED
      if (granularity === "hour") {
        writer?.(`⚠️ Hourly insights không còn khả dụng. Vui lòng sử dụng granularity='day' thay thế.`);
        
        return JSON.stringify({
          error: "FEATURE_DISABLED",
          message: "Hourly insights feature has been disabled. Please use 'day' granularity instead.",
          suggestion: "Try: analyze_metric_trend with granularity='day' for daily performance data.",
          available_granularities: ["day"],
        });
      }

      // ✅ Query từ AdPerformance và aggregate theo ngày
      const trend = await AdPerformance.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$date",
            spend: { $sum: "$spend" },
            impressions: { $sum: "$impressions" },
            clicks: { $sum: "$clicks" },
            results: { $sum: "$results" },
            ctr: { $avg: "$ctr" },
            cpc: { $avg: "$cpc" },
            cpm: { $avg: "$cpm" },
          },
        },
        { $sort: { _id: 1 } }, // Sort by date
      ]);

      const metricFieldMap = {
        spend: "spend",
        ctr: "ctr",
        cpc: "cpc",
        cpm: "cpm",
        impressions: "impressions",
        clicks: "clicks",
        results: "results",
      };

      const metricField = metricFieldMap[metric] || "spend";

      const dataPoints = trend.map((t) => ({
        timestamp: new Date(t._id).toISOString().split("T")[0],
        value: {
          value: t[metricField] || 0,
          formatted: formatMetric(metric, t[metricField] || 0),
        },
      }));

      writer?.(`✅ Đã phân tích ${trend.length} điểm dữ liệu`);

      // Detect trend direction
      const firstValue = dataPoints[0]?.value.value || 0;
      const lastValue =
        dataPoints[dataPoints.length - 1]?.value.value || 0;
      const changePercentage =
        firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

      let trendDirection = "stable";
      if (Math.abs(changePercentage) > 5) {
        trendDirection = changePercentage > 0 ? "increasing" : "decreasing";
      }

      return JSON.stringify({
        metric,
        granularity: granularity || "day",
        data_points: dataPoints,
        trend_direction: trendDirection,
        change_percentage: changePercentage,
      });
    } catch (error) {
      console.error("Error in getTrend:", error);
      throw error;
    }
  },
  {
    name: "get_trend",
    description:
      "VẼ BIỂU ĐỒ/XU HƯỚNG. Dùng khi user hỏi về sự thay đổi theo thời gian. Ví dụ: 'Biểu đồ chi tiêu', 'Xu hướng CPC tăng hay giảm', 'Diễn biến trong tuần qua', 'Khung giờ nào hiệu quả nhất'.",
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      date_from: z.string().describe("Ngày bắt đầu"),
      date_to: z.string().describe("Ngày kết thúc"),
      metric: z
        .enum(["spend", "ctr", "cpc", "cpm", "impressions", "clicks", "results"])
        .describe("Chỉ số cần xem xu hướng. Nếu user hỏi chung chung 'hiệu suất', hãy chọn 'results' hoặc 'spend'."),
      granularity: z
        .enum(["day", "hour"])
        .optional()
        .describe("Chọn 'hour' nếu user hỏi về 'khung giờ', 'trong ngày'. Chọn 'day' cho các trường hợp còn lại."),
      campaign_id: z.string().optional().describe("ID chiến dịch nếu user muốn xem trend của riêng 1 camp."),
      adset_id: z.string().optional().describe("ID nhóm quảng cáo nếu user muốn xem trend của riêng 1 adset."),
      ad_id: z.string().optional().describe("ID quảng cáo nếu user muốn xem trend của riêng 1 ad."),
    }),
  }
);

// ============================================
// RANK CAMPAIGNS/ADSETS TOOL
// ============================================

function normalizeObjective(objectiveRaw) {
  if (!objectiveRaw) return null;
  
  const upper = objectiveRaw.toUpperCase();
  
  if (upper.startsWith("OUTCOME_")) {
    return upper;
  }
  
  const mapping = {
    "CONVERSIONS": "OUTCOME_SALES",
    "CATALOG_SALES": "OUTCOME_SALES",
    "STORE_VISITS": "OUTCOME_SALES",
    "LEAD_GENERATION": "OUTCOME_LEADS",
    "MESSAGES": "OUTCOME_LEADS",
    "LINK_CLICKS": "OUTCOME_TRAFFIC",
    "BRAND_AWARENESS": "OUTCOME_AWARENESS",
    "REACH": "OUTCOME_AWARENESS",
    "POST_ENGAGEMENT": "OUTCOME_ENGAGEMENT",
    "PAGE_LIKES": "OUTCOME_ENGAGEMENT",
    "APP_INSTALLS": "OUTCOME_APP_PROMOTION",
  };
  
  return mapping[upper] || null;
}

function getMinThresholds(objective) {
  const thresholds = {
    OUTCOME_SALES: { minSpend: 100000, minResults: 3 },
    OUTCOME_LEADS: { minSpend: 100000, minResults: 5 },
    OUTCOME_TRAFFIC: { minSpend: 50000, minResults: 100 },
    OUTCOME_AWARENESS: { minSpend: 50000, minResults: 1000 },
    OUTCOME_ENGAGEMENT: { minSpend: 50000, minResults: 50 },
    OUTCOME_APP_PROMOTION: { minSpend: 100000, minResults: 3 },
  };
  
  return thresholds[objective] || { minSpend: 50000, minResults: 1 };
}

function getResultsField(objective) {
  const fields = {
    OUTCOME_SALES: "purchases_total",
    OUTCOME_LEADS: "leads_total",
    OUTCOME_TRAFFIC: "link_clicks_total",
    OUTCOME_AWARENESS: "impressions_total",
    OUTCOME_ENGAGEMENT: "post_engagement_total",
    OUTCOME_APP_PROMOTION: "mobile_app_install_total",
  };
  
  return fields[objective] || "results_total";
}

function calculateKPIs(totals) {
  const kpis = {};
  
  if (totals.impressions_total > 0) {
    kpis.ctr = (totals.clicks_total / totals.impressions_total) * 100;
    kpis.cpm = (totals.spend_total / totals.impressions_total) * 1000;
    kpis.link_ctr = (totals.link_clicks_total / totals.impressions_total) * 100;
  }
  
  if (totals.clicks_total > 0) {
    kpis.cpc = totals.spend_total / totals.clicks_total;
  }
  
  if (totals.link_clicks_total > 0) {
    kpis.link_cpc = totals.spend_total / totals.link_clicks_total;
  }
  
  if (totals.post_engagement_total > 0) {
    kpis.cpe = totals.spend_total / totals.post_engagement_total;
  }
  
  if (totals.leads_total > 0) {
    kpis.cpl = totals.spend_total / totals.leads_total;
  }
  
  if (totals.purchases_total > 0) {
    kpis.cpa = totals.spend_total / totals.purchases_total;
  }
  
  return kpis;
}

function normalizeMetric(value, min, max, lowerIsBetter = false) {
  if (min === max || max === 0) return 0.5;
  
  const norm = (value - min) / (max - min);
  return lowerIsBetter ? 1 - norm : norm;
}

function calculateScore(entity, objective, allEntities) {
  const primaryKPIs = {
    OUTCOME_SALES: { field: "cpa", lowerIsBetter: true, weight: 0.5 },
    OUTCOME_LEADS: { field: "cpl", lowerIsBetter: true, weight: 0.5 },
    OUTCOME_TRAFFIC: { field: "link_ctr", lowerIsBetter: false, weight: 0.5 },
    OUTCOME_AWARENESS: { field: "cpm", lowerIsBetter: true, weight: 0.5 },
    OUTCOME_ENGAGEMENT: { field: "cpe", lowerIsBetter: true, weight: 0.5 },
    OUTCOME_APP_PROMOTION: { field: "cpa", lowerIsBetter: true, weight: 0.5 },
  };
  
  const primaryKPI = primaryKPIs[objective];
  if (!primaryKPI) return 0;
  
  const values = allEntities
    .map(e => e.kpis?.[primaryKPI.field])
    .filter(v => v != null && v > 0);
  
  if (values.length === 0) {
    const efficiencyValues = allEntities
      .map(e => e.efficiency_per_100k)
      .filter(v => v != null);
    if (efficiencyValues.length === 0) return 0;
    const efficiencyMin = Math.min(...efficiencyValues);
    const efficiencyMax = Math.max(...efficiencyValues);
    const efficiencyNorm = normalizeMetric(entity.efficiency_per_100k || 0, efficiencyMin, efficiencyMax, false);
    return efficiencyNorm * 0.85;
  }
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const primaryValue = entity.kpis?.[primaryKPI.field] || 0;
  const primaryNorm = normalizeMetric(primaryValue, min, max, primaryKPI.lowerIsBetter);
  
  const efficiencyValues = allEntities
    .map(e => e.efficiency_per_100k)
    .filter(v => v != null);
  const efficiencyMin = Math.min(...efficiencyValues);
  const efficiencyMax = Math.max(...efficiencyValues);
  const efficiencyNorm = normalizeMetric(entity.efficiency_per_100k || 0, efficiencyMin, efficiencyMax, false);
  
  const maxSpend = Math.max(...allEntities.map(e => e.totals.spend_total));
  const volumeBonus = Math.min(Math.sqrt(entity.totals.spend_total / maxSpend), 1) * 0.05;
  
  const score = (primaryNorm * primaryKPI.weight) + (efficiencyNorm * 0.35) + (volumeBonus);
  
  return Math.max(0, Math.min(1, score));
}

function generateWhy(entity, objective) {
  const why = [];
  const kpis = entity.kpis || {};
  
  switch (objective) {
    case "OUTCOME_SALES":
      if (kpis.cpa && kpis.cpa < 20000) why.push(`CPA thấp (${formatCurrency(kpis.cpa)})`);
      if (entity.efficiency_per_100k > 5) why.push(`Hiệu quả cao: ${entity.efficiency_per_100k.toFixed(2)} purchases/100k₫`);
      break;
    case "OUTCOME_LEADS":
      if (kpis.cpl < 50000) why.push(`CPL thấp (${formatCurrency(kpis.cpl)})`);
      if (entity.efficiency_per_100k > 2) why.push(`Hiệu quả cao: ${entity.efficiency_per_100k.toFixed(2)} leads/100k₫`);
      break;
    case "OUTCOME_TRAFFIC":
      if (kpis.link_ctr > 2) why.push(`Link CTR cao (${kpis.link_ctr.toFixed(2)}%)`);
      if (kpis.link_cpc < 5000) why.push(`Link CPC thấp (${formatCurrency(kpis.link_cpc)})`);
      if (entity.efficiency_per_100k > 10) why.push(`Hiệu quả cao: ${entity.efficiency_per_100k.toFixed(2)} link clicks/100k₫`);
      break;
    case "OUTCOME_AWARENESS":
      if (kpis.cpm < 5000) why.push(`CPM thấp (${formatCurrency(kpis.cpm)})`);
      if (entity.efficiency_per_100k > 1000) why.push(`Hiệu quả cao: ${entity.efficiency_per_100k.toFixed(0)} impressions/100k₫`);
      break;
    case "OUTCOME_ENGAGEMENT":
      if (kpis.cpe < 10000) why.push(`CPE thấp (${formatCurrency(kpis.cpe)})`);
      if (entity.efficiency_per_100k > 5) why.push(`Hiệu quả cao: ${entity.efficiency_per_100k.toFixed(2)} engagements/100k₫`);
      break;
    case "OUTCOME_APP_PROMOTION":
      if (kpis.cpa < 50000) why.push(`CPA thấp (${formatCurrency(kpis.cpa)})`);
      if (entity.efficiency_per_100k > 0.5) why.push(`Hiệu quả cao: ${entity.efficiency_per_100k.toFixed(2)} installs/100k₫`);
      break;
  }
  
  if (why.length === 0) {
    why.push("Performance tốt trong khoảng thời gian này");
  }
  
  return why;
}

export const rankCampaignsTool = tool(
  async ({ account_id, level, objective, date_from, date_to, top_n, sort_by_metric }, config) => {
    try {
      const writer = config?.streamWriter;
      writer?.("🔍 Đang xếp hạng campaigns/adsets...");
      
      const accountObjId = await getAccountObjectId(account_id);
      const today = new Date().toISOString().split('T')[0];
      
      const fromUser = new Date(date_from);
      const toUser = new Date(date_to > today ? today : date_to);
      
      writer?.("📅 Đang xác định tracking_start_date...");
      
      const trackingStartResult = await AdPerformance.aggregate([
        {
          $match: { account_id: accountObjId }
        },
        {
          $group: {
            _id: null,
            min_date: { $min: "$date" }
          }
        }
      ]);
      
      if (!trackingStartResult.length || !trackingStartResult[0].min_date) {
        return JSON.stringify({
          error: "Không có dữ liệu",
          message: "Hệ thống chưa có dữ liệu tracking cho account này."
        });
      }
      
      const trackingStartDate = new Date(trackingStartResult[0].min_date);
      const fromEffective = fromUser > trackingStartDate ? fromUser : trackingStartDate;
      const toEffective = toUser;
      
      if (toEffective < trackingStartDate) {
        return JSON.stringify({
          error: "Không có dữ liệu",
          message: "Không có dữ liệu trong khoảng thời gian user yêu cầu."
        });
      }
      
      const baseDate = new Date(fromEffective);
      baseDate.setDate(baseDate.getDate() - 1);
      
      const dataCoverageNotes = [];
      if (fromEffective.getTime() !== fromUser.getTime()) {
        dataCoverageNotes.push(
          `Hệ thống chỉ có dữ liệu từ ngày ${trackingStartDate.toISOString().split('T')[0]}, nên kết quả được tính từ ${fromEffective.toISOString().split('T')[0]} đến ${toEffective.toISOString().split('T')[0]}.`
        );
      }
      
      writer?.("📊 Đang lấy snapshots...");
      
      const allSnapshots = await AdPerformance.aggregate([
        {
          $match: {
            account_id: accountObjId,
            date: { $lte: toEffective }
          }
        },
        {
          $sort: { ads_id: 1, date: -1 }
        }
      ]);
      
      const snapshotsByAd = {};
      let countNoBaseline = 0;
      
      for (const snap of allSnapshots) {
        const adId = snap.ads_id.toString();
        
        if (!snapshotsByAd[adId]) {
          snapshotsByAd[adId] = { endSnap: null, baseSnap: null };
        }
        
        if (!snapshotsByAd[adId].endSnap && snap.date <= toEffective) {
          snapshotsByAd[adId].endSnap = snap;
        }
        
        if (!snapshotsByAd[adId].baseSnap && snap.date <= baseDate) {
          snapshotsByAd[adId].baseSnap = snap;
        }
      }
      
      writer?.("🧮 Đang tính delta...");
      
      const deltasByAd = {};
      
      for (const [adId, snaps] of Object.entries(snapshotsByAd)) {
        if (!snaps.endSnap) continue;
        
        const baseSnap = snaps.baseSnap || {
          spend: 0,
          website_purchases: 0,
          leads: 0,
          link_clicks: 0,
          impressions: 0,
          clicks: 0,
          post_engagement: 0,
          reach: 0,
          mobile_app_install: 0,
        };
        
        if (!snaps.baseSnap) {
          countNoBaseline++;
        }
        
        deltasByAd[adId] = {
          spend_range: Math.max(0, snaps.endSnap.spend - (baseSnap.spend || 0)),
          purchases_range: Math.max(0, (snaps.endSnap.website_purchases || 0) - (baseSnap.website_purchases || 0)),
          leads_range: Math.max(0, (snaps.endSnap.leads || 0) - (baseSnap.leads || 0)),
          link_clicks_range: Math.max(0, (snaps.endSnap.link_clicks || 0) - (baseSnap.link_clicks || 0)),
          impressions_range: Math.max(0, snaps.endSnap.impressions - (baseSnap.impressions || 0)),
          clicks_range: Math.max(0, snaps.endSnap.clicks - (baseSnap.clicks || 0)),
          post_engagement_range: Math.max(0, (snaps.endSnap.post_engagement || 0) - (baseSnap.post_engagement || 0)),
          reach_range: Math.max(0, snaps.endSnap.reach - (baseSnap.reach || 0)),
          mobile_app_install_range: Math.max(0, (snaps.endSnap.mobile_app_install || 0) - (baseSnap.mobile_app_install || 0)),
          campaign_id: snaps.endSnap.campaign_id,
          set_id: snaps.endSnap.set_id,
        };
      }
      
      if (countNoBaseline > 0) {
        const totalAds = Object.keys(deltasByAd).length;
        dataCoverageNotes.push(
          `Có ${countNoBaseline}/${totalAds} ads không có snapshot trước ngày bắt đầu tính (baseline=0), thường do ads mới tạo hoặc hệ thống bắt đầu tracking sau đó.`
        );
      }
      
      writer?.("📦 Đang group theo level...");
      
      let groups = {};
      let metaMap = {};
      
      if (level === "ad") {
        for (const [adId, delta] of Object.entries(deltasByAd)) {
          if (!adId) continue;
          
          groups[adId] = {
            spend_total: delta.spend_range,
            purchases_total: delta.purchases_range,
            leads_total: delta.leads_range,
            link_clicks_total: delta.link_clicks_range,
            impressions_total: delta.impressions_range,
            clicks_total: delta.clicks_range,
            post_engagement_total: delta.post_engagement_range,
            reach_total: delta.reach_range,
            mobile_app_install_total: delta.mobile_app_install_range,
          };
        }
        
        writer?.("🔗 Đang join meta cho ads với parent info...");
        
        const adIds = Object.keys(groups).map(id => new mongoose.Types.ObjectId(id));
        const adsWithParents = await Ads.find({
          _id: { $in: adIds },
          status: { $ne: "DELETED" }
        })
          .select("_id name status set_id")
          .populate({
            path: "set_id",
            select: "_id name campaign_id",
            populate: {
              path: "campaign_id",
              select: "_id name"
            }
          })
          .lean();
        
        for (const ad of adsWithParents) {
          const adIdStr = ad._id.toString();
          metaMap[adIdStr] = {
            name: ad.name,
            objective: null,
            status: ad.status,
            start_time: null,
            adset_id: ad.set_id?._id?.toString() || null,
            adset_name: ad.set_id?.name || null,
            campaign_id: ad.set_id?.campaign_id?._id?.toString() || null,
            campaign_name: ad.set_id?.campaign_id?.name || null,
          };
        }
      } else {
        const groupField = level === "campaign" ? "campaign_id" : "set_id";
        
        for (const [adId, delta] of Object.entries(deltasByAd)) {
          const groupId = delta[groupField];
          if (!groupId) continue;
          
          const groupIdStr = groupId.toString();
          if (!groups[groupIdStr]) {
            groups[groupIdStr] = {
              spend_total: 0,
              purchases_total: 0,
              leads_total: 0,
              link_clicks_total: 0,
              impressions_total: 0,
              clicks_total: 0,
              post_engagement_total: 0,
              reach_total: 0,
              mobile_app_install_total: 0,
            };
          }
          
          groups[groupIdStr].spend_total += delta.spend_range;
          groups[groupIdStr].purchases_total += delta.purchases_range;
          groups[groupIdStr].leads_total += delta.leads_range;
          groups[groupIdStr].link_clicks_total += delta.link_clicks_range;
          groups[groupIdStr].impressions_total += delta.impressions_range;
          groups[groupIdStr].clicks_total += delta.clicks_range;
          groups[groupIdStr].post_engagement_total += delta.post_engagement_range;
          groups[groupIdStr].reach_total += delta.reach_range;
          groups[groupIdStr].mobile_app_install_total += delta.mobile_app_install_range;
        }
        
        writer?.("🔗 Đang join meta...");
        
        const Model = level === "campaign" ? AdsCampaign : AdsSet;
        const groupIds = Object.keys(groups).map(id => new mongoose.Types.ObjectId(id));
        
        const metaEntities = await Model.find({
          _id: { $in: groupIds },
          status: { $ne: "DELETED" },
          start_time: { $lte: toEffective }
        })
          .select("_id name objective status start_time")
          .lean();
        
        for (const meta of metaEntities) {
          metaMap[meta._id.toString()] = meta;
        }
      }
      
      writer?.("✅ Đang tính KPI và ranking...");
      
      const entities = [];
      const othersNotes = [];
      
      for (const [groupIdStr, totals] of Object.entries(groups)) {
        const meta = metaMap[groupIdStr];
        if (!meta) continue;
        
        let objectiveNormalized = normalizeObjective(meta.objective);
        
        if (level === "ad" && !objectiveNormalized) {
          const adSnap = allSnapshots.find(s => s.ads_id && s.ads_id.toString() === groupIdStr);
          if (adSnap && adSnap.objective) {
            objectiveNormalized = normalizeObjective(adSnap.objective);
          }
        }
        
        if (objective && objectiveNormalized !== objective) continue;
        
        const kpis = calculateKPIs(totals);
        const resultsField = getResultsField(objectiveNormalized);
        const resultsTotal = totals[resultsField] || 0;
        
        const efficiencyPer100k = totals.spend_total > 0 
          ? (resultsTotal / totals.spend_total) * 100000 
          : 0;
        
        entities.push({
          entity_id: groupIdStr,
          name: meta.name,
          objective: objectiveNormalized,
          totals,
          kpis,
          efficiency_per_100k: efficiencyPer100k,
        });
      }
      
      if (objective) {
        const filtered = entities.filter(e => e.objective === objective);
        const allFiltered = filtered.map(e => ({
          ...e,
          score: calculateScore(e, objective, filtered),
        }));
        
        if (sort_by_metric) {
          const metricMap = {
            ctr: (e) => e.kpis?.ctr || 0,
            cpc: (e) => e.kpis?.cpc || Infinity,
            cpm: (e) => e.kpis?.cpm || Infinity,
            cpa: (e) => e.kpis?.cpa || Infinity,
            cpl: (e) => e.kpis?.cpl || Infinity,
            spend: (e) => e.totals.spend_total || 0,
          };
          
          const getValue = metricMap[sort_by_metric.toLowerCase()];
          if (getValue) {
            const isLowerBetter = ['cpc', 'cpm', 'cpa', 'cpl'].includes(sort_by_metric.toLowerCase());
            allFiltered.sort((a, b) => {
              const valA = getValue(a);
              const valB = getValue(b);
              return isLowerBetter ? valA - valB : valB - valA;
            });
          } else {
            allFiltered.sort((a, b) => b.score - a.score);
          }
        } else {
          allFiltered.sort((a, b) => b.score - a.score);
        }
        
        const top = allFiltered.slice(0, top_n || 5).map(e => {
          const base = {
            entity_id: e.entity_id,
            name: e.name,
            spend: { value: e.totals.spend_total, formatted: formatCurrency(e.totals.spend_total) },
            purchases: { value: e.totals.purchases_total, formatted: formatNumber(e.totals.purchases_total) },
            leads: { value: e.totals.leads_total, formatted: formatNumber(e.totals.leads_total) },
            link_clicks: { value: e.totals.link_clicks_total, formatted: formatNumber(e.totals.link_clicks_total) },
            impressions: { value: e.totals.impressions_total, formatted: formatNumber(e.totals.impressions_total) },
            cpa: e.kpis.cpa ? { value: e.kpis.cpa, formatted: formatCurrency(e.kpis.cpa) } : null,
            cpl: e.kpis.cpl ? { value: e.kpis.cpl, formatted: formatCurrency(e.kpis.cpl) } : null,
            efficiency_per_100k: { value: e.efficiency_per_100k, formatted: e.efficiency_per_100k.toFixed(2) },
            score: { value: e.score, formatted: `${(e.score * 100).toFixed(1)}%` },
            why: generateWhy(e, objective),
          };
          
          if (level === "ad" && metaMap[e.entity_id]) {
            const meta = metaMap[e.entity_id];
            base.adset_id = meta.adset_id;
            base.adset_name = meta.adset_name;
            base.campaign_id = meta.campaign_id;
            base.campaign_name = meta.campaign_name;
          }
          
          return base;
        });
        
        return JSON.stringify({
          date_range_user: {
            from: date_from,
            to: date_to,
          },
          date_range_effective: {
            from: fromEffective.toISOString().split('T')[0],
            to: toEffective.toISOString().split('T')[0],
          },
          tracking_start_date: trackingStartDate.toISOString().split('T')[0],
          data_coverage_notes: dataCoverageNotes,
          level,
          objective,
          total_entities: entities.length,
          valid_entities: filtered.length,
          top,
          others_notes: othersNotes,
        });
      } else {
        const grouped = {};
        for (const e of entities) {
          if (!grouped[e.objective]) grouped[e.objective] = [];
          grouped[e.objective].push(e);
        }
        
        const resultGroups = {};
        for (const [obj, ents] of Object.entries(grouped)) {
          const withScores = ents.map(e => ({
            ...e,
            score: calculateScore(e, obj, ents),
          }));
          
          if (sort_by_metric) {
            const metricMap = {
              ctr: (e) => e.kpis?.ctr || 0,
              cpc: (e) => e.kpis?.cpc || Infinity,
              cpm: (e) => e.kpis?.cpm || Infinity,
              cpa: (e) => e.kpis?.cpa || Infinity,
              cpl: (e) => e.kpis?.cpl || Infinity,
              spend: (e) => e.totals.spend_total || 0,
            };
            
            const getValue = metricMap[sort_by_metric.toLowerCase()];
            if (getValue) {
              const isLowerBetter = ['cpc', 'cpm', 'cpa', 'cpl'].includes(sort_by_metric.toLowerCase());
              withScores.sort((a, b) => {
                const valA = getValue(a);
                const valB = getValue(b);
                return isLowerBetter ? valA - valB : valB - valA;
              });
            } else {
              withScores.sort((a, b) => b.score - a.score);
            }
          } else {
            withScores.sort((a, b) => b.score - a.score);
          }
          
          resultGroups[obj] = withScores.slice(0, top_n || 5).map(e => ({
            entity_id: e.entity_id,
            name: e.name,
            spend: { value: e.totals.spend_total, formatted: formatCurrency(e.totals.spend_total) },
            purchases: { value: e.totals.purchases_total, formatted: formatNumber(e.totals.purchases_total) },
            leads: { value: e.totals.leads_total, formatted: formatNumber(e.totals.leads_total) },
            link_clicks: { value: e.totals.link_clicks_total, formatted: formatNumber(e.totals.link_clicks_total) },
            impressions: { value: e.totals.impressions_total, formatted: formatNumber(e.totals.impressions_total) },
            cpa: e.kpis.cpa ? { value: e.kpis.cpa, formatted: formatCurrency(e.kpis.cpa) } : null,
            cpl: e.kpis.cpl ? { value: e.kpis.cpl, formatted: formatCurrency(e.kpis.cpl) } : null,
            efficiency_per_100k: { value: e.efficiency_per_100k, formatted: e.efficiency_per_100k.toFixed(2) },
            score: { value: e.score, formatted: `${(e.score * 100).toFixed(1)}%` },
            why: generateWhy(e, obj),
          }));
        }
        
        return JSON.stringify({
          date_range_user: {
            from: date_from,
            to: date_to,
          },
          date_range_effective: {
            from: fromEffective.toISOString().split('T')[0],
            to: toEffective.toISOString().split('T')[0],
          },
          tracking_start_date: trackingStartDate.toISOString().split('T')[0],
          data_coverage_notes: dataCoverageNotes,
          level,
          objective: null,
          total_entities: entities.length,
          valid_entities: entities.length,
          groups: resultGroups,
          others_notes: othersNotes,
        });
      }
    } catch (error) {
      console.error("[rankCampaignsTool] Error:", error);
      return JSON.stringify({
        error: "Lỗi khi xếp hạng",
        message: error.message,
      });
    }
  },
  {
    name: "rank_campaigns",
    description: "Xếp hạng campaigns hoặc adsets theo hiệu quả trong khoảng thời gian. Dùng khi user hỏi 'campaign nào hiệu quả nhất', 'adset tốt nhất', 'top campaigns'.",
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      level: z.enum(["campaign", "adset", "ad"]).describe("Level cần xếp hạng: campaign, adset, hoặc ad"),
      objective: z.enum(["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_APP_PROMOTION"]).nullable().describe("Objective cụ thể hoặc null để xếp hạng tất cả"),
      date_from: z.string().describe("Ngày bắt đầu (YYYY-MM-DD)"),
      date_to: z.string().describe("Ngày kết thúc (YYYY-MM-DD)"),
      top_n: z.number().optional().describe("Số lượng top entities cần trả về. Mặc định: 5"),
      sort_by_metric: z.enum(["ctr", "cpc", "cpm", "cpa", "cpl", "spend"]).nullable().optional().describe("Metric để sort (ctr, cpc, cpm, cpa, cpl, spend). Nếu null thì sort theo score"),
    }),
  }
);

export const getEntityMetadataTool = tool(
  async ({ account_id, entity_type, entity_ids }, config) => {
    try {
      const writer = config?.streamWriter;
      writer?.("🔍 Đang lấy metadata và relationship...");
      
      const accountObjId = await getAccountObjectId(account_id);
      
      if (entity_type === "ad") {
        const ads = await Ads.find({
          _id: { $in: entity_ids.map(id => new mongoose.Types.ObjectId(id)) },
          account_id: accountObjId
        })
          .select("_id name set_id")
          .populate({
            path: "set_id",
            select: "_id name campaign_id",
            populate: {
              path: "campaign_id",
              select: "_id name"
            }
          })
          .lean();
        
        return JSON.stringify({
          entity_type: "ad",
          entities: ads.map(ad => ({
            ad_id: ad._id.toString(),
            ad_name: ad.name,
            adset_id: ad.set_id?._id?.toString() || null,
            adset_name: ad.set_id?.name || null,
            campaign_id: ad.set_id?.campaign_id?._id?.toString() || null,
            campaign_name: ad.set_id?.campaign_id?.name || null,
          }))
        });
      }
      
      if (entity_type === "adset") {
        const adsets = await AdsSet.find({
          _id: { $in: entity_ids.map(id => new mongoose.Types.ObjectId(id)) },
          account_id: accountObjId
        })
          .select("_id name campaign_id")
          .populate({
            path: "campaign_id",
            select: "_id name"
          })
          .lean();
        
        return JSON.stringify({
          entity_type: "adset",
          entities: adsets.map(adset => ({
            adset_id: adset._id.toString(),
            adset_name: adset.name,
            campaign_id: adset.campaign_id?._id?.toString() || null,
            campaign_name: adset.campaign_id?.name || null,
          }))
        });
      }
      
      if (entity_type === "campaign") {
        const campaigns = await AdsCampaign.find({
          _id: { $in: entity_ids.map(id => new mongoose.Types.ObjectId(id)) },
          account_id: accountObjId
        })
          .select("_id name")
          .lean();
        
        return JSON.stringify({
          entity_type: "campaign",
          entities: campaigns.map(campaign => ({
            campaign_id: campaign._id.toString(),
            campaign_name: campaign.name,
          }))
        });
      }
      
      throw new Error(`Unsupported entity_type: ${entity_type}`);
    } catch (error) {
      console.error("[getEntityMetadataTool] Error:", error);
      throw error;
    }
  },
  {
    name: "get_entity_metadata",
    description: `Lấy thông tin metadata và relationship của entities (ads → adset → campaign).
    
Dùng khi user hỏi về:
- "ads này thuộc adset/campaign nào?"
- "adset này thuộc campaign nào?"
- "campaign này có những adset/ads nào?"
- Bất kỳ câu hỏi về quan hệ giữa entities

Input: entity_type và danh sách entity_ids cần query
Output: Thông tin đầy đủ về entity và parent/children`,
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      entity_type: z.enum(["ad", "adset", "campaign"]).describe("Loại entity cần query metadata"),
      entity_ids: z.array(z.string()).describe("Danh sách entity IDs (ObjectId strings) cần query"),
    }),
  }
);

export const analyticsTools = [
  queryDataTool, // Universal data query tool
  getTrendTool,  // Trend analysis tool
  rankCampaignsTool, // Rank campaigns/adsets tool
  getEntityMetadataTool, // Get entity metadata and relationships
];

// ============================================
// OLD TOOLS - Replaced by queryDataTool
// Kept here for reference/rollback if needed
// ============================================
// - getTotalMetricsTool (replaced by query_data with query_type=overview)
// - compareEntitiesTool (replaced by query_data with query_type=overview + entity_ids)
// - getRankingTool (replaced by query_data with query_type=top_bottom)
// - getOverviewTool (replaced by query_data with query_type=count)
// - listEntitiesTool (replaced by query_data with query_type=list)

