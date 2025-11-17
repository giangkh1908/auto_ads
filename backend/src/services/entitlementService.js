import mongoose from "mongoose";
import UserPackage from "../models/userPackage.model.js";
import Shop from "../models/shops/shop.model.js";
import ShopUser from "../models/shops/shopUser.model.js";

export const FEATURE_KEYS = {
  ANALYTICS_CHAT_AI: "analytics_chat_ai",
  CONTENT_AI: "content_ai",
  ADS_AUTO_RUN: "ads_auto_run",
};

const FEATURE_LABELS = {
  [FEATURE_KEYS.ANALYTICS_CHAT_AI]: "Analytics Chat AI",
  [FEATURE_KEYS.CONTENT_AI]: "AI Content Generation",
  [FEATURE_KEYS.ADS_AUTO_RUN]: "Automated Ads Campaign",
};

const ACTIVE_STATUSES = ["active", "expiring soon", "new signup"];
const CACHE_TTL_MS = 30 * 1000;

const entitlementCache = new Map();

const buildCacheKey = (userId) => userId?.toString();

const readCache = (key) => {
  if (!key || !entitlementCache.has(key)) return null;
  const record = entitlementCache.get(key);
  if (!record || record.expiresAt < Date.now()) {
    entitlementCache.delete(key);
    return null;
  }
  return record.value;
};

const writeCache = (key, value) => {
  if (!key) return;
  entitlementCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const FEATURE_MAPPING = {
  "ChatBot": "analytics_chat_ai",
  "chatbot": "analytics_chat_ai",
  "Chatbot AI": "analytics_chat_ai",
  "Tạo ads thủ công": "content_ai",
  "AI integration": "content_ai",
  "AI nội dung": "content_ai",
  "content_ai": "content_ai",
  "Auto ads": "ads_auto_run",
  "Tự động chạy ads": "ads_auto_run",
  "ads_auto_run": "ads_auto_run",
  "analytics_chat_ai": "analytics_chat_ai",
};

const normalizeFeatures = (features) => {
  if (!Array.isArray(features)) return [];
  
  const normalized = new Set();
  
  features.forEach((feature) => {
    const standardKey = FEATURE_MAPPING[feature];
    if (standardKey) {
      normalized.add(standardKey);
    } else if (["analytics_chat_ai", "content_ai", "ads_auto_run"].includes(feature)) {
      normalized.add(feature);
    }
  });
  
  return Array.from(normalized);
};

const normalizePackagePayload = (pkg) => {
  if (!pkg) return null;
  return {
    _id: pkg._id,
    name: pkg.name,
    description: pkg.description,
    price: pkg.price,
    duration_days: pkg.duration_days,
    month_period: pkg.month_period,
    planType: pkg.planType,
    pages: pkg.pages,
    employees: pkg.employees,
    shops: pkg.shops,
    features: normalizeFeatures(pkg.features || []),
  };
};

const isPackageActive = (userPackageDoc) => {
  if (!userPackageDoc) return false;
  if (!ACTIVE_STATUSES.includes(userPackageDoc.status)) return false;
  if (userPackageDoc.to_date && userPackageDoc.to_date < new Date()) {
    return false;
  }
  return true;
};

const countUsage = async (userId) => {
  if (!userId) {
    return {
      shops: 0,
      employees: 0,
      pages: 0,
    };
  }

  const shops = await Shop.find({
    owner_id: new mongoose.Types.ObjectId(userId),
    deleted_at: null,
  })
    .select("_id facebook_pages")
    .lean();

  const shopIds = shops.map((shop) => shop._id);

  const [employeeCount] = await Promise.all([
    ShopUser.countDocuments({
      shop_id: { $in: shopIds },
      status: "active",
      user_id: { $ne: new mongoose.Types.ObjectId(userId) },
    }),
  ]);

  const pageCount = shops.reduce((total, shop) => {
    if (!Array.isArray(shop.facebook_pages)) return total;
    const connected = shop.facebook_pages.filter(
      (page) => page.connected_status === "connected"
    );
    return total + connected.length;
  }, 0);

  return {
    shops: shops.length,
    employees: employeeCount,
    pages: pageCount,
  };
};

export const getUserEntitlements = async (
  userId,
  { forceRefresh = false } = {}
) => {
  if (!userId) return null;

  const cacheKey = buildCacheKey(userId);
  if (!forceRefresh) {
    const cached = readCache(cacheKey);
    if (cached) return cached;
  }

  const userPackage = await UserPackage.findOne({
    user_id: new mongoose.Types.ObjectId(userId),
    status: { $in: ACTIVE_STATUSES },
    deleted_at: null,
  })
    .populate("package_id")
    .sort({ created_at: -1 });

  if (!userPackage || !isPackageActive(userPackage) || !userPackage.package_id) {
    writeCache(cacheKey, null);
    return null;
  }

  const pkgTemplate = normalizePackagePayload(userPackage.package_id);
  const usage = await countUsage(userId);

  const entitlements = {
    package: pkgTemplate,
    limits: {
      pages: userPackage.pages || pkgTemplate.pages || 0,
      employees: userPackage.employees || pkgTemplate.employees || 0,
      shops: userPackage.shops || pkgTemplate.shops || 0,
    },
    usage,
    period: {
      from_date: userPackage.from_date,
      to_date: userPackage.to_date,
    },
    status: userPackage.status,
  };

  writeCache(cacheKey, entitlements);
  return entitlements;
};

export const userHasFeature = async (
  userId,
  featureKey,
  { entitlements: providedEntitlements } = {}
) => {
  if (!userId || !featureKey) return false;
  const entitlements =
    providedEntitlements || (await getUserEntitlements(userId));
  const features = entitlements?.package?.features || [];
  return features.includes(featureKey);
};

export const describeFeature = (featureKey) =>
  FEATURE_LABELS[featureKey] || featureKey;

