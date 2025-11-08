import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import AdsAccount from "../models/ads/adsAccount.model.js";
import User from "../models/user.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import AdsCampaign from "../models/ads/adsCampaign.model.js";
import {
  fetchAccountInsights,
  saveInsightsToAdPerformance,
} from "../services/fbAdsService.js";

dotenv.config();

async function syncAllAccountsInsights() {
  try {
    await connectDB();
    console.log("✅ Connected to database");

    const accounts = await AdsAccount.find({
      status: "ACTIVE",
    }).populate("shop_admin_id", "_id");

    console.log(`📊 Found ${accounts.length} active accounts to sync`);

    if (accounts.length === 0) {
      console.log("⚠️ No active accounts found");
      process.exit(0);
    }

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const timeRange = {
      since: firstDayOfMonth.toISOString().split("T")[0],
      until: today.toISOString().split("T")[0],
    };

    console.log(`📅 Date range: ${timeRange.since} to ${timeRange.until}`);

    let successCount = 0;
    let errorCount = 0;
    let totalSaved = 0;
    let totalSkipped = 0;

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      console.log(`\n[${i + 1}/${accounts.length}] Processing account: ${account.name} (${account.external_id})`);

      try {
        if (!account.shop_admin_id) {
          console.log(`  ⚠️ Skipped: No shop_admin_id`);
          errorCount++;
          continue;
        }

        const user = await User.findById(account.shop_admin_id._id).select(
          "+facebookAccessToken"
        );

        if (!user || !user.facebookAccessToken) {
          console.log(`  ⚠️ Skipped: No Facebook access token for user ${account.shop_admin_id._id}`);
          errorCount++;
          continue;
        }

        const options = {
          level: "ad",
          needActions: true,
          actionBreakdowns: "action_type,action_destination",
          timeRange: timeRange,
        };

        console.log(`  🔄 Fetching insights from Facebook...`);
        const insightsData = await fetchAccountInsights(
          user.facebookAccessToken,
          account.external_id,
          options
        );

        console.log(`  📥 Fetched ${insightsData.length} insights records`);

        // Map page_name từ adset/campaign trong DB vào insightsData
        if (insightsData.length > 0) {
          const adsetExternalIds = [...new Set(insightsData.map(item => item.adset_id).filter(Boolean))];
          const campaignExternalIds = [...new Set(insightsData.map(item => item.campaign_id).filter(Boolean))];

          const [adsetsDocs, campaignsDocs] = await Promise.all([
            AdsSet.find({ external_id: { $in: adsetExternalIds } }).select('external_id page_name'),
            AdsCampaign.find({ external_id: { $in: campaignExternalIds } }).select('external_id page_name')
          ]);

          const adsetsMap = new Map(adsetsDocs.map(adset => [adset.external_id, adset]));
          const campaignsMap = new Map(campaignsDocs.map(campaign => [campaign.external_id, campaign]));

          insightsData.forEach(item => {
            const adset = item.adset_id ? adsetsMap.get(item.adset_id) : null;
            const campaign = item.campaign_id ? campaignsMap.get(item.campaign_id) : null;
            item.page_name = adset?.page_name || campaign?.page_name || null;
          });

          // Log để debug
          const withPageName = insightsData.filter(item => item.page_name).length;
          console.log(`  📄 Mapped page_name: ${withPageName}/${insightsData.length} records have page_name`);
        }

        if (insightsData.length > 0) {
          console.log(`  💾 Saving to database...`);
          const saveResult = await saveInsightsToAdPerformance(
            insightsData,
            account._id.toString()
          );

          totalSaved += saveResult.saved;
          totalSkipped += saveResult.skipped;

          console.log(
            `  ✅ Saved ${saveResult.saved} records, skipped ${saveResult.skipped}`
          );
          successCount++;
        } else {
          console.log(`  ℹ️ No insights data to save`);
          successCount++;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`  ❌ Error processing account:`, err.message);
        if (err.response?.data) {
          console.error(`     Facebook API error:`, err.response.data);
        }
        errorCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Success: ${successCount} accounts`);
    console.log(`  ❌ Errors: ${errorCount} accounts`);
    console.log(`  💾 Total saved: ${totalSaved} records`);
    console.log(`  ⏭️ Total skipped: ${totalSkipped} records`);

    console.log("\n✅ Sync completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

syncAllAccountsInsights();
