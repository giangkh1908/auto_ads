import mongoose from "mongoose";

const automationRuleSchema = new mongoose.Schema(
  {
    // 🔗 Liên kết với cửa hàng và tài khoản
    shop_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: false,
      default: null,
    },
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdsAccount",
      required: true,
    },
    external_account_id: {
      type: String,
      required: true,
      trim: true,
      index: true, // Index để query nhanh
    },
    // 👤 Người tạo và người đăng ký
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscriber_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 📝 Thông tin cơ bản
    name: {
      type: String,
      required: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "TRIGGERED", "PAUSED", "DELETED"],
      default: "ACTIVE",
    },

    // Áp dụng quy tắc cho
    apply_to: {
      type: String,
      required: true,
      trim: true,
    },
    // IDs cụ thể để query adPerformance
    apply_to_ids: {
      campaign_ids: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AdsCampaign",
        },
      ],
      adset_ids: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AdsSet",
        },
      ],
      ad_ids: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Ads",
        },
      ],
    },

    // Hành động khi điều kiện được thỏa mãn
    action: {
      type: String,
      enum: ["TURN_ON", "TURN_OFF", "SEND_NOTIFICATION"],
      required: true,
    },

    // Điều kiện (mảng các điều kiện - tất cả phải khớp)
    conditions: [
      {
        // Metric mà người dùng chọn (tên hiển thị)
        metric: {
          type: String,
          required: true,
          enum: [
            "spend",
            "daily_budget",
            "daily_spend_rate",
            "website_purchase_roas",
            "link_ctr",
            "impressions",
            "link_cpc",
            "cost_per_result",
            "results",
            "frequency",
            "website_purchases",
            "total_amount_spent",
            "link_clicks",
            "cpm",
            "audience_reach_percentage",
          ],
        },
        operator: {
          type: String,
          required: true,
          enum: ["GREATER_THAN", "LESS_THAN", "EQUAL_TO"],
        },
        value: {
          type: Number,
          required: true,
        },
        unit: {
          type: String,
          enum: ["CURRENCY", "COUNT", "PERCENTAGE", "FLOAT", ""],
          default: "CURRENCY",
        },
      },
    ],

    // ⏰ Lịch trình chạy quy tắc
    schedule: {
      type: {
        type: String,
        enum: ["CONTINUOUS", "DAILY", "CUSTOM"],
        required: true,
        default: "CONTINUOUS",
      },
      daily_time: {
        start_time: { type: String },
        end_time: { type: String },
      },
      custom_schedule: {
        days: [
          {
            day: {
              type: String,
              enum: [
                "SUNDAY",
                "MONDAY",
                "TUESDAY",
                "WEDNESDAY",
                "THURSDAY",
                "FRIDAY",
                "SATURDAY",
              ],
            },
            checked: {
              type: Boolean,
              default: false,
            },
            time_slots: [
              {
                start_time: { type: String },
                end_time: { type: String },
              },
            ],
          },
        ],
      },
    },

    // 🔔 Thông báo
    notification: {
      type: Boolean,
      default: true,
    },

    // 📈 Thông tin thực thi
    last_run_at: {
      type: Date,
      default: null,
    },
    next_run_at: {
      type: Date,
      default: null,
    },
    run_count: {
      type: Number,
      default: 0,
    },
    last_triggered_at: {
      type: Date,
      default: null,
    },
    trigger_count: {
      type: Number,
      default: 0,
    },
    last_error: {
      type: String,
      default: null,
    },
    last_error_at: {
      type: Date,
      default: null,
    },

    // 🧠 Audit & Meta
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// 📈 Indexes
automationRuleSchema.index({ shop_id: 1 });
automationRuleSchema.index({ account_id: 1 });
automationRuleSchema.index({ created_by: 1 });
automationRuleSchema.index({ subscriber_id: 1 });
automationRuleSchema.index({ enabled: 1, status: 1 });
automationRuleSchema.index({ "schedule.type": 1, next_run_at: 1 });
automationRuleSchema.index({ "apply_to_ids.campaign_ids": 1 });
automationRuleSchema.index({ "apply_to_ids.adset_ids": 1 });
automationRuleSchema.index({ "apply_to_ids.ad_ids": 1 });
automationRuleSchema.index({ deleted_at: 1 });
automationRuleSchema.index({ status: 1, enabled: 1, next_run_at: 1 });

automationRuleSchema.pre("save", async function (next) {
  // Chỉ sync khi account_id thay đổi hoặc external_account_id chưa có
  if (this.isModified("account_id") || !this.external_account_id) {
    if (this.account_id) {
      try {
        if (!this.populated("account_id")) {
          await this.populate("account_id", "external_id");
        }
        if (this.account_id?.external_id) {
          this.external_account_id = this.account_id.external_id;
        }
      } catch (error) {
        return next(error);
      }
    }
  }
  next();
});

const AutomationRule = mongoose.model("AutomationRule", automationRuleSchema);
export default AutomationRule;
