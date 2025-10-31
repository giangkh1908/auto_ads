import mongoose from "mongoose";

const adPerformanceSchema = new mongoose.Schema(
  {
    ads_id: { type: mongoose.Schema.Types.ObjectId, ref: "Ads", required: true },
    date: { type: Date, required: true },

    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    spend: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },

    cpc: { type: Number },
    cpm: { type: Number },
    ctr: { type: Number },
    conversion_rate: { type: Number },

    actions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    breakdowns: { type: mongoose.Schema.Types.Mixed, default: {} },
    attribution_windows: { type: mongoose.Schema.Types.Mixed, default: {} },

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

adPerformanceSchema.index({ ads_id: 1, date: 1 }, { unique: true });
adPerformanceSchema.index({ date: 1 });

const AdPerformance = mongoose.model("AdPerformance", adPerformanceSchema);
export default AdPerformance;
