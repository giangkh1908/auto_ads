import cron from "node-cron";
import { syncAnalyticsSnapshots } from "../services/analyticsSnapshotService.js";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { FEATURE_KEYS } from "../services/entitlementService.js";
import { filterAccountsByFeature } from "../services/accountFeatureGuard.js";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const startAnalyticsSnapshotCron = () => {
  // Run once daily at 4:00 AM (analytics data ít thay đổi, không cần sync thường xuyên)
  cron.schedule("0 4 * * *", async () => {
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] 🚀 Starting analytics snapshot sync job...`);

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

      for (let i = 0; i < eligibleAccounts.length; i++) {
        const account = eligibleAccounts[i];
        const accountStartTime = new Date().toISOString();

        console.log(
          `[${accountStartTime}] 🔄 [${i + 1}/${eligibleAccounts.length}] Syncing account: ${account.name || account.external_id}`
        );

        try {
          const result = await syncAnalyticsSnapshots(account);
          
          totalSynced += result.synced;
          totalErrors += result.errors;

          console.log(
            `[${accountStartTime}] ✅ Account ${account.name}: ${result.synced} synced, ${result.errors} errors`
          );
        } catch (error) {
          console.error(
            `[${accountStartTime}] ❌ Failed to sync account ${account.name}:`,
            error.message
          );
          totalErrors++;
        }

        // Small delay to avoid overwhelming DB (aggregation is fast, but still good practice)
        if (i < eligibleAccounts.length - 1) {
          await delay(500); // Reduced from 2000ms since we're only aggregating from DB
        }
      }

      const endTime = new Date().toISOString();
      console.log(
        `[${endTime}] 🎉 Analytics snapshot sync completed: ${totalSynced} total synced, ${totalErrors} total errors`
      );
    } catch (error) {
      console.error(
        `[${startTime}] ❌ Analytics snapshot sync job failed:`,
        error.message
      );
    }
  });

  console.log("✅ Analytics snapshot cron job registered (runs daily at 4:00 AM)");
};
