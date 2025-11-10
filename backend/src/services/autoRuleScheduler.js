import cron from "node-cron";
import AutomationRule from "../models/ads/autoRule.model.js";
import { processRule } from "./autoRuleService.js";

let schedulerTask = null;

/**
 * Khởi chạy cron job scheduler
 * Chạy mỗi phút để kiểm tra và xử lý rules
 */
export function startAutoRuleScheduler() {
  if (schedulerTask) {
    console.log("AutoRule scheduler is already running");
    return;
  }

  console.log("Starting AutoRule scheduler...");

  // Chạy mỗi phút: "* * * * *"
  schedulerTask = cron.schedule("* * * * *", async () => {
    try {
      await processScheduledRules();
    } catch (error) {
      console.error("Error in AutoRule scheduler:", error);
    }
  });

  console.log("AutoRule scheduler started. Running every minute.");
}

/**
 * Dừng cron job scheduler
 */
export function stopAutoRuleScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log("AutoRule scheduler stopped");
  }
}

/**
 * Xử lý các rules đã đến lúc chạy
 */
async function processScheduledRules() {
  try {
    const now = new Date();

    // Query tất cả rules cần chạy (bao gồm ACTIVE và TRIGGERED)
    const rules = await AutomationRule.find({
      enabled: true,
      status: { $in: ["ACTIVE", "TRIGGERED"] },
      deleted_at: null,
      next_run_at: { $lte: now },
    })
      .populate("account_id", "external_id name")
      .populate("created_by", "full_name email")
      .populate("subscriber_id", "full_name email");

    if (rules.length === 0) {
      return;
    }

    console.log(`Found ${rules.length} rule(s) to process`);

    // Xử lý từng rule
    // Sử dụng Promise.allSettled để không bị gián đoạn nếu một rule lỗi
    const results = await Promise.allSettled(
      rules.map((rule) => processRule(rule))
    );

    // Log kết quả
    let successCount = 0;
    let errorCount = 0;
    let triggeredCount = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successCount++;
        if (result.value.triggered) {
          triggeredCount++;
        }
      } else {
        errorCount++;
        console.error(
          `Error processing rule ${rules[index]._id}:`,
          result.reason
        );
      }
    });

    if (successCount > 0 || triggeredCount > 0) {
      console.log(
        `Processed ${rules.length} rule(s): ${successCount} success, ${errorCount} errors, ${triggeredCount} triggered`
      );
    }
  } catch (error) {
    console.error("Error in processScheduledRules:", error);
  }
}

/**
 * Manually trigger processing (for testing)
 */
export async function triggerManualProcess() {
  console.log("Manual trigger: Processing scheduled rules...");
  await processScheduledRules();
}

