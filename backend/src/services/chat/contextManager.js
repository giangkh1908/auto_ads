import AdPerformance from "../../models/ads/adPerformance.model.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";

export class ContextManager {
  /**
   * Build the context object for the AI agent.
   * @param {string} accountId - The external account ID (e.g., "act_123" or "123").
   * @param {string} userId - The user ID.
   * @returns {Promise<Object>} The context object.
   */
  async build(accountId, userId) {
    try {
      // 1. Get Account Info
      const account = await this._getAccount(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // 2. Get Today's Real-time Stats
      const todayStats = await this._getTodayStats(account._id);

      // 3. Get Recent Alerts/Insights (Placeholder for now)
      const alerts = []; 

      return {
        account: {
          id: account.external_id,
          name: account.name,
          currency: account.currency,
          timezone: account.timezone_name,
        },
        today_stats: todayStats,
        alerts: alerts,
        user_id: userId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[ContextManager] Error building context:", error);
      // Return minimal context on error to avoid breaking the flow
      return {
        account: { id: accountId, name: "Unknown" },
        error: error.message,
      };
    }
  }

  async _getAccount(accountId) {
    const idToFind = accountId.startsWith("act_") ? accountId.replace("act_", "") : accountId;
    return await AdsAccount.findOne({
      $or: [{ external_id: idToFind }, { external_id: `act_${idToFind}` }],
    }).select("_id external_id name currency timezone_name");
  }

  async _getTodayStats(accountObjectId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // ✅ Query directly from AdPerformance table
    const stats = await AdPerformance.aggregate([
      {
        $match: {
          account_id: accountObjectId,
          date: { $gte: startOfDay },
        },
      },
      {
        $group: {
          _id: null,
          spend: { $sum: "$spend" },
          impressions: { $sum: "$impressions" },
          clicks: { $sum: "$clicks" },
          results: { $sum: "$results" },
          avg_ctr: { $avg: "$ctr" },
          avg_cpc: { $avg: "$cpc" },
          avg_cost_per_result: { $avg: "$cost_per_result" },
        },
      },
    ]);

    if (!stats || stats.length === 0) return null;

    return {
      spend: stats[0].spend || 0,
      impressions: stats[0].impressions || 0,
      clicks: stats[0].clicks || 0,
      ctr: stats[0].avg_ctr || 0,
      cpc: stats[0].avg_cpc || 0,
      results: stats[0].results || 0,
      cost_per_result: stats[0].avg_cost_per_result || 0,
    };
  }
}

export const contextManager = new ContextManager();
