import mongoose from "mongoose";

const adsSchema = new mongoose.Schema(
  {
    set_id: { type: mongoose.Schema.Types.ObjectId, ref: "AdsSet" }, // cho phép null khi còn draft
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: "AdsAccount" }, // tuỳ bạn có cần bắt buộc không

    external_account_id: {
      type: String,
      index: true,
    },
    // ID ad trên Facebook (có sau publish)
    external_id: { type: String, trim: true },

    name: { type: String, trim: true },

    // Creative gắn với Ad (trước khi ACTIVE nên validate phải có)
    creative_id: { type: mongoose.Schema.Types.ObjectId, ref: "Creative" },

    // Trạng thái
    status: {
      type: String,
      enum: ["PAUSED", "ACTIVE", "DELETED", "ARCHIVED", "DRAFT", "FAILED"],
      default: "DRAFT",
    },
    configured_status: { type: String },
    effective_status: { type: String },

    // Phân phối & audit
    delivery_info: { type: mongoose.Schema.Types.Mixed, default: {} },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    deleted_at: { type: Date, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Index
adsSchema.index(
  { external_id: 1 },
  {
    unique: true,
    partialFilterExpression: { external_id: { $type: "string" } },
  }
);
adsSchema.index({ set_id: 1 });
adsSchema.index({ account_id: 1 });
adsSchema.index({ status: 1 });

const Ads = mongoose.model("Ads", adsSchema);
export default Ads;
