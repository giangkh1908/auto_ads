import mongoose from "mongoose";

const adPerformanceCampaignDailySchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdsAccount",
      required: true,
      index: true,
    },
    campaign_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdsCampaign",
      required: true,
      index: true,
    },
    campaign_name: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },

    total_spend: {
      type: Number,
      default: 0,
    },
    total_impressions: {
      type: Number,
      default: 0,
    },
    total_clicks: {
      type: Number,
      default: 0,
    },
    total_reach: {
      type: Number,
      default: 0,
    },
    total_results: {
      type: Number,
      default: 0,
    },
    total_conversions: {
      type: Number,
      default: 0,
    },

    avg_ctr: {
      type: Number,
    },
    avg_cpc: {
      type: Number,
    },
    avg_cpm: {
      type: Number,
    },
    avg_frequency: {
      type: Number,
    },
    avg_cost_per_result: {
      type: Number,
    },

    last_updated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

adPerformanceCampaignDailySchema.index(
  { account_id: 1, campaign_id: 1, date: 1 },
  { unique: true }
);

adPerformanceCampaignDailySchema.index({ account_id: 1 });
adPerformanceCampaignDailySchema.index({ campaign_id: 1 });
adPerformanceCampaignDailySchema.index({ date: 1 });
adPerformanceCampaignDailySchema.index({ account_id: 1, date: 1 });
adPerformanceCampaignDailySchema.index({ campaign_id: 1, date: 1 });

const AdPerformanceCampaignDaily = mongoose.model(
  "AdPerformanceCampaignDaily",
  adPerformanceCampaignDailySchema
);

export default AdPerformanceCampaignDaily;

