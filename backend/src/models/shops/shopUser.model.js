import mongoose from "mongoose";

const facebookPageSchema = new mongoose.Schema(
  {
    page_id: { type: String, required: true },
    page_name: { type: String },
    page_category: { type: String },
    page_access_token: { type: String },
    picture_url: { type: String },
    connected_status: { type: String, enum: ["connected", "disconnected"], default: "connected" },
    page_status: {
      type: String,
      enum: ["active", "pause"],
      default: "active",
    },
    connected_at: { type: Date, default: Date.now },
    assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assigned_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const shopUserSchema = new mongoose.Schema(
  {
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    is_manager: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive", "removed"],
      default: "active",
    },
    joined_at: { type: Date, default: Date.now },
    invited_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    removed_at: { type: Date, default: null },
    facebook_pages: { type: [facebookPageSchema], default: [] },
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

const ShopUser = mongoose.model("ShopUser", shopUserSchema);
export default ShopUser;