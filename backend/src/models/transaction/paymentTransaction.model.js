import mongoose from "mongoose";

const paymentTransactionSchema = new mongoose.Schema(
  {
    // Người thanh toán
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Shop liên quan
    // shop_id: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Shop",
    //   required: true,
    // },

    // Gói dịch vụ liên quan (nếu có)
    package_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },

    // Số tiền
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Loại tiền tệ
    currency: {
      type: String,
      default: "VND",
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },

    // Hình thức thanh toán (VD: momo, vnpay, banking, paypal)
    method: {
      type: String,
      trim: true,
    },

    // Mã tham chiếu từ cổng thanh toán (Momo, PayPal, v.v.)
    provider_ref: {
      type: String,
      trim: true,
    },

    webhook_events: [{ type: String }],

    // Trạng thái giao dịch
    status: {
      type: String,
      enum: ["pending", "success", "failed", "canceled", "rejected", "initializing"],
      default: "initializing",
    },

    // Metadata bổ sung
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Nhân viên CS được gán xử lý giao dịch
    assigned_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Audit
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    expired_date: { type: Date, default: null},
    payment_at: {type: Date, default: null},
    accept_at: {type: Date, default: null},
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Indexes
paymentTransactionSchema.index({ user_id: 1 });
// paymentTransactionSchema.index({ shop_id: 1 });
paymentTransactionSchema.index({ package_id: 1 });
paymentTransactionSchema.index({ status: 1 });
paymentTransactionSchema.index({ created_at: -1 });
// Composite index for expired payments cron job query optimization
paymentTransactionSchema.index({ status: 1, expired_date: 1 });

const PaymentTransaction = mongoose.model("PaymentTransaction", paymentTransactionSchema);
export default PaymentTransaction;