import { tool } from "@langchain/core/tools";
import { z } from "zod";
import AdPerformance from "../../models/ads/adPerformance.model.js";
import AdPerformanceDailySummary from "../../models/ads/adPerformanceDailySummary.model.js";
import AdPerformanceCampaignDaily from "../../models/ads/adPerformanceCampaignDaily.model.js";
import AdPerformanceTrendDaily from "../../models/ads/adPerformanceTrendDaily.model.js";
import AdHourlyInsight from "../../models/ads/adHourlyInsight.model.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";

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
// TOOL 1: GET TOTAL METRICS
// ============================================

export const getTotalMetricsTool = tool(
  async ({ account_id, date_from, date_to, metrics }, config) => {
    try {
      const writer = config?.streamWriter;
      writer?.(`🔍 Đang truy vấn dữ liệu từ ${date_from} đến ${date_to}...`);

      const accountObjId = await getAccountObjectId(account_id);

      const result = await AdPerformanceDailySummary.aggregate([
        {
          $match: {
            account_id: accountObjId,
            date: {
              $gte: new Date(date_from),
              $lte: new Date(date_to),
            },
          },
        },
        {
          $group: {
            _id: null,
            total_spend: { $sum: "$total_spend" },
            total_impressions: { $sum: "$total_impressions" },
            total_clicks: { $sum: "$total_clicks" },
            total_reach: { $sum: "$total_reach" },
            total_results: { $sum: "$total_results" },
            total_conversions: { $sum: "$total_conversions" },
            avg_ctr: { $avg: "$avg_ctr" },
            avg_cpc: { $avg: "$avg_cpc" },
            avg_cpm: { $avg: "$avg_cpm" },
            avg_frequency: { $avg: "$avg_frequency" },
            days: { $addToSet: "$date" },
          },
        },
      ]);

      const data = result[0] || {};
      
      writer?.(`✅ Đã tìm thấy dữ liệu từ ${data.days?.length || 0} ngày`);

      return JSON.stringify({
        period: { from: date_from, to: date_to },
        total_days: data.days?.length || 0,
        metrics: {
          spend: {
            value: data.total_spend || 0,
            formatted: formatCurrency(data.total_spend),
          },
          impressions: {
            value: data.total_impressions || 0,
            formatted: formatNumber(data.total_impressions),
          },
          clicks: {
            value: data.total_clicks || 0,
            formatted: formatNumber(data.total_clicks),
          },
          ctr: {
            value: data.avg_ctr || 0,
            formatted: formatPercent(data.avg_ctr),
          },
          cpc: {
            value: data.avg_cpc || 0,
            formatted: formatCurrency(data.avg_cpc),
          },
          cpm: {
            value: data.avg_cpm || 0,
            formatted: formatCurrency(data.avg_cpm),
          },
          results: {
            value: data.total_results || 0,
            formatted: formatNumber(data.total_results),
          },
          reach: {
            value: data.total_reach || 0,
            formatted: formatNumber(data.total_reach),
          },
        },
      });
    } catch (error) {
      console.error("Error in getTotalMetrics:", error);
      throw error;
    }
  },
  {
    name: "get_total_metrics",
    description:
      "Lấy tổng quan các chỉ số hiệu suất quảng cáo (spend, CTR, CPC, CPM, impressions, clicks, results, reach) trong khoảng thời gian. Dùng khi user hỏi về tổng số, trung bình, hoặc overview.",
    schema: z.object({
      account_id: z.string().describe("Account ID (act_xxx)"),
      date_from: z.string().describe("Ngày bắt đầu (YYYY-MM-DD)"),
      date_to: z.string().describe("Ngày kết thúc (YYYY-MM-DD)"),
      metrics: z
        .array(z.string())
        .optional()
        .describe(
          "Optional: Danh sách metrics cụ thể cần lấy. Bỏ qua để lấy tất cả."
        ),
    }),
  }
);

// ============================================
// TOOL 2: COMPARE CAMPAIGNS
// ============================================

export const compareCampaignsTool = tool(
  async (
    { account_id, campaign_ids, date_from, date_to, sort_by, limit },
    config
  ) => {
    try {
      const writer = config?.streamWriter;
      writer?.(`🔍 Đang so sánh các chiến dịch...`);

      const accountObjId = await getAccountObjectId(account_id);

      let campaignObjectIds = [];
      if (campaign_ids && campaign_ids.length > 0) {
        const campaigns = await AdsCampaign.find({
          external_id: { $in: campaign_ids },
        });
        campaignObjectIds = campaigns.map((c) => c._id);
      }

      const matchStage = {
        account_id: accountObjId,
        date: {
          $gte: new Date(date_from),
          $lte: new Date(date_to),
        },
      };

      if (campaignObjectIds.length > 0) {
        matchStage.campaign_id = { $in: campaignObjectIds };
      }

      const campaigns = await AdPerformanceCampaignDaily.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$campaign_id",
            campaign_name: { $first: "$campaign_name" },
            total_spend: { $sum: "$total_spend" },
            total_impressions: { $sum: "$total_impressions" },
            total_clicks: { $sum: "$total_clicks" },
            total_results: { $sum: "$total_results" },
            avg_ctr: { $avg: "$avg_ctr" },
            avg_cpc: { $avg: "$avg_cpc" },
            avg_cpm: { $avg: "$avg_cpm" },
            avg_cost_per_result: { $avg: "$avg_cost_per_result" },
          },
        },
        {
          $sort: {
            [`${sort_by === "spend" ? "total_spend" : "avg_" + sort_by}`]:
              -1,
          },
        },
        { $limit: limit || 10 },
      ]);

      writer?.(`✅ Đã so sánh ${campaigns.length} chiến dịch`);

      const formatted = campaigns.map((c) => ({
        campaign_id: c._id.toString(),
        campaign_name: c.campaign_name,
        spend: {
          value: c.total_spend,
          formatted: formatCurrency(c.total_spend),
        },
        impressions: {
          value: c.total_impressions,
          formatted: formatNumber(c.total_impressions),
        },
        clicks: {
          value: c.total_clicks,
          formatted: formatNumber(c.total_clicks),
        },
        ctr: { value: c.avg_ctr, formatted: formatPercent(c.avg_ctr) },
        cpc: { value: c.avg_cpc, formatted: formatCurrency(c.avg_cpc) },
        cpm: { value: c.avg_cpm, formatted: formatCurrency(c.avg_cpm) },
        results: {
          value: c.total_results,
          formatted: formatNumber(c.total_results),
        },
        cost_per_result: {
          value: c.avg_cost_per_result,
          formatted: formatCurrency(c.avg_cost_per_result),
        },
      }));

      return JSON.stringify({
        campaigns: formatted,
        total_campaigns: formatted.length,
        highest: {
          metric: sort_by || "spend",
          campaign_name: formatted[0]?.campaign_name,
          value: formatted[0]?.[sort_by || "spend"]?.formatted,
        },
        lowest: {
          metric: sort_by || "spend",
          campaign_name: formatted[formatted.length - 1]?.campaign_name,
          value:
            formatted[formatted.length - 1]?.[sort_by || "spend"]
              ?.formatted,
        },
      });
    } catch (error) {
      console.error("Error in compareCampaigns:", error);
      throw error;
    }
  },
  {
    name: "compare_campaigns",
    description:
      "So sánh hiệu suất giữa các chiến dịch quảng cáo. Dùng khi user muốn xem campaign nào tốt hơn, ranking, hoặc so sánh nhiều campaigns.",
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      date_from: z.string().describe("Ngày bắt đầu (YYYY-MM-DD)"),
      date_to: z.string().describe("Ngày kết thúc (YYYY-MM-DD)"),
      campaign_ids: z
        .array(z.string())
        .optional()
        .describe(
          "Optional: IDs của campaigns muốn so sánh. Bỏ qua để so sánh tất cả."
        ),
      sort_by: z
        .enum(["spend", "ctr", "cpc", "cpm"])
        .optional()
        .describe("Metric để sort. Default: spend"),
      limit: z
        .number()
        .optional()
        .describe("Số lượng campaigns tối đa. Default: 10"),
    }),
  }
);

// ============================================
// TOOL 3: GET TREND
// ============================================

export const getTrendTool = tool(
  async (
    { account_id, metric, granularity, date_from, date_to, campaign_id },
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
      } else {
        matchStage.campaign_id = null;
      }

      if (granularity === "hour") {
        const trend = await AdHourlyInsight.aggregate([
          {
            $match: {
              account_id: accountObjId,
              timestamp: {
                $gte: new Date(date_from),
                $lte: new Date(date_to),
              },
              ...(matchStage.campaign_id
                ? { campaign_id: matchStage.campaign_id }
                : {}),
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
                },
                hour: { $hour: "$timestamp" },
              },
              avgMetric: { $avg: `$${metric}` },
            },
          },
          { $sort: { "_id.date": 1, "_id.hour": 1 } },
        ]);

        const dataPoints = trend.map((t) => ({
          timestamp: `${t._id.date} ${t._id.hour}:00`,
          value: {
            value: t.avgMetric,
            formatted: formatMetric(metric, t.avgMetric),
          },
        }));

        const firstValue = dataPoints[0]?.value.value || 0;
        const lastValue =
          dataPoints[dataPoints.length - 1]?.value.value || 0;
        const changePercentage =
          firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

        let trendDirection = "stable";
        if (Math.abs(changePercentage) > 5) {
          trendDirection = changePercentage > 0 ? "increasing" : "decreasing";
        }

        writer?.(`✅ Đã phân tích ${trend.length} điểm dữ liệu`);

        return JSON.stringify({
          metric,
          granularity: "hour",
          period: { from: date_from, to: date_to },
          data_points: dataPoints,
          trend: {
            direction: trendDirection,
            change_percentage: changePercentage,
            first_value: {
              value: firstValue,
              formatted: formatMetric(metric, firstValue),
            },
            last_value: {
              value: lastValue,
              formatted: formatMetric(metric, lastValue),
            },
          },
        });
      }

      const trend = await AdPerformanceTrendDaily.find(matchStage)
        .sort({ date: 1 })
        .lean();

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
        timestamp: t.date.toISOString().split("T")[0],
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
      "Lấy xu hướng của một metric theo thời gian (daily/hourly). Dùng khi user hỏi về thay đổi theo ngày/giờ, hoặc trend.",
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      date_from: z.string().describe("Ngày bắt đầu (YYYY-MM-DD)"),
      date_to: z.string().describe("Ngày kết thúc (YYYY-MM-DD)"),
      metric: z
        .enum(["spend", "ctr", "cpc", "cpm", "impressions", "clicks"])
        .describe("Metric để xem trend"),
      granularity: z
        .enum(["day", "hour"])
        .optional()
        .describe("Độ chi tiết. Default: day"),
      campaign_id: z
        .string()
        .optional()
        .describe("Optional: ID của campaign cụ thể"),
    }),
  }
);

// ============================================
// TOOL 4: GET RANKING
// ============================================

export const getRankingTool = tool(
  async (
    { account_id, entity_type, metric, order, limit, date_from, date_to },
    config
  ) => {
    try {
      // Set defaults
      const _entity_type = entity_type || "campaign";
      const _metric = metric || "spend";
      const _order = order || "top";
      const _limit = limit || 5;

      const writer = config?.streamWriter;
      writer?.(`🏆 Đang xếp hạng ${_entity_type} theo ${_metric}...`);

      const accountObjId = await getAccountObjectId(account_id);

      const matchStage = {
        account_id: accountObjId,
        date: {
          $gte: new Date(date_from),
          $lte: new Date(date_to),
        },
      };

      if (_entity_type === "campaign") {
        const ranking = await AdPerformanceCampaignDaily.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: "$campaign_id",
              entity_name: { $first: "$campaign_name" },
              total_spend: { $sum: "$total_spend" },
              total_impressions: { $sum: "$total_impressions" },
              total_clicks: { $sum: "$total_clicks" },
              avg_ctr: { $avg: "$avg_ctr" },
              avg_cpc: { $avg: "$avg_cpc" },
              avg_cpm: { $avg: "$avg_cpm" },
              total_results: { $sum: "$total_results" },
              avg_cost_per_result: { $avg: "$avg_cost_per_result" },
            },
          },
          {
            $sort: {
              [`${_metric === "spend" ? "total_spend" : "avg_" + _metric}`]:
                _order === "top" ? -1 : 1,
            },
          },
          { $limit: _limit },
        ]);

        writer?.(`✅ Đã xếp hạng ${ranking.length} ${_entity_type}`);

        const formatted = ranking.map((r, index) => ({
          rank: index + 1,
          entity_id: r._id.toString(),
          entity_name: r.entity_name,
          value: {
            value:
              _metric === "spend"
                ? r.total_spend
                : r[`avg_${_metric}`] || r[`total_${_metric}`],
            formatted: formatMetric(
              _metric,
              _metric === "spend"
                ? r.total_spend
                : r[`avg_${_metric}`] || r[`total_${_metric}`]
            ),
          },
        }));

        return JSON.stringify({
          entity_type: _entity_type,
          metric: _metric,
          order: _order,
          ranking: formatted,
        });
      }

      const groupField =
        _entity_type === "adset" ? "$set_id" : "$ads_id";

      const nameField =
        _entity_type === "adset" ? "adset_name" : "ad_name";

      const ranking = await AdPerformance.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: groupField,
            entity_name: { $first: `$${nameField}` },
            total_spend: { $sum: "$spend" },
            total_impressions: { $sum: "$impressions" },
            total_clicks: { $sum: "$clicks" },
            avg_ctr: { $avg: "$ctr" },
            avg_cpc: { $avg: "$cpc" },
            avg_cpm: { $avg: "$cpm" },
            total_results: { $sum: "$results" },
            avg_cost_per_result: { $avg: "$cost_per_result" },
          },
        },
        {
          $sort: {
            [`${_metric === "spend" ? "total_spend" : "avg_" + _metric}`]:
              _order === "top" ? -1 : 1,
          },
        },
        { $limit: _limit },
      ]);

      writer?.(`✅ Đã xếp hạng ${ranking.length} ${_entity_type}`);

      const formatted = ranking.map((r, index) => ({
        rank: index + 1,
        entity_id: r._id.toString(),
        entity_name: r.entity_name,
        value: {
          value:
            _metric === "spend"
              ? r.total_spend
              : r[`avg_${_metric}`] || r[`total_${_metric}`],
          formatted: formatMetric(
            _metric,
            _metric === "spend"
              ? r.total_spend
              : r[`avg_${_metric}`] || r[`total_${_metric}`]
          ),
        },
      }));

      return JSON.stringify({
        entity_type: _entity_type,
        metric: _metric,
        order: _order,
        ranking: formatted,
      });
    } catch (error) {
      console.error("Error in getRanking:", error);
      throw error;
    }
  },
  {
    name: "get_ranking",
    description:
      "Lấy top/bottom performers (campaigns/adsets/ads). Dùng khi user hỏi 'top 5', 'worst 3', ranking.",
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      date_from: z.string().describe("Ngày bắt đầu (YYYY-MM-DD)"),
      date_to: z.string().describe("Ngày kết thúc (YYYY-MM-DD)"),
      entity_type: z
        .enum(["campaign", "adset", "ad"])
        .optional()
        .describe("Loại entity để rank. Default: campaign"),
      metric: z
        .enum(["spend", "ctr", "cpc", "cpm", "results"])
        .optional()
        .describe("Metric để rank. Default: spend"),
      order: z
        .enum(["top", "bottom"])
        .optional()
        .describe("Top hoặc bottom performers. Default: top"),
      limit: z
        .number()
        .optional()
        .describe("Số lượng entities. Default: 5"),
    }),
  }
);

// ============================================
// TOOL 5: GET OVERVIEW (Count of entities)
// ============================================

export const getOverviewTool = tool(
  async ({ account_id, status }, config) => {
    try {
      const writer = config?.streamWriter;
      writer?.(`🔍 Đang lấy thông tin tổng quan...`);

      const accountObjId = await getAccountObjectId(account_id);

      // Build query filter - exclude DELETED by default
      const filter = { 
        account_id: accountObjId,
        status: { $ne: "DELETED" } // Exclude deleted campaigns
      };
      
      if (status && status !== "all") {
        filter.status = status; // Override if specific status requested
      }

      // Count entities
      const [campaignCount, adsetCount, adCount] = await Promise.all([
        AdsCampaign.countDocuments(filter),
        AdsSet.countDocuments(filter),
        Ads.countDocuments(filter),
      ]);

      // Get status breakdown for campaigns (excluding DELETED)
      const campaignStatuses = await AdsCampaign.aggregate([
        { 
          $match: { 
            account_id: accountObjId,
            status: { $ne: "DELETED" }
          } 
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      const statusBreakdown = campaignStatuses.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      return JSON.stringify({
        total_campaigns: campaignCount,
        total_adsets: adsetCount,
        total_ads: adCount,
        campaign_status_breakdown: statusBreakdown,
        filter_applied: status || "all",
      });
    } catch (error) {
      console.error("Error in getOverview:", error);
      throw error;
    }
  },
  {
    name: "get_overview",
    description:
      "Lấy thông tin tổng quan về số lượng campaigns, adsets, ads. Dùng khi user hỏi 'có bao nhiêu quảng cáo', 'tổng số campaign', 'overview'.",
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      status: z
        .enum(["active", "paused", "archived", "all"])
        .optional()
        .describe("Lọc theo trạng thái. Default: all"),
    }),
  }
);

// Export all tools
export const listCampaignsTool = tool(
  async ({ account_id, status }, config) => {
    try {
      const writer = config?.streamWriter;
      writer?.(`🔍 Đang lấy danh sách chiến dịch...`);

      const accountObjId = await getAccountObjectId(account_id);

      const filter = {
        account_id: accountObjId,
        status: { $ne: "DELETED" },
      };

      if (status && status !== "all") {
        filter.status = status.toUpperCase();
      }

      const campaigns = await AdsCampaign.find(filter)
        .select("name status")
        .sort({ name: 1 })
        .limit(50) // Limit to avoid huge lists
        .lean();

      return JSON.stringify({
        total_campaigns: campaigns.length,
        campaigns: campaigns.map((c) => ({ name: c.name, status: c.status })),
        filter_applied: status || "all",
      });
    } catch (error) {
      console.error("Error in listCampaigns:", error);
      throw error;
    }
  },
  {
    name: "list_campaigns",
    description:
      "Liệt kê tên các chiến dịch quảng cáo. Dùng khi user hỏi 'tên chiến dịch là gì', 'liệt kê các chiến dịch', 'có những chiến dịch nào'.",
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      status: z
        .enum(["active", "paused", "archived", "all"])
        .optional()
        .describe("Lọc theo trạng thái. Default: all (trừ DELETED)"),
    }),
  }
);

export const analyticsTools = [
  getTotalMetricsTool,
  compareCampaignsTool,
  getTrendTool,
  getRankingTool,
  getOverviewTool,
  listCampaignsTool,
];
