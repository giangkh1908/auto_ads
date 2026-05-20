import mongoose from "mongoose";

const userPackageSchema = new mongoose.Schema(
  {
    // Gói được kích hoạt
    package_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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


    // Thời gian hiệu lực
    from_date: { type: Date, required: true },
    to_date: { type: Date, required: true },

    // Trạng thái
    status: {
      type: String,
      enum: ["active", "expired", "canceled", "pending", "expiring soon", "recently expired", "new signup"],
      default: "pending",
    },

    // Nhân viên sale phụ trách (nếu có)
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
userPackageSchema.index({ package_id: 1 });
userPackageSchema.index({ status: 1 });
userPackageSchema.index({ user_id: 1 });

const UserPackage = mongoose.model("UserPackage", userPackageSchema);

userPackageSchema.pre("save", function (next) {
  if (this.from_date && this.to_date && this.to_date <= this.from_date) {
    return next(new Error("to_date phải sau from_date"));
  }
  next();
});

export default UserPackage;