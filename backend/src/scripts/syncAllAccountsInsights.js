import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import AdsAccount from "../models/ads/adsAccount.model.js";
import Ads from "../models/ads/ads.model.js";
import AdPerformance from "../models/ads/adPerformance.model.js";
import "../models/package.model.js";
import "../models/userPackage.model.js";
import { FEATURE_KEYS } from "../services/entitlementService.js";
import { filterAccountsByFeature } from "../services/accountFeatureGuard.js";
import { syncInsightsForAccount } from "../services/ads/insightsSyncService.js";

dotenv.config();

async function syncAllAccountsInsights() {
  try {
    await connectDB();
    console.log("✅ Connected to database");

    const accounts = await AdsAccount.find({
      status: "ACTIVE",
    }).lean();

    const { eligibleAccounts, skippedAccounts } = await filterAccountsByFeature(
      accounts,
      FEATURE_KEYS.ANALYTICS_CHAT_AI
    );

    console.log(`📊 Found ${eligibleAccounts.length} eligible accounts to sync`);
    if (skippedAccounts) {
      console.log(`ℹ️ Skipped ${skippedAccounts} account(s) without analytics feature`);
    }

    if (eligibleAccounts.length === 0) {
      console.log("⚠️ No active accounts found");
      process.exit(0);
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < eligibleAccounts.length; i++) {
      const account = eligibleAccounts[i];
      console.log(
        `\n[${i + 1}/${eligibleAccounts.length}] Processing account: ${account.name} (${account.external_id})`
      );

      try {
        await syncInsightsForAccount(account._id.toString());

        const externalId = account.external_id || "";
        const normalizedId = externalId.startsWith("act_")
          ? externalId.substring(4)
          : externalId;

        const adsCount = await Ads.countDocuments({
          external_account_id: { $in: [normalizedId, `act_${normalizedId}`] },
          status: { $nin: ["DELETED", "ARCHIVED"] },
        });

        const performanceCount = await AdPerformance.countDocuments({
          external_account_id: normalizedId,
        });

        console.log(
          `  📈 Ads in DB: ${adsCount}, AdPerformance rows: ${performanceCount}`
        );

        successCount++;
      } catch (err) {
        console.error(`  ❌ Error processing account:`, err.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Success: ${successCount} accounts`);
    console.log(`  ❌ Errors: ${errorCount} accounts`);

    console.log("\n✅ Sync completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

syncAllAccountsInsights();
