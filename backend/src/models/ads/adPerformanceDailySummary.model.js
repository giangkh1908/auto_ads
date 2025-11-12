import mongoose from "mongoose";

const adPerformanceDailySummarySchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdsAccount",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },

    total_ads: {
      type: Number,
      default: 0,
    },
    total_campaigns: {
      type: Number,
      default: 0,
    },
    total_adsets: {
      type: Number,
      default: 0,
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

adPerformanceDailySummarySchema.index(
  { account_id: 1, date: 1 },
  { unique: true }
);

adPerformanceDailySummarySchema.index({ account_id: 1 });
adPerformanceDailySummarySchema.index({ date: 1 });
adPerformanceDailySummarySchema.index({ account_id: 1, date: -1 });

const AdPerformanceDailySummary = mongoose.model(
  "AdPerformanceDailySummary",
  adPerformanceDailySummarySchema
);

export default AdPerformanceDailySummary;

