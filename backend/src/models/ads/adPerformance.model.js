import mongoose from "mongoose";

const adPerformanceSchema = new mongoose.Schema(
  {
    ads_id: { type: mongoose.Schema.Types.ObjectId, ref: "Ads", required: true },
    set_id: { type: mongoose.Schema.Types.ObjectId, ref: "AdsSet", index: true },
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: "AdsCampaign", index: true },
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: "AdsAccount", index: true },
    
    // ===== External IDs from Facebook (for fast queries without joins) =====
    external_account_id: { type: String, index: true }, // act_xxx hoặc xxx
    external_campaign_id: { type: String, index: true }, // Facebook Campaign ID
    external_adset_id: { type: String, index: true },    // Facebook AdSet ID
    external_ad_id: { type: String, index: true },       // Facebook Ad ID
    
    date: { type: Date, required: true, index: true },

    external_account_id: {
      type: String,
      index: true,
    },
    
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

    // ===== Thêm các trường mới cho Analytics =====
    
    // Metadata fields for mapping
    campaign_name: { type: String, trim: true },
    adset_name: { type: String, trim: true },
    ad_name: { type: String, trim: true },
    page_name: { type: String, trim: true },
    objective: { type: String, trim: true },

    // Ngân sách và tỷ lệ chi tiêu
    daily_budget: { type: Number, default: 0 },
    daily_spend_rate: { type: Number }, // % (spend/daily_budget * 100)
    total_amount_spent: { type: Number, default: 0 },
    
    // Link-related metrics
    link_clicks: { type: Number, default: 0 },
    link_cpc: { type: Number }, // CPC cho link clicks
    link_ctr: { type: Number }, // CTR cho link clicks
    
    // Website Purchase & ROAS
    website_purchases: { type: Number, default: 0 }, // Meta Pixel conversions
    website_purchase_roas: { type: Number }, // ROAS của lượt mua trên website
    
    // Results & Performance
    results: { type: Number, default: 0 }, // Tổng kết quả
    cost_per_result: { type: Number }, // Chi phí trên mỗi kết quả (CPA)
    
    // Audience Reach
    audience_reach_percentage: { type: Number }, // % đối tượng tiếp cận được

    // Quality & Engagement
    quality_ranking: { type: String },
    post_engagement: { type: Number, default: 0 },
    
    // Leads
    leads: { type: Number, default: 0 },
    cost_per_lead: { type: Number },
    
    // Mobile App
    mobile_app_install: { type: Number, default: 0 },
    cost_per_mobile_app_install: { type: Number },

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

adPerformanceSchema.index({ ads_id: 1, date: 1 }, { unique: true });
adPerformanceSchema.index({ campaign_id: 1, date: 1 });
adPerformanceSchema.index({ set_id: 1, date: 1 });
adPerformanceSchema.index({ account_id: 1, date: 1 });
adPerformanceSchema.index({ date: 1 });
adPerformanceSchema.index({ external_account_id: 1, date: 1 });

// Indexes cho search và filtering
adPerformanceSchema.index({ campaign_name: 1 });
adPerformanceSchema.index({ adset_name: 1 });
adPerformanceSchema.index({ ad_name: 1 });
adPerformanceSchema.index({ page_name: 1 });
adPerformanceSchema.index({ objective: 1 });

// Compound index cho aggregation queries
adPerformanceSchema.index({ account_id: 1, campaign_id: 1, date: 1 });
adPerformanceSchema.index({ account_id: 1, set_id: 1, date: 1 });
adPerformanceSchema.index({ external_account_id: 1, external_campaign_id: 1, date: 1 });

const AdPerformance = mongoose.model("AdPerformance", adPerformanceSchema);
export default AdPerformance;
