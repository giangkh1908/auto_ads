import cron from "node-cron";
import { syncAdPerformanceData } from "../services/adPerformanceService.js";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { FEATURE_KEYS } from "../services/entitlementService.js";
import { filterAccountsByFeature } from "../services/accountFeatureGuard.js";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const startAdPerformanceCron = () => {
  cron.schedule("*/30 * * * *", async () => {
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] 🚀 Starting ad performance sync job for all accounts...`);
    
    try {
      const activeAccounts = await AdsAccount.find({
        status: "ACTIVE",
      })
        .select("_id external_id name shop_admin_id")
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
      let totalSkipped = 0;
      let totalZeroRecords = 0;
      let rateLimitedAccounts = [];
      
      for (let i = 0; i < eligibleAccounts.length; i++) {
        const account = eligibleAccounts[i];
        const accountStartTime = new Date().toISOString();
        
        console.log(
          `[${accountStartTime}] 🔄 [${i + 1}/${eligibleAccounts.length}] Syncing account: ${account.name} (${account.external_id})`
        );
        
        try {
          const result = await syncAdPerformanceData(account.external_id);
          
          if (result.rateLimitReached) {
            console.warn(`[${accountStartTime}] ⚠️ Rate limit reached for account ${account.external_id}, stopping sync`);
            rateLimitedAccounts.push(account.external_id);
            break;
          }
          
          totalSynced += result.synced || 0;
          totalSkipped += result.skipped || 0;
          totalZeroRecords += result.zeroRecordsCreated || 0;
          
          console.log(`[${accountStartTime}] ✅ Account ${account.external_id}: Synced ${result.synced || 0} records, skipped ${result.skipped || 0} ads, created ${result.zeroRecordsCreated || 0} zero records`);
          
          if (i < eligibleAccounts.length - 1) {
            await delay(5000);
          }
        } catch (error) {
          if (error.response?.data?.error?.code === 17 || 
              error.response?.data?.error?.error_subcode === 2446079) {
            console.warn(`[${accountStartTime}] ⚠️ Rate limit reached for account ${account.external_id}, stopping sync`);
            rateLimitedAccounts.push(account.external_id);
            break;
          } else {
            console.error(`[${accountStartTime}] ❌ Error syncing account ${account.external_id}:`, error.message);
          }
        }
      }
      
      const endTime = new Date().toISOString();
      const summary = {
        totalAccounts: eligibleAccounts.length,
        syncedAccounts: eligibleAccounts.length - rateLimitedAccounts.length,
        rateLimitedAccounts: rateLimitedAccounts.length,
        totalSynced: totalSynced,
        totalSkipped: totalSkipped,
        totalZeroRecords: totalZeroRecords
      };
      
      console.log(`[${endTime}] ✅ Sync job completed:`, summary);
      
      if (rateLimitedAccounts.length > 0) {
        console.warn(`[${endTime}] ⚠️ Rate limited accounts: ${rateLimitedAccounts.join(", ")}`);
      }
    } catch (error) {
      const errorTime = new Date().toISOString();
      console.error(`[${errorTime}] ❌ Cronjob error:`, error.message);
    }
  });

  console.log("✅ Ad performance cronjob started - runs every 30 minutes, syncs each account separately");
};