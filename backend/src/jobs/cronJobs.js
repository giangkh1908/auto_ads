import cron from "node-cron";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { syncInsightsForAccount } from "../services/ads/insightsSyncService.js";
import { syncEntitiesForAccount } from "../services/ads/entitySyncService.js";
import User from "../models/user/user.model.js";
import pLimit from "p-limit";

export function startSyncCronJobs() {
  // Run every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    const startTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    console.log(`🔄 [${startTime}] Starting ads entity + ads insights sync...`);
    const limit = pLimit(1);

    try {
      // Reset any stuck sync status (syncing for more than 1 hour)
      const oneHourAgo = new Date(Date.now() - 3600000);
      const resetResult = await AdsAccount.updateMany(
        {
          status: "ACTIVE",
          "sync_metadata.entities_status": "syncing",
          $or: [
            { "sync_metadata.entities_sync_started_at": { $lt: oneHourAgo } },
            {
              "sync_metadata.entities_sync_started_at": { $exists: false },
              "sync_metadata.entities_last_synced_at": { $exists: false }
            }
          ]
        },
        {
          $set: {
            "sync_metadata.entities_status": "idle",
            "sync_metadata.entities_error": "Reset stuck sync status"
          },
          $unset: {
            "sync_metadata.entities_sync_started_at": ""
          }
        }
      );
      if (resetResult.modifiedCount > 0) {
        console.log(`🔄 Reset ${resetResult.modifiedCount} stuck sync status(es)`);
      }

      const accounts = await AdsAccount.find({
        status: "ACTIVE"
      })
        .select("_id external_id shop_admin_id")
        .populate("shop_admin_id", "+facebookAccessToken");

      let successCount = 0;
      let errorCount = 0;

      await Promise.all(
        accounts.map(account =>
          limit(async () => {
            try {
              const accessToken = account.shop_admin_id?.facebookAccessToken;
              if (!accessToken) {
                console.warn(`⚠️ No access token for account ${account.external_id}`);
                errorCount++;
                return;
              }

              console.log(`🔄 [${account.external_id}] Starting entity sync...`);
              await syncEntitiesForAccount(account.external_id, accessToken);
              console.log(`✅ [${account.external_id}] Entity sync completed`);

              console.log(`🔄 [${account.external_id}] Starting insights sync...`);
              await syncInsightsForAccount(account._id);
              console.log(`✅ [${account.external_id}] Insights sync completed`);

              successCount++;
            } catch (err) {
              console.error(`❌ Failed to sync account ${account.external_id}:`, err.message);
              errorCount++;
            }
          })
        )
      );

      const endTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      console.log(`✅ [${endTime}] Ads entity + ads insights sync completed: ${successCount} success, ${errorCount} errors`);
    } catch (err) {
      console.error("❌ Ads entity + ads insights cron failed:", err.message);
    }
  });

  console.log("✅ Sync cron jobs started:");
  console.log("  - Ads Entities + Ads Insights: Every hour (at minute 0)");
}


