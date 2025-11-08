import mongoose from "mongoose";

const startOfHour = (value = new Date()) => {
  const date = new Date(value);
  date.setMinutes(0, 0, 0);
  return date;
};

const adHourlyInsightSchema = new mongoose.Schema(
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
    },
    adset_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdsSet",
      index: true,
    },
    ad_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ads",
      required: true,
      index: true,
    },

    // Cached external identifiers from Facebook (string form)
    account_external_id: { type: String, trim: true, index: true },
    campaign_external_id: { type: String, trim: true, index: true },
    adset_external_id: { type: String, trim: true, index: true },
    ad_external_id: { type: String, trim: true, index: true },

    delivery_status: { type: String, trim: true },

    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    spend: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    frequency: { type: Number, default: 0 },

    cpc: { type: Number },
    cpm: { type: Number },
    ctr: { type: Number },
    conversion_rate: { type: Number },
    cost_per_conversion: { type: Number },

    // ===== Additional analytics fields (align with daily insights) =====
    results: { type: Number, default: 0 },
    cost_per_result: { type: Number },

    campaign_name: { type: String, trim: true },
    adset_name: { type: String, trim: true },
    ad_name: { type: String, trim: true },
    page_name: { type: String, trim: true },

    daily_budget: { type: Number, default: 0 },
    daily_spend_rate: { type: Number },
    total_amount_spent: { type: Number, default: 0 },

    link_clicks: { type: Number, default: 0 },
    link_cpc: { type: Number },
    link_ctr: { type: Number },

    website_purchases: { type: Number, default: 0 },
    website_purchase_roas: { type: Number },

    audience_reach_percentage: { type: Number },

    rule_evaluations: { type: mongoose.Schema.Types.Mixed, default: {} },

    insight_at: { type: Date, required: true },
    retrieved_at: { type: Date, default: Date.now, index: true },
    retrieved_at_hour: {
      type: Date,
      required: true,
      default: () => startOfHour(Date.now()),
      index: true,
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

// ✅ GIỮ index bình thường để query nhanh
adHourlyInsightSchema.index({ ad_id: 1, retrieved_at_hour: 1 });
adHourlyInsightSchema.index({ account_id: 1, insight_at: 1 });
adHourlyInsightSchema.index({ account_id: 1, ad_id: 1, retrieved_at_hour: -1 });

adHourlyInsightSchema.pre("save", function preSave(next) {
  if (!this.retrieved_at_hour) {
    const baseDate = this.retrieved_at ?? new Date();
    this.retrieved_at_hour = startOfHour(baseDate);
  }
  next();
});

const ensureRetrievedAtHour = (update) => {
  if (!update) return update;

  const set = update.$set ?? {};
  const hasRetrievedAtHour =
    Object.prototype.hasOwnProperty.call(set, "retrieved_at_hour") ||
    Object.prototype.hasOwnProperty.call(update, "retrieved_at_hour");

  if (hasRetrievedAtHour) {
    return update;
  }

  const retrievedAtValue =
    set.retrieved_at ?? update.retrieved_at ?? update.$setOnInsert?.retrieved_at;

  const retrievedAtDate = retrievedAtValue
    ? new Date(retrievedAtValue)
    : new Date();

  const computed = startOfHour(retrievedAtDate);

  if (update.$set) {
    update.$set.retrieved_at_hour = computed;
  } else {
    update.$set = { retrieved_at_hour: computed };
  }

  if (update.$setOnInsert && !update.$setOnInsert.retrieved_at_hour) {
    update.$setOnInsert.retrieved_at_hour = computed;
  }

  return update;
};

adHourlyInsightSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function preUpdate(next) {
  const update = ensureRetrievedAtHour(this.getUpdate());
  if (update) {
    this.setUpdate(update);
  }
  next();
});

const AdHourlyInsight = mongoose.model("AdHourlyInsight", adHourlyInsightSchema);

export default AdHourlyInsight;
