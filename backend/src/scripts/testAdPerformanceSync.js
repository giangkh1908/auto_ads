import { syncAdPerformanceData } from "../services/adPerformanceService.js";
import mongoose from "mongoose";

// Import tất cả models cần thiết
import "../models/user.model.js";
import "../models/ads/adsAccount.model.js";
import "../models/ads/adPerformance.model.js";
import "../models/ads/adsCampaign.model.js";
import "../models/ads/adsSet.model.js";
import "../models/ads/ads.model.js";

(async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    
    await mongoose.connect("mongodb+srv://giangkh1908:iAAHizsmk0UdSKP3@auto-ads-management-sys.ctz7894.mongodb.net/");
    
    console.log("✅ Connected to MongoDB\n");

    const accountExternalId = "act_2110275049498872";
    
    // Test 1: Default 2 days
    console.log("=".repeat(50));
    console.log(`🔍 TEST 1: Default time range (2 days)`);
    console.log("=".repeat(50));
    const result = await syncAdPerformanceData(accountExternalId);
    console.log("Result:", JSON.stringify(result, null, 2));
    
    // Test 2: Custom 30 days (để lấy dữ liệu từ 01/11)
    console.log("\n" + "=".repeat(50));
    console.log(`🔍 TEST 2: Custom time range (30 days)`);
    console.log("=".repeat(50));
    const customResult = await syncAdPerformanceData(accountExternalId, {
      timeRange: {
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        until: new Date().toISOString().split('T')[0]
      }
    });
    console.log("Result:", JSON.stringify(customResult, null, 2));
    
    // Check data in database
    console.log("\n" + "=".repeat(50));
    console.log(`📊 Checking saved data in database...`);
    console.log("=".repeat(50));

    const AdPerformance = mongoose.model('AdPerformance');
    const savedData = await AdPerformance.find({
      account_id: new mongoose.Types.ObjectId("690730eb6e1597b93d137c5d"), // Thêm 'new'
      date: { $gte: new Date("2025-11-01") }
    }).sort({ date: -1 }).lean();

    console.log(`\nFound ${savedData.length} records in database (from 2025-11-01):\n`);
    savedData.forEach(record => {
      const dateStr = new Date(record.date).toISOString().split('T')[0];
      const hasData = record.impressions > 0 || record.spend > 0;
      const icon = hasData ? '✅' : '❌';
      console.log(`${icon} ${dateStr} | Impressions: ${record.impressions}, Spend: ${record.spend}, Clicks: ${record.clicks}`);
    });
    
  } catch (error) {
    console.error("\n❌ ERROR:");
    console.error("Message:", error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Done - Disconnected from MongoDB");
    process.exit(0);
  }
})();