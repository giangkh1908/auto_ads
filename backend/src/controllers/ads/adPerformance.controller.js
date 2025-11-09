import AdPerformance from "../../models/ads/adPerformance.model.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";
import { syncAdPerformanceData } from "../../services/adPerformanceService.js";

// Helper: Tìm AdsAccount bằng external_id (hỗ trợ cả act_xxx và xxx)
async function findAccountByExternalId(externalId) {
  const hasPrefix = String(externalId).startsWith("act_");
  const withPrefix = hasPrefix ? externalId : `act_${externalId}`;
  const withoutPrefix = hasPrefix ? externalId.substring(4) : String(externalId);
  
  return AdsAccount.findOne({
    external_id: { $in: [withPrefix, withoutPrefix] },
  });
}

/**
 * GET /api/ads/performance
 * Query ad performance data từ database
 * Hỗ trợ groupBy=ad để tổng hợp metrics theo ad
 */
export async function getAdPerformance(req, res) {
  try {
    const { account_id, campaign_id, set_id, ads_id, dateFrom, dateTo, groupBy } = req.query;
    
    if (!account_id) {
      return res.status(400).json({ message: "account_id is required" });
    }

    // Build filter query
    const filter = {};
    
    // 🔹 Account filter: Tìm AdsAccount bằng external_id
    const account = await findAccountByExternalId(account_id);
    if (!account) {
      return res.status(404).json({ 
        message: `Ad account not found: ${account_id}` 
      });
    }
    filter.account_id = account._id;
    
    // 🔹 Campaign filter: Tìm campaign bằng external_id
    if (campaign_id) {
      const campaign = await AdsCampaign.findOne({ 
        external_id: campaign_id,
        account_id: account._id
      });
      if (campaign) {
        filter.campaign_id = campaign._id;
      }
    }
    
    // 🔹 AdSet filter: Tìm adset bằng external_id
    if (set_id) {
      const adset = await AdsSet.findOne({ 
        external_id: set_id,
        account_id: account._id
      });
      if (adset) {
        filter.set_id = adset._id;
      }
    }
    
    // 🔹 Ad filter: Tìm ad bằng external_id
    if (ads_id) {
      const ad = await Ads.findOne({ 
        external_id: ads_id,
        account_id: account._id
      });
      if (ad) {
        filter.ads_id = ad._id;
      }
    }
    
    // 🔹 Date range filter
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) {
        filter.date.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.date.$lte = new Date(dateTo);
      }
    }

    // 🔹 Nếu có groupBy = 'ad', aggregate theo ad
    if (groupBy === 'ad') {
      const aggregated = await AdPerformance.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$ads_id",
            ad_name: { $first: "$ad_name" },
            adset_name: { $first: "$adset_name" },
            campaign_name: { $first: "$campaign_name" },
            page_name: { $first: "$page_name" },
            daily_budget: { $first: "$daily_budget" },
            
            // Tổng hợp metrics
            totalSpend: { $sum: "$spend" },
            totalImpressions: { $sum: "$impressions" },
            totalReach: { $sum: "$reach" },
            totalClicks: { $sum: "$clicks" },
            totalResults: { $sum: "$results" },
            totalConversions: { $sum: "$conversions" },
            totalLinkClicks: { $sum: "$link_clicks" },
            totalPurchases: { $sum: "$website_purchases" },
            totalFrequency: { $avg: "$frequency" },
            
            // Metadata
            recordCount: { $sum: 1 },
            dateRange: { $push: "$date" },
            
            // Lưu IDs để populate sau
            campaign_id: { $first: "$campaign_id" },
            set_id: { $first: "$set_id" },
            account_id: { $first: "$account_id" }
          }
        },
        {
          $project: {
            _id: 0,
            ads_id: "$_id",
            ad_name: 1,
            adset_name: 1,
            campaign_name: 1,
            page_name: 1,
            daily_budget: 1,
            
            // Metrics (đổi tên để khớp với schema)
            spend: "$totalSpend",
            impressions: "$totalImpressions",
            reach: "$totalReach",
            clicks: "$totalClicks",
            results: "$totalResults",
            conversions: "$totalConversions",
            link_clicks: "$totalLinkClicks",
            website_purchases: "$totalPurchases",
            frequency: "$totalFrequency",
            
            // Calculated metrics
            cpc: {
              $cond: [
                { $gt: ["$totalClicks", 0] },
                { $divide: ["$totalSpend", "$totalClicks"] },
                null
              ]
            },
            cpm: {
              $cond: [
                { $gt: ["$totalImpressions", 0] },
                { $multiply: [{ $divide: ["$totalSpend", "$totalImpressions"] }, 1000] },
                null
              ]
            },
            ctr: {
              $cond: [
                { $gt: ["$totalImpressions", 0] },
                { $multiply: [{ $divide: ["$totalClicks", "$totalImpressions"] }, 100] },
                null
              ]
            },
            cost_per_result: {
              $cond: [
                { $gt: ["$totalResults", 0] },
                { $divide: ["$totalSpend", "$totalResults"] },
                null
              ]
            },
            link_cpc: {
              $cond: [
                { $gt: ["$totalLinkClicks", 0] },
                { $divide: ["$totalSpend", "$totalLinkClicks"] },
                null
              ]
            },
            link_ctr: {
              $cond: [
                { $gt: ["$totalImpressions", 0] },
                { $multiply: [{ $divide: ["$totalLinkClicks", "$totalImpressions"] }, 100] },
                null
              ]
            },
            conversion_rate: {
              $cond: [
                { $gt: ["$totalClicks", 0] },
                { $multiply: [{ $divide: ["$totalConversions", "$totalClicks"] }, 100] },
                null
              ]
            },
            cost_per_conversion: {
              $cond: [
                { $gt: ["$totalConversions", 0] },
                { $divide: ["$totalSpend", "$totalConversions"] },
                null
              ]
            },
            
            // Metadata
            days_with_data: "$recordCount",
            date_from: { $min: "$dateRange" },
            date_to: { $max: "$dateRange" },
            
            // IDs cho populate
            campaign_id: 1,
            set_id: 1,
            account_id: 1
          }
        },
        { $sort: { spend: -1 } }  // Sort by spend giảm dần
      ]);

      return res.status(200).json({
        items: aggregated,
        total: aggregated.length,
        grouped: true
      });
    }

    // 🔹 Không group: Trả về từng record riêng lẻ (raw data theo ngày)
    const performances = await AdPerformance.find(filter)
      .sort({ date: -1, created_at: -1 })
      .lean();

    return res.status(200).json({
      items: performances,
      total: performances.length,
      grouped: false
    });
  } catch (error) {
    console.error("GET Ad Performance error:", error);
    return res.status(500).json({
      message: "Error fetching ad performance",
      error: error.message
    });
  }
}

/**
 * POST /api/ads/performance/refresh
 * Trigger sync ad performance từ Facebook
 */
export async function refreshAdPerformance(req, res) {
  try {
    const { account_id, timeRange } = req.body;
    
    if (!account_id) {
      return res.status(400).json({ message: "account_id is required" });
    }

    const options = {};
    if (timeRange) {
      options.timeRange = timeRange;
    }

    const result = await syncAdPerformanceData(account_id, options);

    return res.status(200).json({
      message: "Ad performance synced successfully",
      ...result
    });
  } catch (error) {
    console.error("Refresh Ad Performance error:", error);
    return res.status(500).json({
      message: "Error syncing ad performance",
      error: error.message
    });
  }
}

/**
 * GET /api/ads/performance/stats
 * Get aggregated stats (tổng số liệu)
 */
export async function getAdPerformanceStats(req, res) {
  try {
    const { account_id, dateFrom, dateTo } = req.query;
    
    if (!account_id) {
      return res.status(400).json({ message: "account_id is required" });
    }

    // 🔹 Tìm AdsAccount bằng external_id
    const account = await findAccountByExternalId(account_id);
    if (!account) {
      return res.status(404).json({ 
        message: `Ad account not found: ${account_id}` 
      });
    }

    // Build match query
    const matchQuery = {
      account_id: account._id
    };
    
    if (dateFrom || dateTo) {
      matchQuery.date = {};
      if (dateFrom) {
        matchQuery.date.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        matchQuery.date.$lte = new Date(dateTo);
      }
    }

    const stats = await AdPerformance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: "$spend" },
          totalImpressions: { $sum: "$impressions" },
          totalReach: { $sum: "$reach" },
          totalClicks: { $sum: "$clicks" },
          totalResults: { $sum: "$results" },
          totalConversions: { $sum: "$conversions" },
          totalPurchases: { $sum: "$website_purchases" },
          recordCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          totalSpend: 1,
          totalImpressions: 1,
          totalReach: 1,
          totalClicks: 1,
          totalResults: 1,
          totalConversions: 1,
          totalPurchases: 1,
          recordCount: 1,
          avgCpc: {
            $cond: [
              { $gt: ["$totalClicks", 0] },
              { $divide: ["$totalSpend", "$totalClicks"] },
              null
            ]
          },
          avgCpm: {
            $cond: [
              { $gt: ["$totalImpressions", 0] },
              { $multiply: [{ $divide: ["$totalSpend", "$totalImpressions"] }, 1000] },
              null
            ]
          },
          avgCtr: {
            $cond: [
              { $gt: ["$totalImpressions", 0] },
              { $multiply: [{ $divide: ["$totalClicks", "$totalImpressions"] }, 100] },
              null
            ]
          },
          avgCostPerResult: {
            $cond: [
              { $gt: ["$totalResults", 0] },
              { $divide: ["$totalSpend", "$totalResults"] },
              null
            ]
          }
        }
      }
    ]);

    return res.status(200).json(stats[0] || {});
  } catch (error) {
    console.error("GET Ad Performance Stats error:", error);
    return res.status(500).json({
      message: "Error fetching ad performance stats",
      error: error.message
    });
  }
}
