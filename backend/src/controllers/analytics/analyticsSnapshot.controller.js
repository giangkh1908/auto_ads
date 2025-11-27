import AnalyticsSnapshot from "../../models/analytics/analyticsSnapshot.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";

/**
 * List analytics snapshots
 */
export async function listAnalyticsSnapshotsCtrl(req, res) {
  try {
    const { account_id, objective, search } = req.query;

    if (!account_id) {
      return res.status(400).json({ message: "account_id is required" });
    }

    // Build filter
    const filter = { external_account_id: account_id };

    if (objective && objective !== "ALL") {
      filter.campaign_objective = objective;
    }

    if (search) {
      filter.$or = [
        { ad_name: new RegExp(search, "i") },
        { campaign_name: new RegExp(search, "i") },
        { adset_name: new RegExp(search, "i") },
      ];
    }

    const snapshots = await AnalyticsSnapshot.find(filter)
      .populate('adset_id', 'targeting')
      .sort({ last_synced: -1 })
      .lean();

    // Map snapshots and add age_range from adset targeting
    const snapshotsWithAgeRange = snapshots.map(snapshot => {
      const adset = snapshot.adset_id;
      let ageRange = 'N/A';
      
      if (adset && adset.targeting) {
        const ageMin = adset.targeting.age_min;
        const ageMax = adset.targeting.age_max;
        if (ageMin !== undefined && ageMax !== undefined) {
          ageRange = `${ageMin}-${ageMax}`;
        } else if (ageMin !== undefined) {
          ageRange = `${ageMin}+`;
        } else if (ageMax !== undefined) {
          ageRange = `≤${ageMax}`;
        }
      }

      return {
        ...snapshot,
        age_range: ageRange,
      };
    });

    return res.status(200).json({
      items: snapshotsWithAgeRange,
      total: snapshotsWithAgeRange.length,
    });
  } catch (error) {
    console.error("GET Analytics Snapshots error:", error);
    return res.status(500).json({
      message: "Error fetching analytics snapshots",
      error: error.message,
    });
  }
}

/**
 * Trigger manual sync for an account
 */
export async function syncAnalyticsSnapshotsCtrl(req, res) {
  try {
    const { account_id } = req.body;

    if (!account_id) {
      return res.status(400).json({ message: "account_id is required" });
    }

    // Import service dynamically to avoid circular dependency
    const { syncAnalyticsSnapshots } = await import("../../services/analyticsSnapshotService.js");
    const AdsAccount = (await import("../../models/ads/adsAccount.model.js")).default;

    // Support both MongoDB _id and external_id
    let account;
    if (account_id.match(/^[0-9a-fA-F]{24}$/)) {
      // MongoDB ObjectId format
      account = await AdsAccount.findById(account_id)
        .select("_id external_id name shop_admin_id")
        .populate({ path: "shop_admin_id", select: "+facebookAccessToken" })
        .lean();
    } else {
      // external_id format
      account = await AdsAccount.findOne({ external_id: account_id })
        .select("_id external_id name shop_admin_id")
        .populate({ path: "shop_admin_id", select: "+facebookAccessToken" })
        .lean();
    }

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const result = await syncAnalyticsSnapshots(account);

    if (result.rateLimited) {
      return res.status(429).json({
        message: "Đã vượt quá giới hạn số lượng request. Vui lòng chờ một chút và thử lại.",
        synced: result.synced,
        errors: result.errors,
        rateLimitReached: true,
        retryAfter: 60,
      });
    }

    return res.status(200).json({
      message: "Sync completed",
      synced: result.synced,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Sync Analytics Snapshots error:", error);
    
    const fbError = error.response?.data?.error;
    if (fbError?.code === 17 || fbError?.code === 4) {
      return res.status(429).json({
        message: fbError?.error_user_msg || "Đã vượt quá giới hạn số lượng request. Vui lòng chờ một chút và thử lại.",
        synced: 0,
        errors: 1,
        rateLimitReached: true,
        retryAfter: 60,
      });
    }

    return res.status(500).json({
      message: "Error syncing analytics snapshots",
      error: error.message,
    });
  }
}
