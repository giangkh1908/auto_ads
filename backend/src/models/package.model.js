import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    // 📦 Tên gói dịch vụ
    name: {
      type: String,
      required: [true, "Tên gói là bắt buộc"],
      trim: true,
      unique: true,
    },

    // 🧾 Mô tả gói
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // 💰 Giá tiền
    price: {
      type: Number,
      required: [true, "Giá gói là bắt buộc"],
      min: 0,
    },

    // ⏱️ Thời hạn (tính theo ngày)
    duration_days: {
      type: Number,
      required: [true, "Số ngày sử dụng là bắt buộc"],
      min: 1,
    },

    // 🧩 Các tính năng kèm theo
    features: {
      type: mongoose.Schema.Types.Mixed, // có thể là JSON tùy biến
      default: {},
    },

    // 🔄 Trạng thái gói
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // 🧠 Audit
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// 📈 Indexes
packageSchema.index({ name: 1 }, { unique: true });
packageSchema.index({ status: 1 });
packageSchema.index({ deleted_at: 1 });

const Package = mongoose.model("Package", packageSchema);
export default Package;
