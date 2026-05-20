import mongoose from "mongoose";

const shopPackageSchema = new mongoose.Schema(
  {
    // 🏪 Shop áp dụng
    shop_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    // 📦 Gói được kích hoạt
    package_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },

    // 🕒 Thời gian hiệu lực
    from_date: { type: Date, required: true },
    to_date: { type: Date, required: true },

    // 📊 Trạng thái
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },

    // 🧑‍💼 Nhân viên sale phụ trách (nếu có)
    salesman_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // 🧠 Audit
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// 📈 Indexes
shopPackageSchema.index({ shop_id: 1 });
shopPackageSchema.index({ package_id: 1 });
shopPackageSchema.index({ status: 1 });
shopPackageSchema.index({ salesman_id: 1 });

const ShopPackage = mongoose.model("ShopPackage", shopPackageSchema);

shopPackageSchema.pre("save", function (next) {
  if (this.from_date && this.to_date && this.to_date <= this.from_date) {
    return next(new Error("to_date phải sau from_date"));
  }
  next();
});

export default ShopPackage;
