import cron from "node-cron";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { syncInsightsForAccount } from "../services/insightsSyncService.js";
import { processNextBackfillChunk } from "../services/backfillService.js";
import pLimit from "p-limit";

export function startSyncCronJobs() {
  cron.schedule("0 */2 * * *", async () => {
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

  // Backfill - Mỗi 30 phút, phút 15 và 45 (lệch với các jobs khác)
  cron.schedule("15,45 * * * *", async () => {
    await processNextBackfillChunk();
  });

  console.log("✅ Sync cron jobs started:");
  console.log("  - Insights Sync: Every 2 hours at :00 (e.g., 0:00, 2:00, 4:00)");
  console.log("  - Backfill: At :15 and :45 each hour (e.g., 0:15, 0:45, 1:15)");
}


