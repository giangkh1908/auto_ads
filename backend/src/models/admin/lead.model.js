import mongoose from "mongoose";
import validator from "validator";

const leadSchema = new mongoose.Schema(
  {
    // Tên người cần tư vấn
    lead_name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Số điện thoại
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
      validate: {
        validator: (v) => /^(\+)?\d{9,11}$/.test(v.trim()),
        message: "Số điện thoại không hợp lệ (9-11 chữ số)",
      },
    },

    // Trạng thái xử lý lead
    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "lost"],
      default: "new",
      index: true,
    },

    // Người được gán xử lý lead (nhân viên tư vấn)
    assigned_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Nguồn lead (website, facebook, referral, etc.)
    source: {
      type: String,
      trim: true,
      default: "website",
    },

    // Soft delete
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
leadSchema.index({ status: 1, deleted_at: 1 });
leadSchema.index({ assigned_to: 1, deleted_at: 1 });
leadSchema.index({ created_at: -1 });
leadSchema.index({ phone: 1, deleted_at: 1 }, { 
  unique: true, 
  partialFilterExpression: { deleted_at: null } 
});

const Lead = mongoose.model("Lead", leadSchema);
export default Lead;