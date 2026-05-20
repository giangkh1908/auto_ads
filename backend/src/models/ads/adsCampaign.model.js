import mongoose from "mongoose";

const adsCampaignSchema = new mongoose.Schema(
  {
    // Liên kết với cửa hàng
    shop_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: false,
      default: null,
    },

    // Liên kết với tài khoản quảng cáo (luôn bắt buộc)
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdsAccount",
      required: true,
    },

    // ID tài khoản trên Facebook (act_xxx)
    external_account_id: {
      type: String,
      index: true,
      trim: true,
    },

    // ID chiến dịch trên Facebook (có sau khi publish)
    external_id: { type: String, trim: true },

    // Tên chiến dịch
    name: { type: String, required: true, trim: true },

    // Thông tin trang Page chạy quảng cáo
    page_id: { type: String, trim: true, default: null },
    page_name: { type: String, trim: true, default: null },

    // Cấu hình chiến dịch
    objective: {
      type: String,
      enum: [
        "AWARENESS",
        "TRAFFIC",
        "ENGAGEMENT",
        "LEADS",
        "APP_PROMOTION",
        "SALES",
      ],
    },
    buying_type: { type: String, default: "AUCTION" },
    bid_strategy: { type: String, trim: true },

    // Ngân sách
    daily_budget: { type: Number, min: 0 },
    lifetime_budget: { type: Number, min: 0 },
    spend_cap: { type: Number, default: null },

    // Đối tượng & gắn nhãn
    promoted_object: { type: mongoose.Schema.Types.Mixed, default: {} },
    adlabels: { type: [mongoose.Schema.Types.Mixed], default: [] },

    start_time: { type: Date },
    stop_time: { type: Date },

    // Trạng thái
    status: {
      type: String,
      enum: ["PAUSED", "ACTIVE", "DELETED", "ARCHIVED", "DRAFT", "FAILED"],
      default: "DRAFT",
    },
    configured_status: {
      type: String,
      enum: ["PAUSED", "ACTIVE", "DELETED", "ARCHIVED", "DRAFT"],
    },
    effective_status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED", "IN_PROCESS", "WITH_ISSUES"],
    },

    // 🧭 Orchestrator helpers
    // publish_request_id để tránh trùng khi gửi request publish — có thể null
    publish_request_id: { type: String, trim: true, default: null },
    wizard_id: { type: mongoose.Schema.Types.ObjectId, default: null },

    // Insights từ Facebook (đầy đủ các chỉ số như AdPerformance)
    insights: {
      impressions: { type: Number, default: 0 },
      reach: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      spend: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      frequency: { type: Number, default: 0 },
      cpc: { type: Number, default: null },
      cpm: { type: Number, default: null },
      ctr: { type: Number, default: null },
      conversion_rate: { type: Number, default: null },
      cost_per_conversion: { type: Number, default: null },
      results: { type: Number, default: 0 },
      cost_per_result: { type: Number, default: null },
      link_clicks: { type: Number, default: 0 },
      link_cpc: { type: Number, default: null },
      link_ctr: { type: Number, default: null },
      website_purchases: { type: Number, default: 0 },
      website_purchase_roas: { type: Number, default: null },
      audience_reach_percentage: { type: Number, default: null },
      quality_ranking: { type: String, default: null },
      post_engagement: { type: Number, default: 0 },
      leads: { type: Number, default: 0 },
      cost_per_lead: { type: Number, default: null },
      mobile_app_install: { type: Number, default: 0 },
      cost_per_mobile_app_install: { type: Number, default: null },
      actions: { type: mongoose.Schema.Types.Mixed, default: [] },
      insights_updated_at: { type: Date, default: null },
    },

    // Meta & audit
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// ===== Indexes =====

// external_id chỉ unique khi có giá trị thật (tránh trùng null)
adsCampaignSchema.index(
  { external_id: 1 },
  {
    unique: true,
    partialFilterExpression: { external_id: { $exists: true, $ne: null } },
  }
);

// publish_request_id — cho phép nhiều null, chỉ unique khi có giá trị thật
adsCampaignSchema.index(
  { publish_request_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      publish_request_id: { $exists: true, $ne: null },
    },
  }
);

// Các index bổ trợ tìm kiếm
adsCampaignSchema.index({ shop_id: 1 });
adsCampaignSchema.index({ account_id: 1 });
adsCampaignSchema.index({ status: 1 });
adsCampaignSchema.index({ page_id: 1 });

const AdsCampaign = mongoose.model("AdsCampaign", adsCampaignSchema);
export default AdsCampaign;
