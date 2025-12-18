import mongoose from "mongoose";

const userRoleSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role_id: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", default: null },
    shop_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "ShopUser", default: null },
    is_current: { type: Boolean, default: false },
    assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assigned_at: { type: Date, default: Date.now },
    revoked_at: { type: Date, default: null },
    source: { type: String, enum: ["manual", "system", "import"], default: "manual" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Index
userRoleSchema.index({ user_id: 1, role_id: 1, shop_id: 1 }, { unique: true });

userRoleSchema.virtual("roles", {
  ref: "Role",
  localField: "role_id",
  foreignField: "_id",
  justOne: true
});

// Static: check permission
userRoleSchema.statics.hasPermission = async function (userId, shopId, module, action) {
  const roles = await this.find({
    user_id: userId,
    $or: [{ shop_id: shopId }, { shop_id: null }],
  }).populate("role_id");

  for (const ur of roles) {
    if (ur.role_id && ur.role_id.permissions.some(
      (p) => p.module === module && p.actions.includes(action)
    )) {
      return true;
    }
  }
  return false;
};

// Đảm bảo toàn hệ thống chỉ có 1 shop đang active cho người đó.
userRoleSchema.pre("save", async function (next) {
  if (this.is_current) {
    // Hủy trạng thái is_current của các shop khác cùng user
    await mongoose.model("UserRole").updateMany(
      { user_id: this.user_id, _id: { $ne: this._id } },
      { $set: { is_current: false } }
    );
  }
  next();
});

const UserRole = mongoose.model("UserRole", userRoleSchema);
export default UserRole;