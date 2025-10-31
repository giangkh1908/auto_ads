// services/adsAccount.service.js
import axios from "axios";
import AdsAccount from "../models/ads/adsAccount.model.js";
import AdsCampaign from "../models/ads/adsCampaign.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import Ads from "../models/ads/ads.model.js";

/** =========================
 *  FACEBOOK GRAPH HELPERS
 *  ========================= */
const FB_API = "https://graph.facebook.com/v23.0";

export async function fbFetchAdAccounts(accessToken, afterCursor = null, limit = 10) {
  const params = new URLSearchParams({
    fields: "id,name,account_status,currency,timezone_name",
    limit: String(limit),
  });
  if (afterCursor) params.set("after", afterCursor);

  const res = await axios.get(`${FB_API}/me/adaccounts?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = res.data?.data || [];
  const nextAfter = res.data?.paging?.cursors?.after || null;

  return { data, nextAfter };
}

/** Upsert 1 tài khoản */
export async function upsertOneAdAccount(fbAcc, { shopUserId, adminUserId, shopId = null }) {
  return AdsAccount.findOneAndUpdate(
    { external_id: fbAcc.id },
    {
      external_id: fbAcc.id,
      name: fbAcc.name,
      currency: fbAcc.currency,
      timezone_name: fbAcc.timezone_name,
      account_status: fbAcc.account_status, // enum số của FB (1=active,...)
      shop_user_id: shopUserId || undefined,
      shop_admin_id: adminUserId || undefined,
      shop_id: shopId || undefined,
      last_updated_at: new Date(),
    },
    { upsert: true, new: true }
  );
}

/** Upsert danh sách tài khoản */
export async function upsertAdAccountsFromFacebook(accessToken, { shopUserId, adminUserId, shopId = null }) {
  let after = null;
  const results = [];
  do {
    const { data, nextAfter } = await fbFetchAdAccounts(accessToken, after);
    for (const fbAcc of data) {
      const doc = await upsertOneAdAccount(fbAcc, { shopUserId, adminUserId, shopId  });
      results.push(doc);
    }
    after = nextAfter;
  } while (after);

  return results;
}

/** =========================
 *  DB QUERIES
 *  ========================= */

/** List + filter + paginate */
export async function listAdsAccounts({
  userId,        // ID người dùng hiện tại
  shopUserId,    // ID shop user nếu có
  q,
  status, 
  account_status, 
  page = 1,
  limit = 10,
  sort = "-updated_at",
}) {
  const filter = {};
  
  // Thêm điều kiện lọc theo user
  if (userId) {
    filter.$or = [
      { shop_admin_id: userId },
      { shop_user_id: shopUserId || userId }
    ];
  }

  // Các điều kiện lọc khác
  if (q) {
    const searchFilter = [
      { name: new RegExp(q, "i") },
      { external_id: new RegExp(q, "i") },
    ];
    
    // Nếu đã có $or từ điều kiện user, gộp với điều kiện search
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchFilter }];
      delete filter.$or;
    } else {
      filter.$or = searchFilter;
    }
  }
  
  if (status) filter.status = status;
  if (typeof account_status !== "undefined") filter.account_status = Number(account_status);

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    AdsAccount.find(filter).sort(sort).skip(skip).limit(Number(limit)),
    AdsAccount.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)) || 1,
  };
}

export function getAdsAccountById(id) {
  return AdsAccount.findById(id);
}

export function getAdsAccountByExternalId(externalId) {
  return AdsAccount.findOne({ external_id: externalId });
}

export function updateAdsAccount(id, payload) {
  const allowed = ["name", "status", "currency", "timezone_name"];
  const data = {};
  for (const k of allowed) if (payload[k] !== undefined) data[k] = payload[k];
  if (Object.keys(data).length === 0) return getAdsAccountById(id);
  data.last_updated_at = new Date();
  return AdsAccount.findByIdAndUpdate(id, data, { new: true });
}

/** Soft delete = set status INACTIVE + meta flag (không xóa cứng) */
export async function softDeleteAdsAccount(id) {
  return AdsAccount.findByIdAndUpdate(
    id,
    { status: "INACTIVE", last_updated_at: new Date(), "meta.deleted": true },
    { new: true }
  );
}

/**
 * Lấy thống kê số lượng campaigns, adsets, ads cho một account
 */
export async function getAdsAccountStats(accountExternalId) {
  if (!accountExternalId) return { campaigns: 0, adsets: 0, ads: 0 };
  
  // Đếm số lượng campaigns
  const campaignCount = await AdsCampaign.countDocuments({
    external_account_id: accountExternalId,
    status: { $ne: "DELETED" }
  });
  
  // Đếm số lượng adsets
  const adsetCount = await AdsSet.countDocuments({
    external_account_id: accountExternalId,
    status: { $ne: "DELETED" }
  });
  
  // Đếm số lượng ads
  const adCount = await Ads.countDocuments({
    external_account_id: accountExternalId,
    status: { $ne: "DELETED" }
  });
  
  return {
    campaigns: campaignCount,
    adsets: adsetCount,
    ads: adCount
  };
}

/**
 * Lấy thống kê cho nhiều accounts cùng lúc
 */
export async function getMultipleAdsAccountsStats(accountExternalIds) {
  if (!accountExternalIds || !accountExternalIds.length) return {};
  
  const result = {};
  
  // Đếm campaigns theo account_id
  const campaignCounts = await AdsCampaign.aggregate([
    { 
      $match: { 
        external_account_id: { $in: accountExternalIds },
        status: { $ne: "DELETED" }
      } 
    },
    { 
      $group: { 
        _id: "$external_account_id", 
        count: { $sum: 1 } 
      } 
    }
  ]);
  
  // Đếm adsets theo account_id
  const adsetCounts = await AdsSet.aggregate([
    { 
      $match: { 
        external_account_id: { $in: accountExternalIds },
        status: { $ne: "DELETED" }
      } 
    },
    { 
      $group: { 
        _id: "$external_account_id", 
        count: { $sum: 1 } 
      } 
    }
  ]);
  
  // Đếm ads theo account_id
  const adCounts = await Ads.aggregate([
    { 
      $match: { 
        external_account_id: { $in: accountExternalIds },
        status: { $ne: "DELETED" }
      } 
    },
    { 
      $group: { 
        _id: "$external_account_id", 
        count: { $sum: 1 } 
      } 
    }
  ]);
  
  // Khởi tạo kết quả mặc định
  for (const accountId of accountExternalIds) {
    result[accountId] = {
      campaigns: 0,
      adsets: 0,
      ads: 0
    };
  }
  
  // Điền dữ liệu campaigns
  for (const item of campaignCounts) {
    if (result[item._id]) {
      result[item._id].campaigns = item.count;
    }
  }
  
  // Điền dữ liệu adsets
  for (const item of adsetCounts) {
    if (result[item._id]) {
      result[item._id].adsets = item.count;
    }
  }
  
  // Điền dữ liệu ads
  for (const item of adCounts) {
    if (result[item._id]) {
      result[item._id].ads = item.count;
    }
  }
  
  return result;
}
