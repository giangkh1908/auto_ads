import { syncCampaignsFromFacebook, fetchCampaignsFromFacebook, updateCampaignStatus, deleteEntity, fetchInsightsForEntities, syncAllFromFacebook } from "../../services/fbAdsService.js";
import User from "../../models/user.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";

// Helper function để extract string ID từ ObjectId format
function extractObjectId(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/[0-9a-fA-F]{24}/);
    return match ? match[0] : null;
  }
  if (value.$oid) return value.$oid; // trong trường hợp Mongo xuất ra kiểu { $oid: '...' }
  return value.toString();
}

/**
 * GET /api/campaigns
 * Lấy danh sách chiến dịch quảng cáo
 */
export async function listCampaignsCtrl(req, res) {
  try {
    const { account_id, q, status, page = 1, limit = 10, fetch_all = false } = req.query;
    
    // Xây dựng filter
    const filter = {};
    
    // ✅ Lấy tất cả items (không filter theo status) - Frontend sẽ filter
    if (account_id) {
      // Hỗ trợ cả định dạng có act_ và không có act_
      const normalizedId = account_id.startsWith('act_') ? account_id.substring(4) : account_id;
      filter.external_account_id = { $in: [normalizedId, `act_${normalizedId}`] };
    }
    
    // Nếu có filter status cụ thể, áp dụng filter đó (bao gồm cả DELETED nếu query)
    if (status) {
      filter.status = status;
    }
    // Nếu không có status parameter, lấy tất cả (bao gồm cả DELETED)
    
    if (q) filter.name = new RegExp(q, 'i');
    
    // Hỗ trợ fetch_all hoặc limit lớn để Frontend có thể sort và phân trang
    const limitNum = Number(limit);
    const shouldFetchAll = fetch_all === 'true' || fetch_all === true || limitNum === 0 || limitNum > 10000;
    
    let items, total;
    
    if (shouldFetchAll) {
      // Fetch tất cả (không phân trang) - để Frontend sort và phân trang
      [items, total] = await Promise.all([
        AdsCampaign.find(filter)
          .populate('created_by', 'full_name email')
          .sort({ createdAt: -1 }), // Sort ở Backend trước
        AdsCampaign.countDocuments(filter)
      ]);
      
      return res.status(200).json({
        items,
        total,
        page: 1,
        limit: total,
        pages: 1,
      });
    } else {
      // Phân trang như cũ (nếu cần)
      const skip = (Number(page) - 1) * Number(limit);
      [items, total] = await Promise.all([
        AdsCampaign.find(filter)
          .populate('created_by', 'full_name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        AdsCampaign.countDocuments(filter)
      ]);
      
      return res.status(200).json({
        items,
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      });
    }
  } catch (err) {
    console.error("GET Campaigns error:", err);
    return res.status(500).json({ 
      message: "Lỗi khi lấy danh sách chiến dịch", 
      error: err.message 
    });
  }
}
/**
 * GET /api/campaigns/database
 * Lấy campaign từ database theo campaign_id
 */
export async function getCampaignFromDatabase(req, res) {
  try {
    const { campaign_id } = req.query;
    
    if (!campaign_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu campaign_id"
      });
    }

    // Extract và validate campaign_id
    const cleanCampaignId = extractObjectId(campaign_id);
    if (!cleanCampaignId) {
      return res.status(400).json({
        success: false,
        message: "campaign_id không hợp lệ"
      });
    }

    const campaign = await AdsCampaign.findById(cleanCampaignId)
      .populate('created_by', 'full_name email');
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy campaign"
      });
    }

    return res.status(200).json({
      success: true,
      data: campaign
    });
  } catch (err) {
    console.error("GET Campaign from database error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy campaign từ database",
      error: err.message
    });
  }
}

/**
 * GET /api/campaigns/:id
 * Lấy chi tiết một chiến dịch
 */
export async function getCampaignCtrl(req, res) {
  try {
    const campaign = await AdsCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: "Không tìm thấy chiến dịch" });
    }
    return res.status(200).json(campaign);
  } catch (err) {
    console.error("GET Campaign error:", err);
    return res.status(500).json({ 
      message: "Lỗi khi lấy chi tiết chiến dịch", 
      error: err.message 
    });
  }
}

/**
 * GET /api/campaigns/sync
 * Đồng bộ campaigns từ Facebook
 */
export async function syncCampaignsCtrl(req, res) {
  try {
    const { account_id } = req.query;
    
    if (!account_id) {
      return res.status(400).json({ message: "Thiếu account_id" });
    }
    
    // 1) Lấy token từ query (nếu FE có truyền)
    let accessToken = req.query.access_token;

    // 2) Nếu không có: lấy từ DB theo user hiện tại
    if (!accessToken) {
      const user = await User.findById(req.user?._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }
    
    if (!accessToken) {
      return res.status(400).json({ 
        message: "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true
      });
    }
    
    console.log(`Đồng bộ campaigns cho tài khoản ${account_id}`);
    
    try {
      // Đồng bộ campaigns
      const results = await syncCampaignsFromFacebook(accessToken, account_id);
      
      return res.status(200).json({
        message: `Đã đồng bộ ${results.length} chiến dịch quảng cáo từ Facebook`,
        count: results.length
      });
    } catch (syncError) {
      // Xử lý lỗi từ Facebook API cụ thể
      if (syncError.response?.data?.error?.code === 190) {
        return res.status(401).json({
          message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
          tokenExpired: true
        });
      }
      
      if (syncError.response?.data?.error?.code === 10) {
        return res.status(403).json({
          message: "Không có quyền truy cập quảng cáo. Vui lòng cấp thêm quyền.",
          permissionDenied: true
        });
      }
      
      if (syncError.response?.data?.error?.code === 17 || syncError.response?.data?.error?.error_subcode === 2446079) {
        console.warn("⚠️ Facebook rate limit reached for account:", account_id);
        return res.status(429).json({
          message: "Đã đạt giới hạn API của Facebook. Vui lòng thử lại sau 5-10 phút.",
          rateLimitReached: true,
          retryAfter: 300
        });
      }
      
      throw syncError;
    }
  } catch (err) {
    console.error("SYNC Campaigns error:", err);
    return res.status(500).json({
      message: "Lỗi khi đồng bộ chiến dịch từ Facebook",
      error: err.message
    });
  }
}

/**
 * GET /api/campaigns/sync-all
 * ✅ Batch Sync: Đồng bộ tất cả entities (Campaigns, AdSets, Ads) trong một batch request
 * Giảm từ 3 API calls xuống 1 batch request → tăng hiệu suất đáng kể
 */
export async function syncAllCtrl(req, res) {
  try {
    const { account_id } = req.query;
    
    if (!account_id) {
      return res.status(400).json({ message: "Thiếu account_id" });
    }
    
    let accessToken = req.query.access_token;
    if (!accessToken && req.user?._id) {
      const user = await User.findById(req.user._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }
    
    if (!accessToken) {
      return res.status(400).json({ 
        message: "Không tìm thấy Facebook access_token",
        missingToken: true
      });
    }
    
    console.log(`🔄 Batch sync tất cả entities cho account ${account_id}`);
    
    try {
      // ✅ Gọi batch sync (1 request thay vì 3)
      const results = await syncAllFromFacebook(accessToken, account_id);
      
      return res.status(200).json({
        message: "Đã đồng bộ tất cả dữ liệu từ Facebook",
        counts: {
          campaigns: results.campaigns.length,
          adsets: results.adsets.length,
          ads: results.ads.length
        }
      });
    } catch (syncError) {
      if (syncError.response?.data?.error?.code === 190) {
        return res.status(401).json({
          message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
          tokenExpired: true
        });
      }
      
      if (syncError.response?.data?.error?.code === 10) {
        return res.status(403).json({
          message: "Không có quyền truy cập quảng cáo. Vui lòng cấp thêm quyền.",
          permissionDenied: true
        });
      }
      
      if (syncError.response?.data?.error?.code === 17 || syncError.response?.data?.error?.error_subcode === 2446079) {
        console.warn("⚠️ Facebook rate limit reached for account:", account_id);
        return res.status(429).json({
          message: "Đã đạt giới hạn API của Facebook. Vui lòng thử lại sau 5-10 phút.",
          rateLimitReached: true,
          retryAfter: 300
        });
      }
      
      throw syncError;
    }
  } catch (err) {
    console.error("SYNC All error:", err);
    return res.status(500).json({
      message: "Lỗi khi đồng bộ từ Facebook",
      error: err.message
    });
  }
}

/**
 * GET /api/campaigns/live
 * Lấy danh sách campaigns trực tiếp từ Facebook (không lưu DB)
 */
export async function getCampaignsLiveCtrl(req, res) {
  try {
    const { account_id } = req.query;
    if (!account_id) {
      return res.status(400).json({ message: "Thiếu account_id" });
    }

    let accessToken = req.query.access_token;
    if (!accessToken) {
      const user = await User.findById(req.user?._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }
    if (!accessToken) {
      return res.status(400).json({
        message: "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    const data = await fetchCampaignsFromFacebook(accessToken, account_id);
    return res.status(200).json({ items: data, total: data.length });
  } catch (err) {
    console.error("GET Live Campaigns error:", err);
    return res.status(500).json({ message: "Lỗi lấy campaigns từ Facebook", error: err.message });
  }
}

/**
 * PATCH /api/campaigns/:id/status
 * Bật/Tắt campaign trực tiếp trên Facebook
 */
export async function toggleCampaignStatusCtrl(req, res) {
  try {
    const { id } = req.params; // Facebook campaign id (external_id)
    const { status } = req.body; // "ACTIVE" | "PAUSED"
    if (!id || !status) {
      return res.status(400).json({ message: "Thiếu id hoặc status" });
    }

    // Lấy token người dùng hiện tại
    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "Thiếu access token Facebook" });
    }

    const fbId = id.startsWith("act_") ? id : id; // campaign id không có act_
    await updateCampaignStatus(fbId, accessToken, status);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Toggle campaign status error:", err.response?.data || err.message);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái campaign", detail: err.response?.data || err.message });
  }
}

export async function deleteCampaignCascadeCtrl(req, res) {
  try {
    const { id } = req.params;
    const campaign = await AdsCampaign.findById(id);
    if (!campaign)
      return res.status(404).json({ message: "Không tìm thấy chiến dịch." });

    // ✅ Lấy token từ user hoặc query
    let accessToken = req.query.access_token;
    if (!accessToken && req.user?._id) {
      const user = await User.findById(req.user._id).select(
        "+facebookAccessToken"
      );
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      return res.status(400).json({
        message:
          "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    // Lấy adset + ads liên quan
    const adsets = await AdsSet.find({ campaign_id: campaign._id });
    const adsetIds = adsets.map((a) => a._id);
    const ads = await Ads.find({ set_id: { $in: adsetIds } });

    // ✅ Nếu có token → xoá thật trên Facebook
    if (accessToken) {
      try {
        if (campaign.external_id)
          await deleteEntity(campaign.external_id, accessToken);

        for (const adset of adsets) {
          if (adset.external_id)
            await deleteEntity(adset.external_id, accessToken);
        }

        for (const ad of ads) {
          if (ad.external_id) await deleteEntity(ad.external_id, accessToken);
        }

        console.log(
          `🧹 Đã xoá campaign ${campaign.name} và ${adsets.length} adsets trên Facebook.`
        );
      } catch (fbErr) {
        console.warn(
          "⚠️ Lỗi khi xoá campaign trên Facebook:",
          fbErr?.response?.data || fbErr.message
        );
      }
    }

    // Dù có token hay không → Xoá mềm trong DB
    const now = new Date();
    await Promise.all([
      Ads.updateMany(
        { set_id: { $in: adsetIds } },
        { status: "DELETED", deleted_at: now }
      ),
      AdsSet.updateMany(
        { _id: { $in: adsetIds } },
        { status: "DELETED", deleted_at: now }
      ),
      AdsCampaign.findByIdAndUpdate(id, { status: "DELETED", deleted_at: now }),
    ]);

    return res.status(200).json({
      success: true,
      message: `Đã xoá chiến dịch "${campaign.name}" cùng toàn bộ nhóm quảng cáo & quảng cáo liên quan.`,
    });
  } catch (err) {
    console.error("❌ Xoá Campaign cascade lỗi:", err);
    return res.status(500).json({
      message: "Xoá thất bại",
      error: err.message,
    });
  }
}

/**
 * POST /api/campaigns/:id/archive
 * Archive campaign và các adsets, ads liên quan (set status ARCHIVED thay vì DELETED)
 */
export async function archiveCampaignCascadeCtrl(req, res) {
  try {
    const { id } = req.params;
    const campaign = await AdsCampaign.findById(id);
    if (!campaign)
      return res.status(404).json({ message: "Không tìm thấy chiến dịch." });

    // ✅ Lấy token từ user hoặc query
    let accessToken = req.query.access_token;
    if (!accessToken && req.user?._id) {
      const user = await User.findById(req.user._id).select(
        "+facebookAccessToken"
      );
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      return res.status(400).json({
        message:
          "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    // Lấy adset + ads liên quan
    const adsets = await AdsSet.find({ campaign_id: campaign._id });
    const adsetIds = adsets.map((a) => a._id);
    const ads = await Ads.find({ set_id: { $in: adsetIds } });

    // ✅ Nếu có token → Xóa thật trên Facebook (giống delete)
    if (accessToken) {
      try {
        if (campaign.external_id)
          await deleteEntity(campaign.external_id, accessToken);

        for (const adset of adsets) {
          if (adset.external_id)
            await deleteEntity(adset.external_id, accessToken);
        }

        for (const ad of ads) {
          if (ad.external_id) await deleteEntity(ad.external_id, accessToken);
        }

        console.log(
          `📦 Đã xóa (archive) campaign ${campaign.name} và ${adsets.length} adsets trên Facebook.`
        );
      } catch (fbErr) {
        console.warn(
          "⚠️ Lỗi khi xóa (archive) campaign trên Facebook:",
          fbErr?.response?.data || fbErr.message
        );
      }
    }

    // ✅ Cập nhật status ARCHIVED trong DB
    const now = new Date();
    await Promise.all([
      Ads.updateMany(
        { set_id: { $in: adsetIds } },
        { status: "ARCHIVED", updated_at: now }
      ),
      AdsSet.updateMany(
        { _id: { $in: adsetIds } },
        { status: "ARCHIVED", updated_at: now }
      ),
      AdsCampaign.findByIdAndUpdate(id, { status: "ARCHIVED", updated_at: now }),
    ]);

    return res.status(200).json({
      success: true,
      message: `Đã lưu trữ chiến dịch "${campaign.name}" cùng toàn bộ nhóm quảng cáo & quảng cáo liên quan.`,
    });
  } catch (err) {
    console.error("❌ Archive Campaign cascade lỗi:", err);
    return res.status(500).json({
      message: "Lưu trữ thất bại",
      error: err.message,
    });
  }
}

/**
 * POST /api/campaigns/:id/copy
 * Tạo bản sao Campaign kèm toàn bộ AdSet và Ad con (DB only, không gọi Facebook)
 */
export async function copyCampaignCascadeCtrl(req, res) {
  try {
    const { id } = req.params;
    const source = await AdsCampaign.findById(id);
    if (!source) return res.status(404).json({ message: "Không tìm thấy chiến dịch." });

    // 1) Tạo campaign mới
    const newCampaign = await AdsCampaign.create({
      name: `${source.name || "Chiến dịch"} (bản sao)`,
      objective: source.objective,
      status: "IN_PROCESS",
      account_id: source.account_id,
      shop_id: source.shop_id,
      page_id: source.page_id,
      page_name: source.page_name,
      daily_budget: source.daily_budget,
      lifetime_budget: source.lifetime_budget,
      start_time: source.start_time,
      stop_time: source.stop_time,
      external_id: null,
      external_account_id: source.external_account_id,
    });

    // 2) Lấy tất cả adsets của source
    const srcAdsets = await AdsSet.find({ campaign_id: source._id }).lean();
    const idMap = new Map(); // map source adset _id -> new adset _id

    for (const s of srcAdsets) {
      const created = await AdsSet.create({
        campaign_id: newCampaign._id,
        external_account_id: s.external_account_id,
        name: `${s.name || "Nhóm quảng cáo"} (bản sao)`,
        status: "IN_PROCESS",
        configured_status: s.configured_status,
        effective_status: s.effective_status,
        optimization_goal: s.optimization_goal,
        billing_event: s.billing_event,
        bid_strategy: s.bid_strategy,
        bid_amount: s.bid_amount,
        pixel_id: s.pixel_id,
        conversion_event: s.conversion_event,
        promoted_object: s.promoted_object,
        targeting: s.targeting,
        daily_budget: s.daily_budget,
        lifetime_budget: s.lifetime_budget,
        start_time: s.start_time,
        end_time: s.end_time,
        external_id: null,
      });
      idMap.set(String(s._id), created._id);
    }

    // 3) Copy ads của từng adset
    const srcAdsetIds = srcAdsets.map((a) => a._id);
    const srcAds = await Ads.find({ set_id: { $in: srcAdsetIds } }).lean();
    const newAds = [];
    for (const a of srcAds) {
      const newSetId = idMap.get(String(a.set_id));
      if (!newSetId) continue;
      const createdAd = await Ads.create({
        name: `${a.name || "Quảng cáo"} (bản sao)`,
        status: "IN_PROCESS",
        external_id: null,
        external_account_id: a.external_account_id,
        set_id: newSetId,
        campaign_id: newCampaign._id,
        effective_status: a.effective_status,
        creative: a.creative,
      });
      newAds.push(createdAd);
    }

    return res.status(201).json({
      success: true,
      message: "Đã sao chép chiến dịch cùng AdSet & Ad.",
      data: {
        campaign: newCampaign,
        adsets: Array.from(idMap.values()),
        adsCount: newAds.length,
      },
    });
  } catch (err) {
    console.error("❌ Copy campaign cascade lỗi:", err);
    return res.status(500).json({ message: "Copy thất bại", error: err.message });
  }
}

/**
 * GET /api/campaigns/insights
 * Lấy insights cho nhiều campaigns từ Facebook
 */
export async function getCampaignInsightsCtrl(req, res) {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ message: "Thiếu danh sách IDs" });
    }

    const campaignIds = ids.split(',');

    // Lấy token người dùng hiện tại
    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "Thiếu access token Facebook" });
    }

    // Gọi service để lấy insights (bạn cần đảm bảo hàm này tồn tại trong fbAdsService.js)
    const insightsData = await fetchInsightsForEntities(campaignIds, accessToken);

    // Map lại data để FE dễ xử lý: { id: '...', insights: {...} }
    const items = insightsData.map(item => ({
      id: item.id,
      insights: item.insights?.data?.[0] || {}
    }));

    return res.status(200).json({ items });

  } catch (err) {
    console.error("GET Campaign Insights error:", err.response?.data || err.message);
    return res.status(500).json({ 
      message: "Không thể lấy dữ liệu insights", 
      detail: err.response?.data || err.message 
    });
  }
}
