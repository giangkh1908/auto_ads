import cron from "node-cron";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { syncAdHourlyInsightsForAccount } from "../services/adHourlyInsightsService.js";
import { FEATURE_KEYS } from "../services/entitlementService.js";
import { filterAccountsByFeature } from "../services/accountFeatureGuard.js";

const VIETNAM_OFFSET_MINUTES = 7 * 60;
const VIETNAM_OFFSET_MS = VIETNAM_OFFSET_MINUTES * 60 * 1000;
const HOUR_IN_MS = 60 * 60 * 1000;

// ✅ FIX: Trả về thời gian THỰC tại thời điểm chạy, không làm tròn
function getCurrentRetrievedAt() {
  return new Date(); // Giờ phút giây hiện tại: 17:46:23
}

export const startAdHourlyInsightsCron = () => {
  // Chạy mỗi 30 phút
  cron.schedule("*/30 * * * *", async () => {
    const retrievedAt = getCurrentRetrievedAt(); 
    const retrievedAtIso = retrievedAt.toISOString();

    console.log(`[${retrievedAtIso}] 🚀 Starting ad hourly insights job (retrieved_at=${retrievedAtIso})`);

    try {
      const activeAccounts = await AdsAccount.find({ status: "ACTIVE" })
        .select("_id external_id name shop_admin_id")
        .lean();

      const { eligibleAccounts, skippedAccounts } = await filterAccountsByFeature(
        activeAccounts,
        FEATURE_KEYS.ANALYTICS_CHAT_AI
      );

      if (!eligibleAccounts || eligibleAccounts.length === 0) {
        console.log(
          `[${retrievedAtIso}] ⚠️ No eligible accounts with analytics feature (retrieved_at=${retrievedAtIso})`
        );
        return;
      }

      if (skippedAccounts > 0) {
        console.log(
          `[${retrievedAtIso}] ℹ️ Skipped ${skippedAccounts} account(s) without analytics feature (retrieved_at=${retrievedAtIso})`
        );
      }

      console.log(
        `[${retrievedAtIso}] 📊 Found ${eligibleAccounts.length} eligible accounts for hourly insights (retrieved_at=${retrievedAtIso})`
      );

      let totalProcessed = 0;
      let totalUpserts = 0;

      for (let index = 0; index < eligibleAccounts.length; index++) {
        const account = eligibleAccounts[index];
        const accountStart = new Date().toISOString();
        console.log(
          `[${accountStart}] 🔄 [${index + 1}/${eligibleAccounts.length}] Syncing hourly insights for account ${account.external_id} (retrieved_at=${retrievedAtIso})`
        );

        try {
          const result = await syncAdHourlyInsightsForAccount(account, { retrievedAtHour: retrievedAt }); // ✅ Pass thời gian thực
          totalProcessed += result?.processedAds || 0;
          totalUpserts += result?.upserts || 0;
          const accountEnd = new Date().toISOString();
          console.log(`[${accountEnd}] ✅ Account ${account.external_id}: processed ${result?.processedAds || 0} ads, upserted ${result?.upserts || 0} hourly snapshots (retrieved_at=${retrievedAtIso})`);
        } catch (error) {
          const errorTime = new Date().toISOString();
          console.error(`[${errorTime}] ❌ Error syncing hourly insights for account ${account.external_id} (retrieved_at=${retrievedAtIso}):`, error.message);
        }
      }

      const completedTime = new Date().toISOString();
      console.log(`[${completedTime}] 📈 Hourly insights job finished for retrieved_at=${retrievedAtIso}: processed ${totalProcessed} ads, upserted ${totalUpserts} snapshots`);
    } catch (error) {
      const errorTime = new Date().toISOString();
      console.error(`[${errorTime}] ❌ Hourly insights cron error (retrieved_at=${retrievedAtIso}):`, error.message);
    }
  });

  console.log("✅ Ad hourly insights cronjob scheduled - runs every 30 minutes");
};
