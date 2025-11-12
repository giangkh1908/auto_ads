import mongoose from "mongoose";

const adPerformanceTrendDailySchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },

    spend: {
      type: Number,
      default: 0,
    },
    impressions: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    reach: {
      type: Number,
      default: 0,
    },
    results: {
      type: Number,
      default: 0,
    },
    conversions: {
      type: Number,
      default: 0,
    },

    ctr: {
      type: Number,
    },
    cpc: {
      type: Number,
    },
    cpm: {
      type: Number,
    },
    frequency: {
      type: Number,
    },
    cost_per_result: {
      type: Number,
    },

    spend_change: {
      type: Number,
    },
    ctr_change: {
      type: Number,
    },
    impressions_change: {
      type: Number,
    },
    clicks_change: {
      type: Number,
    },

    last_updated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

adPerformanceTrendDailySchema.index(
  { account_id: 1, date: 1 },
  { unique: false }
);

adPerformanceTrendDailySchema.index(
  { account_id: 1, campaign_id: 1, date: 1 },
  { unique: false }
);

adPerformanceTrendDailySchema.index({ account_id: 1 });
adPerformanceTrendDailySchema.index({ campaign_id: 1 });
adPerformanceTrendDailySchema.index({ date: 1 });
adPerformanceTrendDailySchema.index({ account_id: 1, date: -1 });

const AdPerformanceTrendDaily = mongoose.model(
  "AdPerformanceTrendDaily",
  adPerformanceTrendDailySchema
);

export default AdPerformanceTrendDaily;

