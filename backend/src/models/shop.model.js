import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    shop_name: {
      type: String,
      required: true,
      trim: true,
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    salesman_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    industry: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending", "banned"],
      default: "active",
    },
    facebook_pages: [
      {
        page_id: { type: String, trim: true, required: true },
        page_token: { type: String, select: false },
        page_info: {
          name: String,
          category: String,
          link: String,
          picture_url: String,
        },
        connected_status: {
          type: String,
          enum: ["connected", "disconnected", "error"],
          default: "connected",
        },
        connected_at: { type: Date, default: Date.now },
        last_synced_at: { type: Date, default: null },
      },
    ],
    platform: {
      type: String,
      enum: ["facebook", "tiktok", "google"],
      default: "facebook",
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    settings: {
      currency: { type: String, default: "VND" },
      timezone: { type: String, default: "Asia/Ho_Chi_Minh" },
      language: { type: String, default: "vi" },
    },
    current_package_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      default: null,
    },
    package_expired_at: { type: Date, default: null },
    connected_at: { type: Date, default: Date.now },
    last_synced_at: { type: Date, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// 📈 Index
shopSchema.index({ shop_name: 1 });
shopSchema.index({ owner_id: 1 });
shopSchema.index({ salesman_id: 1 });
shopSchema.index({ 'facebook_pages.page_id': 1 });
shopSchema.index({ status: 1 });

// Virtuals
shopSchema.virtual("user_roles", {
  ref: "UserRole",
  localField: "_id",
  foreignField: "shop_id",
});

shopSchema.virtual("shop_users", {
  ref: "ShopUser",
  localField: "_id",
  foreignField: "shop_id",
});

// Auto name
shopSchema.pre("save", function (next) {
  if (!this.shop_name) {
    const first = Array.isArray(this.facebook_pages) && this.facebook_pages[0];
    if (first?.page_info?.name) this.shop_name = first.page_info.name;
  }
  next();
});

const Shop = mongoose.model("Shop", shopSchema);
export default Shop;
