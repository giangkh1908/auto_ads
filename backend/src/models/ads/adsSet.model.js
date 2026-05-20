import mongoose from "mongoose";

const adsSetSchema = new mongoose.Schema(
  {
    campaign_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "AdsCampaign",
      required: true,  // Mỗi AdSet phải thuộc về một Campaign
    },
    external_account_id: { 
      type: String, 
      index: true 
    },
    // ID ad set trên Facebook (có sau publish)
    external_id: { type: String, trim: true },

    name: { type: String, required: true, trim: true },

    // 📄 Thông tin trang Page chạy quảng cáo (di chuyển từ Campaign)
    page_id: { type: String, trim: true, default: null },
    page_name: { type: String, trim: true, default: null },

    // ⚙️ Trạng thái
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

    // 🎯 Cài đặt tối ưu
    optimization_goal: {
      type: String,
      enum: [
        "NONE",
        "DAILY_UNIQUE_ACTIONS",
        "VISIT_PIXEL_EVENTS",
        "OFFSITE_CONVERSIONS",
        "APP_INSTALLS",
        "APP_CUSTOM_EVENTS",
        "LINK_CLICKS",
        "LANDING_PAGE_VIEWS",
        "IMPRESSIONS",
        "REACH",
        "VALUE",
        "LEAD_GENERATION",
        "CONVERSATIONS",
        "REMOTE_FB_EVENT",
      ],
    },
    billing_event: {
      type: String,
      enum: ["APP_INSTALLS", "CLICKS", "IMPRESSIONS", "LINK_CLICKS", "OFFERCLAIMS", "PURCHASE", "THRUPLAY", "LISTING_INTERACTION", "VIDEO_VIEWS", "NONE", "PAGE_LIKES"],
    },
    bid_strategy: {
      type: String,
      enum: ["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "TARGET_COST"],
    },
    bid_amount: { type: Number, default: null },

    // Sự kiện chuyển dổi
    pixel_id: { type: String, trim: true, default: null },
    conversion_event: { type: String, trim: true, default: null },

    // 🧭 Đối tượng mục tiêu
    promoted_object: { type: mongoose.Schema.Types.Mixed, default: {} },
    targeting: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Vị trí chuyển đổi/Lưu lượng (WEBSITE/APP/MESSAGING/CALLS/ON_POST/ON_PAGE/ON_EVENT...)
    traffic_destination: { type: String, trim: true, default: null },
    // Vị trí chuyển đổi cho Engagement (MESSENGER/ON_POST/CALL/WEBSITE/APP/ON_PAGE)
    engagement_destination: { type: String, trim: true, default: null },
    // destination_type được gửi lên Facebook API (từ traffic_destination hoặc engagement_destination)
    destination_type: { type: String, trim: true, default: null },

    // 💰 Ngân sách & thời gian
    daily_budget: { type: Number },
    lifetime_budget: { type: Number },
    start_time: { type: Date },
    end_time: { type: Date },

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
