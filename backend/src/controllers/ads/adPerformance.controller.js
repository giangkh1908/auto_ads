import { 
  syncAdPerformanceData, 
  getAdPerformanceFromDB 
} from "../../services/adPerformanceService.js";

export const getAdPerformance = async (req, res) => {
  try {
    const { account_id, campaign_id, set_id, ads_id, dateFrom, dateTo } = req.query;

    const filters = {};
    if (account_id) filters.account_id = account_id;
    if (campaign_id) filters.campaign_id = campaign_id;
    if (set_id) filters.set_id = set_id;
    if (ads_id) filters.ads_id = ads_id;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const performances = await getAdPerformanceFromDB(filters);

    res.status(200).json({
      success: true,
      data: performances
    });
  } catch (error) {
    console.error("Error in getAdPerformance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get ad performance",
      error: error.message
    });
  }
};

export const refreshAdPerformance = async (req, res) => {
  try {
    const { account_id } = req.body;
    
    const result = await syncAdPerformanceData(account_id || null);

    res.status(200).json({
      success: true,
      message: "Ad performance data refreshed successfully",
      data: result
    });
  } catch (error) {
    console.error("Error in refreshAdPerformance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh ad performance",
      error: error.message
    });
  }
};

export const getAdPerformanceStats = async (req, res) => {
  try {
    const { account_id, dateFrom, dateTo } = req.query;

    const filters = { account_id };
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const performances = await getAdPerformanceFromDB(filters);

    // Tính toán stats
    const stats = performances.reduce((acc, perf) => {
      acc.totalSpend += perf.spend || 0;
      acc.totalImpressions += perf.impressions || 0;
      acc.totalReach += perf.reach || 0;
      acc.totalClicks += perf.clicks || 0;
      acc.totalResults += perf.results || 0;
      return acc;
    }, {
      totalSpend: 0,
      totalImpressions: 0,
      totalReach: 0,
      totalClicks: 0,
      totalResults: 0
    });

    stats.avgCPC = stats.totalClicks > 0 ? stats.totalSpend / stats.totalClicks : 0;
    stats.avgCPM = stats.totalImpressions > 0 ? (stats.totalSpend / stats.totalImpressions) * 1000 : 0;
    stats.avgCTR = stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions) * 100 : 0;

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error in getAdPerformanceStats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get ad performance stats",
      error: error.message
    });
  }
};