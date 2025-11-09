import AdPerformance from "../../models/ads/adPerformance.model.js";
import { syncAdPerformanceData } from "../../services/adPerformanceService.js";

/**
 * GET /api/ads/performance
 * Query ad performance data từ database
 */
export async function getAdPerformance(req, res) {
  try {
    const { account_id, campaign_id, set_id, ads_id, dateFrom, dateTo } = req.query;
    
    if (!account_id) {
      return res.status(400).json({ message: "account_id is required" });
    }

    // Build filter query
    const filter = {};
    
    // Account filter
    if (account_id) {
      filter.account_id = account_id;
    }
    
    // Campaign filter
    if (campaign_id) {
      filter.campaign_id = campaign_id;
    }
    
    // AdSet filter
    if (set_id) {
      filter.set_id = set_id;
    }
    
    // Ad filter
    if (ads_id) {
      filter.ads_id = ads_id;
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) {
        filter.date.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.date.$lte = new Date(dateTo);
      }
    }

    const performances = await AdPerformance.find(filter)
      .sort({ date: -1, created_at: -1 })
      .lean();

    return res.status(200).json({
      items: performances,
      total: performances.length
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

    // Build match query
    const matchQuery = {
      account_id
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
