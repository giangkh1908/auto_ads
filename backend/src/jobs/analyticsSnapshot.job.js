import cron from "node-cron";
import { syncAnalyticsSnapshots } from "../services/analyticsSnapshotService.js";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { FEATURE_KEYS } from "../services/entitlementService.js";
import { filterAccountsByFeature } from "../services/accountFeatureGuard.js";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const startAnalyticsSnapshotCron = () => {
  // Run every 4 hours at 1:00, 5:00, 9:00, 13:00, 17:00, 21:00 
  // (1 hour after each Insights Sync to ensure Ads.insights is updated)
  cron.schedule("0 1,5,9,13,17,21 * * *", async () => {
    const startTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    console.log(`[${startTime}] 📈 Starting analytics snapshot sync job (copy from Ads.insights)...`);

    try {
      const activeAccounts = await AdsAccount.find({
        status: "ACTIVE",
      })
        .select("_id external_id name")
        .lean();

      const { eligibleAccounts, skippedAccounts } = await filterAccountsByFeature(
        activeAccounts,
        FEATURE_KEYS.ANALYTICS_CHAT_AI
      );

      if (!eligibleAccounts || eligibleAccounts.length === 0) {
        console.log(
          `[${startTime}] ⚠️ No eligible accounts with analytics feature, skipping sync`
        );
        return;
      }

      if (skippedAccounts > 0) {
        console.log(
          `[${startTime}] ℹ️ Skipped ${skippedAccounts} account(s) without analytics feature`
        );
      }

      console.log(
        `[${startTime}] 📊 Found ${eligibleAccounts.length} eligible accounts to sync`
      );

      let totalSynced = 0;
      let totalErrors = 0;
      let totalSkipped = 0;

      for (let i = 0; i < eligibleAccounts.length; i++) {
        const account = eligibleAccounts[i];
        const accountStartTime = new Date().toISOString();

        console.log(
          `[${accountStartTime}] 🔄 [${i + 1}/${eligibleAccounts.length}] Syncing snapshots for: ${account.name || account.external_id}`
        );

        try {
          const result = await syncAnalyticsSnapshots(account);
          
          totalSynced += result.synced || 0;
          totalErrors += result.errors || 0;
          totalSkipped += result.skipped || 0;

          console.log(
            `[${accountStartTime}] ✅ Account ${account.name}: ${result.synced || 0} synced, ${result.skipped || 0} skipped, ${result.errors || 0} errors`
          );
        } catch (error) {
          console.error(
            `[${accountStartTime}] ❌ Failed to sync account ${account.name}:`,
            error.message
          );
          totalErrors++;
        }

        // Small delay to avoid overwhelming DB (copy operation is very fast)
        if (i < eligibleAccounts.length - 1) {
          await delay(200); // Very short delay since we're just copying Ads.insights
        }
      }

      const endTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      console.log(
        `[${endTime}] 🎉 Analytics snapshot sync completed: ${totalSynced} synced, ${totalSkipped} skipped (no insights), ${totalErrors} errors`
      );
    } catch (error) {
      console.error(
        `[${startTime}] ❌ Analytics snapshot sync job failed:`,
        error.message
      );
    }
  });

  console.log("✅ Analytics snapshot cron job registered (runs every 4 hours at 1:00, 5:00, 9:00, 13:00, 17:00, 21:00)");
};
