import mongoose from "mongoose";

const analyticsSnapshotSchema = new mongoose.Schema(
  {
    // References
    ad_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ads",
      required: true,
      unique: true,
      index: true,
    },
    external_ad_id: {
      type: String,
      required: true,
    },
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdsAccount",
      required: true,
      index: true,
    },
    external_account_id: {
      type: String,
      required: true,
    },

    // Breakdown fields (for filtering/display)
    campaign_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdsCampaign",
    },
    campaign_name: String,
    campaign_objective: {
      type: String,
      index: true,
    },
    adset_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdsSet",
    },
    adset_name: String,
    ad_name: String,
    ad_status: String,
    page_name: String,

    // Common metrics (all objectives)
    spend: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    frequency: { type: Number, default: 0 },
    cpm: { type: Number, default: 0 },
    cpc: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },

    // AWARENESS metrics
    cost_per_result: { type: Number, default: 0 },

    // TRAFFIC metrics
    link_clicks: { type: Number, default: 0 },
    link_cpc: { type: Number, default: 0 },
    link_ctr: { type: Number, default: 0 },

    // ENGAGEMENT metrics
    post_engagement: { type: Number, default: 0 },
    cost_per_inline_post_engagement: { type: Number, default: 0 },
    quality_ranking: String,
    engagement_rate_ranking: String,

    // LEADS metrics
    leads: { type: Number, default: 0 },
    cost_per_lead: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    conversion_rate: { type: Number, default: 0 },

    // SALES metrics
    website_purchases: { type: Number, default: 0 },
    cost_per_conversion: { type: Number, default: 0 },
    website_purchase_roas: { type: Number, default: 0 },
    cost_per_action: { type: Number, default: 0 },

    // APP_PROMOTION metrics
    mobile_app_install: { type: Number, default: 0 },
    cost_per_mobile_app_install: { type: Number, default: 0 },

    // Metadata
    last_synced: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
analyticsSnapshotSchema.index({ account_id: 1, campaign_objective: 1 });
analyticsSnapshotSchema.index({ external_account_id: 1 });
analyticsSnapshotSchema.index({ campaign_id: 1 });

const AnalyticsSnapshot = mongoose.model("AnalyticsSnapshot", analyticsSnapshotSchema);

export default AnalyticsSnapshot;
