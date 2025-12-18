import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    module: { type: String, required: true, trim: true },
    resource: { type: String, trim: true, default: null },
    actions: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.every((a) => typeof a === "string"),
        message: "Danh sách actions phải là mảng chuỗi",
      },
    },
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema(
  {
    role_name: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String, trim: true },
    category: { type: String, trim: true, default: "system" },
    permissions: { type: [permissionSchema], default: [] },
    scope: { type: String, enum: ["global", "shop"], default: "shop" },
    priority: { type: Number, default: 10 },
    type: { type: String, enum: ["system", "custom"], default: "custom" },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// 📈 Index
roleSchema.index({ role_name: 1 }, { unique: true });

// 🔍 Check permission
roleSchema.statics.hasPermission = function (roleDoc, module, action) {
  if (!roleDoc || !roleDoc.permissions) return false;
  return roleDoc.permissions.some(
    (perm) => perm.module === module && perm.actions.includes(action)
  );
};

// 🔄 Merge permissions
roleSchema.statics.mergePermissions = function (roles) {
  const perms = new Map();
  roles.forEach((role) => {
    (role.permissions || []).forEach((p) => {
      if (!perms.has(p.module)) perms.set(p.module, new Set());
      p.actions.forEach((a) => perms.get(p.module).add(a));
    });
  });
  return [...perms.entries()].map(([module, actions]) => ({ module, actions: [...actions] }));
};

const Role = mongoose.model("Role", roleSchema);
export default Role;
