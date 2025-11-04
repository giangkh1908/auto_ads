import mongoose from "mongoose";

const adsSetSchema = new mongoose.Schema(
  {
    campaign_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "AdsCampaign",
      required: true,  // Mỗi AdSet phải thuộc về một Campaign
      index: true
    },
    external_account_id: { 
      type: String, 
      index: true 
    },
    // ID ad set trên Facebook (có sau publish)
    external_id: { type: String, trim: true },

    name: { type: String, trim: true },

    // 📄 Thông tin trang Page chạy quảng cáo (di chuyển từ Campaign)
    page_id: { type: String, trim: true, default: null },
    page_name: { type: String, trim: true, default: null },

    // ⚙️ Trạng thái
    status: {
      type: String,
      enum: ["PAUSED", "ACTIVE", "DELETED", "ARCHIVED", "DRAFT", "FAILED"],
      default: "DRAFT",
    },
    configured_status: { type: String },
    effective_status: { type: String },

    // 🎯 Cài đặt tối ưu
    optimization_goal: { type: String, trim: true },
    billing_event: { type: String, trim: true },
    bid_strategy: { type: String, trim: true },
    bid_amount: { type: Number, default: null },

    // Sự kiện chuyển dổi
    pixel_id: { type: String, trim: true, default: null },
    conversion_event: { type: String, trim: true, default: null },

    // 🧭 Đối tượng mục tiêu
    promoted_object: { type: mongoose.Schema.Types.Mixed, default: {} },
    targeting: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Vị trí chuyển đổi/Lưu lượng (WEBSITE/APP/MESSAGING/CALLS/ON_POST/ON_PAGE/ON_EVENT...)
    traffic_destination: { type: String, trim: true, default: null },

    // 💰 Ngân sách & thời gian
    daily_budget: { type: Number },
    lifetime_budget: { type: Number },
    start_time: { type: Date },
    end_time: { type: Date },

    // Audit
    deleted_at: { type: Date, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Index
adsSetSchema.index(
  { external_id: 1 },
  { unique: true, partialFilterExpression: { external_id: { $type: "string" } } }
);
adsSetSchema.index({ campaign_id: 1 });
adsSetSchema.index({ status: 1 });

const AdsSet = mongoose.model("AdsSet", adsSetSchema);
export default AdsSet;
