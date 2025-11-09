import mongoose from "mongoose";

const aiConfigSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Tên config là bắt buộc"],
      trim: true,
      maxlength: [100, "Tên không được quá 100 ký tự"],
    },
    is_default: {
      type: Boolean,
      default: false,
    },
    is_system_template: {
      type: Boolean,
      default: false,
    },
    character: {
      type: String,
      default: "Bạn là 1 chuyên gia marketing quảng cáo Facebook với nhiều năm kinh nghiệm.",
      trim: true,
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    limitations: [
      {
        type: String,
        trim: true,
      },
    ],
    model: {
      type: String,
      enum: ["gpt-4o-mini", "gpt-4o", "gemini-2.5-flash", "gemini-2.5-flash-image"],
      default: "gpt-4o-mini",
    },
    opening_question: {
      type: String,
      default: "",
      trim: true,
    },
    auto_suggestions: {
      type: Boolean,
      default: false,
    },
    metadata: {
      language: {
        type: String,
        default: "vi",
      },
      tone: {
        type: String,
        default: "chuyen_nghiep",
      },
      personalization: {
        type: String,
        default: "",
      },
    },
    usage_count: {
      type: Number,
      default: 0,
    },
    last_used_at: {
      type: Date,
      default: null,
    },
    prompt_template_headline: {
      type: String,
      default: "",
      trim: true,
    },
    prompt_template_body: {
      type: String,
      default: "",
      trim: true,
    },
    prompt_template_description: {
      type: String,
      default: "",
      trim: true,
    },
    use_custom_templates: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

aiConfigSchema.index({ user_id: 1, is_default: 1 });
aiConfigSchema.index({ is_system_template: 1 });

aiConfigSchema.pre("save", async function (next) {
  if (this.isModified("is_default") && this.is_default && this.user_id) {
    await mongoose.model("AIConfig").updateMany(
      { user_id: this.user_id, _id: { $ne: this._id }, is_default: true },
      { $set: { is_default: false } }
    );
  }
  next();
});

const AIConfig = mongoose.model("AIConfig", aiConfigSchema);
export default AIConfig;

