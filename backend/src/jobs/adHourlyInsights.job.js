import cron from "node-cron";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { syncAdHourlyInsightsForAccount } from "../services/adHourlyInsightsService.js";

const VIETNAM_OFFSET_MINUTES = 7 * 60;
const VIETNAM_OFFSET_MS = VIETNAM_OFFSET_MINUTES * 60 * 1000;
const HOUR_IN_MS = 60 * 60 * 1000;

function getCurrentRetrievedAtHour() {
  const now = new Date();
  const nowUtcMs = now.getTime();
  const nowVietnamMs = nowUtcMs + VIETNAM_OFFSET_MS;
  const truncatedVietnamMs = Math.floor(nowVietnamMs / HOUR_IN_MS) * HOUR_IN_MS;

  const retrievedAtHourUtcMs = truncatedVietnamMs - VIETNAM_OFFSET_MS;
  return new Date(retrievedAtHourUtcMs);
}

export const startAdHourlyInsightsCron = () => {
  cron.schedule("10 * * * *", async () => {
    const retrievedAtHour = getCurrentRetrievedAtHour();
    const retrievedAtHourIso = retrievedAtHour.toISOString();

    console.log(`[${retrievedAtHourIso}] 🚀 Starting ad hourly insights job (retrieved_at_hour=${retrievedAtHourIso})`);

    try {
      const activeAccounts = await AdsAccount.find({ status: "ACTIVE" })
        .select("_id external_id name")
        .lean();

      if (!activeAccounts || activeAccounts.length === 0) {
        console.log(`[${retrievedAtHourIso}] ⚠️ No active accounts found for hourly insights (retrieved_at_hour=${retrievedAtHourIso})`);
        return;
      }

      console.log(`[${retrievedAtHourIso}] 📊 Found ${activeAccounts.length} active accounts for hourly insights (retrieved_at_hour=${retrievedAtHourIso})`);

      let totalProcessed = 0;
      let totalUpserts = 0;

      for (let index = 0; index < activeAccounts.length; index++) {
        const account = activeAccounts[index];
        const accountStart = new Date().toISOString();
        console.log(`[${accountStart}] 🔄 [${index + 1}/${activeAccounts.length}] Syncing hourly insights for account ${account.external_id} (retrieved_at_hour=${retrievedAtHourIso})`);

        try {
          const result = await syncAdHourlyInsightsForAccount(account, { retrievedAtHour });
          totalProcessed += result?.processedAds || 0;
          totalUpserts += result?.upserts || 0;
          const accountEnd = new Date().toISOString();
          console.log(`[${accountEnd}] ✅ Account ${account.external_id}: processed ${result?.processedAds || 0} ads, upserted ${result?.upserts || 0} hourly snapshots (retrieved_at_hour=${retrievedAtHourIso})`);
        } catch (error) {
          const errorTime = new Date().toISOString();
          console.error(`[${errorTime}] ❌ Error syncing hourly insights for account ${account.external_id} (retrieved_at_hour=${retrievedAtHourIso}):`, error.message);
        }
      }

      const completedTime = new Date().toISOString();
      console.log(`[${completedTime}] 📈 Hourly insights job finished for retrieved_at_hour=${retrievedAtHourIso}: processed ${totalProcessed} ads, upserted ${totalUpserts} snapshots`);
    } catch (error) {
      const errorTime = new Date().toISOString();
      console.error(`[${errorTime}] ❌ Hourly insights cron error (retrieved_at_hour=${retrievedAtHourIso}):`, error.message);
    }
  });

  console.log("✅ Ad hourly insights cronjob scheduled - runs hourly at minute 10");
};
