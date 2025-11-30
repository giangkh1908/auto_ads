import mongoose from "mongoose";

const adsSchema = new mongoose.Schema(
  {
    set_id: { type: mongoose.Schema.Types.ObjectId, ref: "AdsSet" }, // cho phép null khi còn draft
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: "AdsAccount" }, // tuỳ bạn có cần bắt buộc không

    external_account_id: {
      type: String,
      index: true,
    },
    // ID ad trên Facebook (có sau publish)
    external_id: { type: String, trim: true },

    name: { type: String, trim: true },

    // Creative gắn với Ad (trước khi ACTIVE nên validate phải có)
    creative_id: { type: mongoose.Schema.Types.ObjectId, ref: "Creative" },

    // Trạng thái
    status: {
      type: String,
      enum: ["PAUSED", "ACTIVE", "DELETED", "ARCHIVED", "DRAFT", "FAILED"],
      default: "DRAFT",
    },
    configured_status: { type: String },
    effective_status: { type: String },

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
      engagement_rate_ranking: { type: String, default: null },
      conversion_rate_ranking: { type: String, default: null },
      post_engagement: { type: Number, default: 0 },
      leads: { type: Number, default: 0 },
      cost_per_lead: { type: Number, default: null },
      mobile_app_install: { type: Number, default: 0 },
      cost_per_mobile_app_install: { type: Number, default: null },
      actions: { type: mongoose.Schema.Types.Mixed, default: [] },
      insights_updated_at: { type: Date, default: null },
    },

    // Phân phối & audit
    delivery_info: { type: mongoose.Schema.Types.Mixed, default: {} },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    
    deleted_at: { type: Date, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Index
adsSchema.index(
  { external_id: 1 },
  {
    unique: true,
    partialFilterExpression: { external_id: { $type: "string" } },
  }
);
adsSchema.index({ set_id: 1 });
adsSchema.index({ account_id: 1 });
adsSchema.index({ status: 1 });

const Ads = mongoose.model("Ads", adsSchema);
export default Ads;
