import mongoose from "mongoose";

const adsAccountSchema = new mongoose.Schema(
  {
    // 🧑‍💼 Owner chính (user đầu tiên connect account này)
    shop_admin_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
    
    // 👥 Danh sách tất cả users có quyền truy cập account này (bao gồm cả owner)
    user_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
      index: true
    },
    
    shop_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "ShopUser" },
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" }, // Optional

    external_id: { type: String, trim: true, required: true },
    name: { type: String, trim: true },

    currency: { type: String, default: "VND" },
    timezone_name: { type: String, default: "Asia/Ho_Chi_Minh" },
    account_status: { type: Number, default: 1 },

    campaign_spent_amount: { type: Number, default: 0 },
    group_spent_amount: { type: Number, default: 0 },
    ads_spent_amount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "PAUSED", "DELETED"],
      default: "ACTIVE",
    },

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    last_updated_at: { type: Date, default: null },

    sync_metadata: {
      entities_status: {
        type: String,
        enum: ["idle", "syncing", "done", "failed"],
        default: "idle",
      },
      entities_last_synced_at: { type: Date, default: null },
      entities_error: { type: String, default: null },

      insights_status: {
        type: String,
        enum: ["idle", "syncing", "done", "failed"],
        default: "idle",
      },
      insights_last_synced_at: { type: Date, default: null },
      insights_sync_interval_hours: { type: Number, default: 2 },
      insights_error: { type: String, default: null },

      backfill_status: {
        type: String,
        enum: ["idle", "in_progress", "done", "failed"],
        default: "idle",
      },
      backfill_progress_percent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      backfill_current_date: { type: String, default: null },
      backfill_start_date: { type: String, default: null },
      backfill_end_date: { type: String, default: null },
      backfill_error: { type: String, default: null },
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

adsAccountSchema.index({ external_id: 1 }, { unique: true });
adsAccountSchema.index({ shop_admin_id: 1 });
adsAccountSchema.index({ user_ids: 1 }); // Index cho array để query nhanh
adsAccountSchema.index({ status: 1 });

// Virtual để dễ dàng check user có quyền truy cập không
adsAccountSchema.methods.hasAccess = function(userId) {
  if (!userId || !this.user_ids || this.user_ids.length === 0) return false;
  return this.user_ids.some(id => id.toString() === userId.toString());
};

const AdsAccount = mongoose.model("AdsAccount", adsAccountSchema);
export default AdsAccount;
