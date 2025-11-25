import { tool } from "@langchain/core/tools";
import { z } from "zod";
import AdPerformance from "../../models/ads/adPerformance.model.js";
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
        const count = await modelMap[entity_type || "campaign"].countDocuments({ 
          account_id: accountObjId,
          status: { $ne: "DELETED" }
        });
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
        const fieldMap = {
          campaign: { group: "$external_campaign_id", name: "$campaign_name" },
          adset: { group: "$external_adset_id", name: "$adset_name" },
          ad: { group: "$external_ad_id", name: "$ad_name" },
        };

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
        const entityIdField = entity_type === "campaign" ? "external_campaign_id" : 
                              entity_type === "adset" ? "external_adset_id" : "external_ad_id";

        const sortField = metric === "spend" ? "total_spend" : `avg_${metric}`;
        const results = await AdPerformance.aggregate([
          {
            $match: {
              account_id: accountObjId,
              date: { $gte: new Date(date_from), $lte: new Date(date_to) },
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
// TOOL 1: GET TOTAL METRICS
// ============================================

export const getTotalMetricsTool = tool(
  async ({ account_id, date_from, date_to, metrics }, config) => {
    try {
      const writer = config?.streamWriter;
      writer?.(`🔍 Đang truy vấn dữ liệu từ ${date_from} đến ${date_to}...`);

      const accountObjId = await getAccountObjectId(account_id);

      // ✅ Query trực tiếp từ bảng AdPerformance (bảng gốc có data)
      const result = await AdPerformance.aggregate([
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

export const compareEntitiesTool = tool(
  async (
    { account_id, entity_type, entity_ids, date_from, date_to, sort_by, limit },
    config
  ) => {
    try {
      const writer = config?.streamWriter;
      const _entity_type = entity_type || "campaign";
      writer?.(`🔍 Đang so sánh ${_entity_type}...`);

      const accountObjId = await getAccountObjectId(account_id);
      
      // Get list of non-deleted entity IDs
      const modelMap = {
        campaign: AdsCampaign,
        adset: AdsSet,
        ad: Ads,
      };
      const activeEntities = await modelMap[_entity_type]
        .find({ 
          account_id: accountObjId,
          status: { $ne: "DELETED" }
        })
        .select("external_id")
        .lean();
      
      const activeIds = activeEntities.map(e => e.external_id);
      
      const matchStage = {
        account_id: accountObjId,
        date: {
          $gte: new Date(date_from),
          $lte: new Date(date_to),
        },
      };

      let groupField, nameField;
      switch (_entity_type) {
        case "adset":
          groupField = "$external_adset_id";
          nameField = "$adset_name";
          matchStage.external_adset_id = entity_ids && entity_ids.length > 0 
            ? { $in: entity_ids.filter(id => activeIds.includes(id)) }
            : { $in: activeIds };
          break;
        case "ad":
          groupField = "$external_ad_id";
          nameField = "$ad_name";
          matchStage.external_ad_id = entity_ids && entity_ids.length > 0 
            ? { $in: entity_ids.filter(id => activeIds.includes(id)) }
            : { $in: activeIds };
          break;
        case "campaign":
        default:
          groupField = "$external_campaign_id";
          nameField = "$campaign_name";
          matchStage.external_campaign_id = entity_ids && entity_ids.length > 0 
            ? { $in: entity_ids.filter(id => activeIds.includes(id)) }
            : { $in: activeIds };
          break;
      }

      const results = await AdPerformance.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: groupField,
            entity_name: { $first: nameField },
            total_spend: { $sum: "$spend" },
            total_impressions: { $sum: "$impressions" },
            total_clicks: { $sum: "$clicks" },
            total_results: { $sum: "$results" },
            avg_ctr: { $avg: "$ctr" },
            avg_cpc: { $avg: "$cpc" },
            avg_cpm: { $avg: "$cpm" },
            avg_cost_per_result: { $avg: "$cost_per_result" },
          },
        },
        { $sort: { [`${sort_by === 'spend' ? 'total_spend' : 'avg_' + sort_by}`]: -1 } },
        { $limit: limit || 10 },
      ]);

      writer?.(`✅ Đã so sánh ${results.length} ${_entity_type}`);

      const formatted = results.map((r) => ({
        entity_id: r._id,
        entity_name: r.entity_name,
        spend: { value: r.total_spend, formatted: formatCurrency(r.total_spend) },
        impressions: { value: r.total_impressions, formatted: formatNumber(r.total_impressions) },
        clicks: { value: r.total_clicks, formatted: formatNumber(r.total_clicks) },
        ctr: { value: r.avg_ctr, formatted: formatPercent(r.avg_ctr) },
        cpc: { value: r.avg_cpc, formatted: formatCurrency(r.avg_cpc) },
        cpm: { value: r.avg_cpm, formatted: formatCurrency(r.avg_cpm) },
        results: { value: r.total_results, formatted: formatNumber(r.total_results) },
        cost_per_result: { value: r.avg_cost_per_result, formatted: formatCurrency(r.avg_cost_per_result)},
      }));

      return JSON.stringify({
        entity_type: _entity_type,
        results: formatted,
      });
    } catch (error) {
      console.error("Error in compareEntities:", error);
      throw error;
    }
  },
  {
    name: "compare_entities",
    description: "CHUYÊN DỤNG ĐỂ SO SÁNH. Dùng khi user muốn so sánh trực tiếp hiệu quả giữa các chiến dịch, nhóm, hoặc quảng cáo cụ thể. Ví dụ: 'So sánh camp A và B', 'adset nào rẻ hơn'. Trả về bảng so sánh chi tiết các chỉ số.",
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      date_from: z.string().describe("Ngày bắt đầu (YYYY-MM-DD)"),
      date_to: z.string().describe("Ngày kết thúc (YYYY-MM-DD)"),
      entity_type: z.enum(["campaign", "adset", "ad"]).describe("Loại đối tượng cần so sánh."),
      entity_ids: z.array(z.string()).optional().describe("Danh sách ID của các đối tượng cần so sánh. Để trống để so sánh top performers."),
      sort_by: z.enum(["spend", "ctr", "cpc", "cpm", "results", "cost_per_result"]).optional().describe("Tiêu chí so sánh. Nếu user hỏi 'hiệu quả hơn', hãy chọn 'results' hoặc 'cost_per_result'."),
      limit: z.number().optional().describe("Số lượng tối đa. Default: 10"),
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
              ...(matchStage.set_id // Added for adset
                ? { set_id: matchStage.set_id }
                : {}),
              ...(matchStage.ads_id // Added for ad
                ? { ads_id: matchStage.ads_id }
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

      // Get list of non-deleted entity IDs
      const modelMap = {
        campaign: AdsCampaign,
        adset: AdsSet,
        ad: Ads,
      };
      const activeEntities = await modelMap[_entity_type]
        .find({ 
          account_id: accountObjId,
          status: { $ne: "DELETED" }
        })
        .select("external_id")
        .lean();
      
      const activeIds = activeEntities.map(e => e.external_id);
      const entityIdField = _entity_type === "campaign" ? "external_campaign_id" : 
                            _entity_type === "adset" ? "external_adset_id" : "external_ad_id";

      const matchStage = {
        account_id: accountObjId,
        date: {
          $gte: new Date(date_from),
          $lte: new Date(date_to),
        },
        [entityIdField]: { $in: activeIds },
      };

      if (_entity_type === "campaign") {
        // ✅ Query từ AdPerformance và group by campaign_id
        const ranking = await AdPerformance.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: "$campaign_id",
              entity_name: { $first: "$campaign_name" },
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
export const listEntitiesTool = tool(
  async ({ account_id, entity_type, status }, config) => {
    try {
      const writer = config?.streamWriter;
      const _entity_type = entity_type || "campaign";
      writer?.(`🔍 Đang lấy danh sách ${_entity_type}...`);

      const accountObjId = await getAccountObjectId(account_id);
      const filter = { account_id: accountObjId, status: { $ne: "DELETED" } };
      if (status && status !== "all") {
        filter.status = status.toUpperCase();
      }

      let Model, nameField, selectFields;
      switch (_entity_type) {
        case "adset":
          Model = AdsSet;
          nameField = "name";
          selectFields = "name status external_id";
          break;
        case "ad":
          Model = Ads;
          nameField = "name";
          selectFields = "name status external_id";
          break;
        case "campaign":
        default:
          Model = AdsCampaign;
          nameField = "name";
          selectFields = "name status external_id";
          break;
      }
      
      const entities = await Model.find(filter)
        .select(selectFields)
        .sort({ [nameField]: 1 })
        .limit(100)
        .lean();

      return JSON.stringify({
        total: entities.length,
        entities: entities.map((e) => ({ id: e.external_id, name: e.name, status: e.status })),
        filter_applied: { entity_type: _entity_type, status: status || "all" },
      });
    } catch (error) {
      console.error(`Error in listEntities for ${entity_type}:`, error);
      throw error;
    }
  },
  {
    name: "list_entities",
    description:
      "Liệt kê tên các chiến dịch, nhóm quảng cáo, hoặc quảng cáo. Rất hữu ích để lấy ID chính xác trước khi so sánh hoặc xếp hạng.",
    schema: z.object({
      account_id: z.string().describe("Account ID"),
      entity_type: z
        .enum(["campaign", "adset", "ad"])
        .optional()
        .describe("Loại đối tượng cần liệt kê. Mặc định: 'campaign'."),
      status: z
        .enum(["ACTIVE", "PAUSED", "ARCHIVED", "all"])
        .optional()
        .describe("Lọc theo trạng thái. Mặc định: 'all' (trừ DELETED)."),
    }),
  }
);

export const analyticsTools = [
  queryDataTool, // Universal data query tool
  getTrendTool,  // Trend analysis tool
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

