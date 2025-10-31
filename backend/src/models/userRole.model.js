import mongoose from "mongoose";

const userRoleSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role_id: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", default: null },
    shop_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "ShopUser", default: null },
    assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assigned_at: { type: Date, default: Date.now },
    revoked_at: { type: Date, default: null },
    source: { type: String, enum: ["manual", "system", "import"], default: "manual" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Index
userRoleSchema.index({ user_id: 1, role_id: 1, shop_id: 1 }, { unique: true });

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

const UserRole = mongoose.model("UserRole", userRoleSchema);
export default UserRole;
