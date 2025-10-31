import mongoose from "mongoose";

const adsAccountSchema = new mongoose.Schema(
  {
    // 🧑‍💼 Chủ tài khoản quảng cáo (admin)
    shop_admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    shop_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "ShopUser" },
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" },

    // 🔗 Mã tài khoản quảng cáo từ Facebook (vd: act_123456)
    external_id: { type: String, trim: true, required: true },
    name: { type: String, trim: true },

    // 💰 Thông tin tài khoản quảng cáo
    currency: { type: String, default: "VND" },
    timezone_name: { type: String, default: "Asia/Ho_Chi_Minh" },
    account_status: { type: Number, default: 1 }, // 1 = Active (theo enum của FB)

    // 📊 Thống kê chi tiêu tổng
    campaign_spent_amount: { type: Number, default: 0 },
    group_spent_amount: { type: Number, default: 0 },
    ads_spent_amount: { type: Number, default: 0 },

    // ⚙️ Trạng thái nội bộ
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "PAUSED", "DELETED"],
      default: "ACTIVE",
    },

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    last_updated_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

adsAccountSchema.index({ external_id: 1 }, { unique: true });
adsAccountSchema.index({ shop_admin_id: 1 });
adsAccountSchema.index({ status: 1 });

const AdsAccount = mongoose.model("AdsAccount", adsAccountSchema);
export default AdsAccount;
