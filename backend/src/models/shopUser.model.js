import mongoose from "mongoose";

const shopUserSchema = new mongoose.Schema(
  {
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role_in_shop: {
      type: String,
      enum: ["owner", "manager", "marketing", "analyst", "staff"],
      default: "staff",
    },
    is_manager: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive", "removed"],
      default: "active",
    },
    joined_at: { type: Date, default: Date.now },
    invited_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    removed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Index
shopUserSchema.index({ shop_id: 1, user_id: 1 }, { unique: true });

// Virtual
shopUserSchema.virtual("user_roles", {
  ref: "UserRole",
  localField: "_id",
  foreignField: "shop_user_id",
});

// Auto set manager
shopUserSchema.pre("save", function (next) {
  if (this.role_in_shop === "owner") this.is_manager = true;
  next();
});

const ShopUser = mongoose.model("ShopUser", shopUserSchema);
export default ShopUser;
