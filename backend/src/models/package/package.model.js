import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    // Tên gói dịch vụ
    name: {
      type: String,
      required: [true, "Tên gói là bắt buộc"],
      trim: true,
    },

    // Mô tả gói
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Giá tiền
    price: {
      type: Number,
      required: [true, "Giá gói là bắt buộc"],
      min: 0,
    },

    month_period: {
      type: Number,
      required: [true, "Chu kỳ hiển thị là bắt buộc"], // "3", "12"
    },

    duration_days: {
      type: Number,
      required: [true, "Số ngày sử dụng là bắt buộc"],
      min: 1,
    },

    planType: {
      type: String,
      enum: ["3months", "6months", "1year"],
      required: true,
    },

    pages: {
      type: Number,
      default: 3,
    },

    employees: {
      type: Number,
      default: 3,
    },

    shops: {
      type: Number,
      default: 20,
    },

    conversations: {
      type: Number,
      default: -1, // -1 = unlimited
      min: -1,
    },

    contacts: {
      type: Number,
      default: -1, // -1 = unlimited
      min: -1,
    },

    features: {
      type: [String],
      default: [],
    },

    // Trạng thái gói
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

packageSchema.index({ name: 1, planType: 1 }, { unique: true });
// packageSchema.index({ name: 1 }, { unique: true });
packageSchema.index({ planType: 1 });
packageSchema.index({ status: 1 });

const Package = mongoose.model("Package", packageSchema);
export default Package;