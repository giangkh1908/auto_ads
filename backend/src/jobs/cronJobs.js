import cron from "node-cron";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { syncInsightsForAccount } from "../services/insightsSyncService.js";
import { syncEntitiesForAccount } from "../services/entitySyncService.js";
import User from "../models/user.model.js";
import pLimit from "p-limit";

export function startSyncCronJobs() {
  cron.schedule("0 3 * * *", async () => {
    console.log("🔄 Starting daily entity sync...");
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

      console.log(`✅ Entity sync completed: ${successCount} success, ${errorCount} errors`);
    } catch (err) {
      console.error("❌ Entity sync cron failed:", err.message);
    }
  });

  cron.schedule("0 */4 * * *", async () => {
    const limit = pLimit(1);

    const accounts = await AdsAccount.find({
      status: "ACTIVE",
      "sync_metadata.entities_status": "done",
    }).select("_id");

    await Promise.all(
      accounts.map((account) =>
        limit(() => syncInsightsForAccount(account._id))
      )
    );
  });

  console.log("✅ Sync cron jobs started:");
  console.log("  - Entity Sync: Daily at 3:00 AM");
  console.log("  - Insights Sync: Every 4 hours at :00 (e.g., 0:00, 4:00, 8:00)");
}


