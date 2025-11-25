import cron from "node-cron";
import PaymentTransaction from "../models/paymentTransaction.model.js";
import UserPackage from "../models/userPackage.model.js";
import User from "../models/user.model.js";
import Package from "../models/package.model.js";
import { sendOrderTimeoutEmail } from "../services/emailService.js";

/**
 * Cancel expired payment transactions
 * Runs every minute to check and cancel transactions with status "initializing" that have expired
 */
async function cancelExpiredPayments() {
  try {
    const now = new Date();

    // Find all initializing transactions that have expired
    const expiredTransactions = await PaymentTransaction.find({
      status: "initializing",
      expired_date: { $lte: now, $ne: null },
      deleted_at: null,
    });

    if (expiredTransactions.length === 0) {
      return;
    }

    console.log(`[${now.toISOString()}] 🔍 Found ${expiredTransactions.length} expired payment transaction(s) with status "initializing"`);

    let canceledCount = 0;
    let errorCount = 0;

    for (const transaction of expiredTransactions) {
      try {
        // Double check status before canceling (avoid race condition)
        const currentTransaction = await PaymentTransaction.findById(transaction._id);
        if (!currentTransaction || currentTransaction.status !== "initializing") {
          continue; // Already processed by another process
        }

        // Update transaction status to canceled
        await PaymentTransaction.findByIdAndUpdate(
          transaction._id,
          {
            status: "canceled",
            metadata: {
              ...(currentTransaction.metadata || {}),
              rejectReason: "Đơn hàng đã tự động hủy do hết thời gian thanh toán (10 phút)",
              autoCanceledAt: new Date(),
            },
            updated_by: null, // System cancel
          },
          { new: true }
        );

        // Update related UserPackage status if exists
        // Reuse logic from updatePaymentTransaction
        try {
          // Tìm UserPackage có user_id và package_id tương ứng với status "pending" hoặc "active"
          const userPackage = await UserPackage.findOne({
            user_id: transaction.user_id,
            package_id: transaction.package_id,
            status: { $in: ["pending", "active"] },
          }).sort({ created_at: -1 });

          if (userPackage) {
            await UserPackage.findByIdAndUpdate(
              userPackage._id,
              {
                status: "cancelled",
                updated_by: null,
              },
              { new: true }
            );

            console.log(`✅ Updated UserPackage ${userPackage._id} status from "${userPackage.status}" to "cancelled"`);
          }
        } catch (userPackageError) {
          console.error(`⚠️ Error updating UserPackage for transaction ${transaction._id}:`, userPackageError.message);
          // Continue with transaction cancellation even if UserPackage update fails
        }

        // Send email notification to user
        try {
          const user = await User.findById(transaction.user_id).select("email full_name").lean();
          const packageInfo = await Package.findById(transaction.package_id).select("name").lean();

          if (user && user.email) {
            await sendOrderTimeoutEmail(
              user.email,
              user.full_name || "Khách hàng",
              {
                orderId: transaction._id.toString(),
                packageName: packageInfo?.name || "Gói dịch vụ",
                amount: transaction.amount,
              }
            );
            console.log(`✅ Sent timeout email to ${user.email}`);
          }
        } catch (emailError) {
          console.error(`⚠️ Error sending timeout email for transaction ${transaction._id}:`, emailError.message);
          // Continue even if email fails
        }

        canceledCount++;
        console.log(`✅ Canceled expired transaction ${transaction._id}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error canceling transaction ${transaction._id}:`, error.message);
      }
    }

    if (canceledCount > 0) {
      console.log(`✅ Successfully canceled ${canceledCount} expired transaction(s)`);
    }
    if (errorCount > 0) {
      console.error(`❌ Failed to cancel ${errorCount} transaction(s)`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error in cancelExpiredPayments cron:`, error);
  }
}

/**
 * Start the cron job to cancel expired payments
 * Runs every minute: "* * * * *"
 */
export const startCancelExpiredPaymentsCron = () => {
  // Run every minute
  cron.schedule("* * * * *", async () => {
    await cancelExpiredPayments();
  });

  console.log("✅ Cancel expired payments cronjob started - runs every minute");
};

// Export function for manual execution if needed
export { cancelExpiredPayments };

