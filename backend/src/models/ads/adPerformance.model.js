import mongoose from "mongoose";

const adPerformanceSchema = new mongoose.Schema(
  {
    ads_id: { type: mongoose.Schema.Types.ObjectId, ref: "Ads", required: true },
    set_id: { type: mongoose.Schema.Types.ObjectId, ref: "AdsSet", index: true },
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: "AdsCampaign", index: true },
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: "AdsAccount", index: true },
    date: { type: Date, required: true, index: true },

    // Thêm các trường tên
    campaign_name: { type: String, default: "" },
    adset_name: { type: String, default: "" },
    ad_name: { type: String, default: "" },
    page_name: { type: String, default: "" },

    // Thêm thông tin creative và targeting
    ad_text: { type: String, default: "" },
    age_range: { type: String, default: "" },
    campaign_objective: { type: String, default: "" },

    // Metrics hiện có
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    spend: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    frequency: { type: Number, default: 0 },

    // Thêm metrics bổ sung
    results: { type: Number, default: 0 },
    cost_per_result: { type: Number, default: null },
    delivery: { type: String, default: "" },
    link_clicks: { type: Number, default: 0 },
    results_roas: { type: Number, default: null },

    // Calculated metrics
    cpc: { type: Number },
    cpm: { type: Number },
    ctr: { type: Number },
    conversion_rate: { type: Number },
    cost_per_conversion: { type: Number },

    actions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    breakdowns: { type: mongoose.Schema.Types.Mixed, default: {} },
    attribution_windows: { type: mongoose.Schema.Types.Mixed, default: {} },

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

adPerformanceSchema.index({ ads_id: 1, date: 1 }, { unique: true });
adPerformanceSchema.index({ campaign_id: 1, date: 1 });
adPerformanceSchema.index({ set_id: 1, date: 1 });
adPerformanceSchema.index({ account_id: 1, date: 1 });
adPerformanceSchema.index({ date: 1 });

const AdPerformance = mongoose.model("AdPerformance", adPerformanceSchema);
export default AdPerformance;
