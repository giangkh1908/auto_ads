import cron from "node-cron";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { syncInsightsForAccount } from "../services/insightsSyncService.js";
import { syncEntitiesForAccount } from "../services/entitySyncService.js";
import User from "../models/user.model.js";
import pLimit from "p-limit";

export function startSyncCronJobs() {
  cron.schedule("0 2,6,10,14,18,22 * * *", async () => {
    const startTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    console.log(`🔄 [${startTime}] Starting entity sync...`);
    const limit = pLimit(1);

    try {
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

              await syncEntitiesForAccount(account.external_id, accessToken);
              successCount++;
              console.log(`✅ Synced entities for account ${account.external_id}`);
            } catch (err) {
              console.error(`❌ Failed to sync account ${account.external_id}:`, err.message);
              errorCount++;
            }
          })
        )
      );

      const endTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      console.log(`✅ [${endTime}] Entity sync completed: ${successCount} success, ${errorCount} errors`);
    } catch (err) {
      console.error("❌ Entity sync cron failed:", err.message);
    }
  });

  cron.schedule("0 0,4,8,12,16,20 * * *", async () => {
    const startTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    console.log(`📊 [${startTime}] Starting insights sync...`);
    const limit = pLimit(1);

    try {
      const accounts = await AdsAccount.find({
        status: "ACTIVE",
        "sync_metadata.entities_status": "done",
      }).select("_id");

      let successCount = 0;
      let errorCount = 0;

      await Promise.all(
        accounts.map((account) =>
          limit(async () => {
            try {
              await syncInsightsForAccount(account._id);
              successCount++;
            } catch (err) {
              console.error(`❌ Failed to sync insights for account:`, err.message);
              errorCount++;
            }
          })
        )
      );

      const endTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      console.log(`✅ [${endTime}] Insights sync completed: ${successCount} success, ${errorCount} errors`);
    } catch (err) {
      console.error("❌ Insights sync cron failed:", err.message);
    }
  });

  console.log("✅ Sync cron jobs started:");
  console.log("  - Entity Sync: Every 4 hours at 2:00, 6:00, 10:00, 14:00, 18:00, 22:00 (structure sync)");
  console.log("  - Insights Sync: Every 4 hours at 0:00, 4:00, 8:00, 12:00, 16:00, 20:00 (metrics sync)");
}


