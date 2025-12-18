// services/adsAccount.service.js
import axios from "axios";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";

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

/** Upsert 1 tài khoản - Xử lý nhiều users có cùng account */
export async function upsertOneAdAccount(fbAcc, { shopUserId, adminUserId, shopId = null }) {
  const accountData = {
    external_id: fbAcc.id,
    name: fbAcc.name,
    currency: fbAcc.currency,
    timezone_name: fbAcc.timezone_name,
    account_status: fbAcc.account_status,
    last_updated_at: new Date(),
  };

  // Tìm account đã tồn tại
  const existingAccount = await AdsAccount.findOne({ external_id: fbAcc.id });

  if (existingAccount) {
    // Account đã tồn tại → Thêm user vào danh sách nếu chưa có
    const userIdToAdd = adminUserId || shopUserId;
    
    if (userIdToAdd && !existingAccount.user_ids.some(
      id => id.toString() === userIdToAdd.toString()
    )) {
      // Thêm user vào array user_ids
      existingAccount.user_ids.push(userIdToAdd);
      
      // Cập nhật thông tin account
      existingAccount.name = accountData.name;
      existingAccount.currency = accountData.currency;
      existingAccount.timezone_name = accountData.timezone_name;
      existingAccount.account_status = accountData.account_status;
      existingAccount.last_updated_at = accountData.last_updated_at;
      
      // Nếu shop_id chưa có, có thể cập nhật (tùy logic business)
      if (shopId && !existingAccount.shop_id) {
        existingAccount.shop_id = shopId;
      }
      
      await existingAccount.save();
      return existingAccount;
    } else {
      // User đã có trong danh sách → chỉ cập nhật thông tin
      existingAccount.name = accountData.name;
      existingAccount.currency = accountData.currency;
      existingAccount.timezone_name = accountData.timezone_name;
      existingAccount.account_status = accountData.account_status;
      existingAccount.last_updated_at = accountData.last_updated_at;
      await existingAccount.save();
      return existingAccount;
    }
  } else {
    // Account chưa tồn tại → Tạo mới
    accountData.shop_admin_id = adminUserId; // Owner đầu tiên
    accountData.user_ids = [adminUserId]; // Thêm owner vào danh sách
    if (shopUserId && shopUserId.toString() !== adminUserId?.toString()) {
      accountData.user_ids.push(shopUserId);
    }
    accountData.shop_user_id = shopUserId || undefined;
    accountData.shop_id = shopId || undefined;

    const newAccount = await AdsAccount.create(accountData);
    return newAccount;
  }
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
  userId,        // ID người dùng hiện tại (BẮT BUỘC)
  q,
  status, 
  account_status, 
  page = 1,
  limit = 10,
  sort = "-updated_at",
}) {
  const filter = {};
  
  // ✅ Filter theo user_ids: Account phải có user này trong danh sách
  if (userId) {
    filter.user_ids = userId; // MongoDB sẽ match trong array
  }

  // Xử lý search query
  if (q) {
    const searchFilter = [
      { name: new RegExp(q, "i") },
      { external_id: new RegExp(q, "i") },
    ];
    
    if (filter.user_ids) {
      // Nếu có user_ids, dùng $and để kết hợp với search
      filter.$and = [
        { user_ids: filter.user_ids },
        { $or: searchFilter }
      ];
      delete filter.user_ids;
    } else {
      filter.$or = searchFilter;
    }
  }
  
  // Thêm các điều kiện khác (status, account_status)
  if (status) {
    if (filter.$and) {
      filter.$and.push({ status });
    } else {
      filter.status = status;
    }
  }
  
  if (typeof account_status !== "undefined") {
    if (filter.$and) {
      filter.$and.push({ account_status: Number(account_status) });
    } else {
      filter.account_status = Number(account_status);
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    AdsAccount.find(filter)
      .populate('shop_admin_id', 'username email full_name')  // Owner
      .populate('user_ids', 'username email full_name')  // Tất cả users có quyền
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
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

/** Hard delete = xóa thật account khỏi DB, giữ nguyên dữ liệu liên quan */
export async function hardDeleteAdsAccount(id) {
  const deleted = await AdsAccount.findByIdAndDelete(id);
  return deleted;
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
