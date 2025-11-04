// controllers/ads/adsWizard.controller.js
import mongoose from 'mongoose';
import { 
  publishWizard, 
  updateWizard,
  publishCampaignService,
  publishAdsetService,
  publishAdService,
  publishFlexibleService,
  updateFlexibleService,
} from "../../services/adsWizardService.js";
import User from "../../models/user.model.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";
import Creative from "../../models/ads/creative.model.js";
import { convertCTAToFacebookType } from "../../utils/ctaUtils.js";

/**
 * 🪄 Controller: Publish quy trình tạo quảng cáo Wizard
 * Bao gồm Campaign → AdSet → Creative → Ad
 */
export async function publishAdsWizard(req, res) {
  try {
    const {
      ad_account_id,
      access_token: tokenFromFE,
      campaign,
      adset,
      creative,
      ad,
      dry_run = false,
      campaignDraftId,
      adsetDraftId,
      creativeDraftId,
      adDraftId,
    } = req.body;

    //  Lấy Access Token: luôn ưu tiên token lưu trong DB để khớp APP SECRET
    const user = await User.findById(req.user?._id).select(
      "+facebookAccessToken"
    );
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại hoặc chưa đăng nhập.",
      });
    }
    const access_token = user.facebookAccessToken || tokenFromFE;

    if (!ad_account_id || !access_token) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ad_account_id hoặc access_token.",
      });
    }

    // Kiểm tra quyền sở hữu tài khoản quảng cáo
    const account = await AdsAccount.findOne({
      external_id: ad_account_id,
      $or: [
        { user: req.user._id },
        { shop_admin_id: req.user._id },
        { shop_user_id: req.user._id },
      ],
    });

    if (!account) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản quảng cáo không thuộc quyền sở hữu của bạn.",
      });
    }

    // Validate dữ liệu đầu vào cơ bản
    if (!campaign?.name || !campaign?.objective) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin chiến dịch (tên hoặc mục tiêu).",
      });
    }

    if (!adset?.name) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tên nhóm quảng cáo (Ad Set).",
      });
    }

    if (!creative?.object_story_spec) {
      return res.status(400).json({
        success: false,
        message: "Thiếu nội dung quảng cáo (Creative.object_story_spec).",
      });
    }

    console.log(
      ` [Wizard] Bắt đầu publish quảng cáo cho account: ${ad_account_id}`
    );

    // Sửa trong hàm publishAdsWizard

    // Thêm đoạn này ngay trước khi gọi service
    // Khoảng dòng 68 (sau phần validate)
    if (adset.bid_strategy === "LOWEST_COST_WITHOUT_CAP" && adset.bid_amount !== undefined) {
      console.log("⚠️ Controller: Phát hiện xung đột bid_strategy và bid_amount");
      // Xóa bid_amount trực tiếp từ đối tượng hiện tại
      delete adset.bid_amount; // ✅ Hợp lệ - chỉ sửa thuộc tính không gán lại biến
    }

    // Gọi service chính
    const result = await publishWizard({
      ad_account_id,
      access_token,
      campaign: {
        ...campaign,
        account_id: account._id,
        shop_id: account.shop_id || req.user.shop_id, // fallback sang user.shop_id
        created_by: req.user._id,
        page_id: campaign.page_id,
        page_name: campaign.page_name,
      },
      adset: {
        ...adset, // Sử dụng adset đã được xử lý
        created_by: req.user._id,
      },
      creative: {
        ...creative,
        created_by: req.user._id,
      },
      ad: {
        ...ad,
        created_by: req.user._id,
      },
      dry_run,
      campaignDraftId,
      adsetDraftId,
      creativeDraftId,
      adDraftId,
    });

    // Trả kết quả cho FE
    return res.status(201).json({
      success: true,
      message: dry_run
        ? "Dry run thành công (chưa publish thật)."
        : "Publish thành công.",
      data: {
        campaign: result.campaign,
        adset: result.adset,
        ad: result.ad,
        creative: result.creative,
        drafts: result.drafts,
      },
    });
  } catch (error) {
    console.error("Publish Wizard Error:", error?.response?.data || error);
    const status = error?.response?.status || 500;
    const error_user_msg =
      error?.response?.data?.error_user_msg ||
      error?.response?.data?.error?.error_user_msg ||
      null;
    return res.status(status).json({
      success: false,
      message: "Publish thất bại.",
      error_user_msg,
    });
  }
}

export async function updateAdsWizard(req, res) {
  try {
    const {
      ad_account_id,
      access_token: tokenFromFE,
      campaign,
      adset,
      creative,
      ad,
      dry_run = false,
    } = req.body;

    // 🧩 1️⃣ Lấy Access Token
    let access_token = tokenFromFE;
    if (!access_token) {
      const user = await User.findById(req.user?._id).select("+facebookAccessToken");
      if (!user)
        return res.status(401).json({ success: false, message: "Người dùng không tồn tại hoặc chưa đăng nhập." });
      access_token = user.facebookAccessToken;
    }

    if (!ad_account_id || !access_token) {
      return res.status(400).json({ success: false, message: "Thiếu ad_account_id hoặc access_token." });
    }

    // 🧩 2️⃣ Kiểm tra quyền sở hữu tài khoản quảng cáo
    const account = await AdsAccount.findOne({
      external_id: ad_account_id,
      $or: [
        { user: req.user._id },
        { shop_admin_id: req.user._id },
        { shop_user_id: req.user._id },
      ],
    });
    if (!account)
      return res.status(403).json({ success: false, message: "Tài khoản quảng cáo không thuộc quyền sở hữu của bạn." });

    // ✅ CASE 1: Nếu có campaign.adsets → dùng cascade update
    if (campaign?.adsets && Array.isArray(campaign.adsets) && campaign.adsets.length > 0) {
      console.log(`🔄 [Wizard] Sử dụng cascade update cho campaign: ${campaign.name}`);
      
      // Enrich campaign data
      const enrichedCampaign = {
        ...campaign,
        account_id: account._id,
        shop_id: account.shop_id || req.user.shop_id,
        // ⚠️ KHÔNG ghi đè created_by khi update
        adsets: campaign.adsets.map(adset => ({
          ...adset,
          ads: adset.ads?.map(ad => ({
            ...ad,
          })) || []
        }))
      };
      
      const result = await updateFlexibleService({
        ad_account_id,
        access_token,
        campaignsList: [enrichedCampaign], // Wrap single campaign
      });
      
      return res.status(200).json({
        success: result.success,
        message: `Cập nhật ${result.totalUpdated} entities, tạo mới ${result.totalCreated} entities`,
        data: result,
      });
    }

    // ✅ CASE 2: Fallback - dùng updateWizard cũ cho backward compatibility
    console.log(`🔄 [Wizard] Sử dụng update riêng lẻ (legacy) cho account: ${ad_account_id}`);
    
    // Xử lý xung đột bid_strategy cho adset
    if (adset?.bid_strategy === "LOWEST_COST_WITHOUT_CAP" && adset?.bid_amount !== undefined) {
      console.log("⚠️ Controller (update): Phát hiện xung đột bid_strategy và bid_amount");
      delete adset.bid_amount;
    }

    // 🧩 3️⃣ Gọi service updateWizard
    const result = await updateWizard({
      ad_account_id,
      access_token,
      campaign,
      adset,
      creative,
      ad,
      dry_run,
    });

    // 🧩 4️⃣ Trả kết quả cho FE
    return res.status(200).json({
      success: true,
      message: dry_run
        ? "Dry run update thành công (chưa cập nhật thật)."
        : "Cập nhật wizard thành công.",
      data: result,
    });
  } catch (error) {
    console.error("🔥 Update Wizard Error:", error?.response?.data || error);
    const status = error?.response?.status || 500;
    const error_user_msg =
      error?.response?.data?.error_user_msg ||
      error?.response?.data?.error?.error_user_msg ||
      null;
    return res.status(status).json({
      success: false,
      message: "Cập nhật wizard thất bại.",
      error_user_msg,
    });
  }
}

// ========================================
// 🎯 NEW FLEXIBLE CONTROLLERS FOR DIFFERENT MODELS
// ========================================

/**
 * 🎯 Controller: Tạo Campaign riêng biệt
 * POST /api/ads-wizard/publish-campaign
 */
export async function publishCampaignController(req, res) {
  try {
    const {
      ad_account_id,
      access_token: tokenFromFE,
      campaign,
      dry_run = false,
      campaignDraftId,
    } = req.body;

    // Lấy Access Token: luôn ưu tiên token lưu trong DB để khớp APP SECRET
    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại hoặc chưa đăng nhập.",
      });
    }
    const access_token = user.facebookAccessToken || tokenFromFE;

    if (!ad_account_id || !access_token) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ad_account_id hoặc access_token.",
      });
    }

    // Kiểm tra quyền sở hữu tài khoản quảng cáo
    const account = await AdsAccount.findOne({
      external_id: ad_account_id,
      $or: [
        { user: req.user._id },
        { shop_admin_id: req.user._id },
        { shop_user_id: req.user._id },
      ],
    });

    if (!account) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản quảng cáo không thuộc quyền sở hữu của bạn.",
      });
    }

    // Validate dữ liệu đầu vào cơ bản
    if (!campaign?.name || !campaign?.objective) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin chiến dịch (tên hoặc mục tiêu).",
      });
    }

    console.log(`[Campaign Only] Bắt đầu tạo campaign: ${campaign.name}`);

    // Gọi service tạo campaign
    const result = await publishCampaignService({
      ad_account_id,
      access_token,
      campaign: {
        ...campaign,
        account_id: account._id,
        shop_id: account.shop_id || req.user.shop_id,
        created_by: req.user._id,
        page_id: campaign.page_id,
        page_name: campaign.page_name,
      },
      dry_run,
      campaignDraftId,
    });

    return res.status(200).json({
      success: true,
      message: "Tạo campaign thành công!",
      data: result,
    });

  } catch (error) {
    console.error("❌ Lỗi publish campaign:", error);
    const error_user_msg = error?.response?.data?.error_user_msg || error.message;
    const status = error?.response?.status || 500;

    return res.status(status).json({
      success: false,
      message: "Tạo campaign thất bại.",
      error_user_msg,
    });
  }
}

/**
 * 🎯 Controller: Tạo AdSet cho Campaign đã có
 * POST /api/ads-wizard/publish-adset
 */
export async function publishAdsetController(req, res) {
  try {
    const {
      ad_account_id,
      access_token: tokenFromFE,
      campaignId,
      adset,
      dry_run = false,
      adsetDraftId,
    } = req.body;

    // Lấy Access Token
    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại hoặc chưa đăng nhập.",
      });
    }
    const access_token = user.facebookAccessToken || tokenFromFE;

    if (!ad_account_id || !access_token || !campaignId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ad_account_id, access_token hoặc campaignId.",
      });
    }

    // Kiểm tra quyền sở hữu tài khoản quảng cáo
    const account = await AdsAccount.findOne({
      external_id: ad_account_id,
      $or: [
        { user: req.user._id },
        { shop_admin_id: req.user._id },
        { shop_user_id: req.user._id },
      ],
    });

    if (!account) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản quảng cáo không thuộc quyền sở hữu của bạn.",
      });
    }

    // Validate dữ liệu đầu vào
    if (!adset?.name) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tên nhóm quảng cáo (Ad Set).",
      });
    }

    console.log(`[AdSet Only] Bắt đầu tạo adset: ${adset.name} cho campaign: ${campaignId}`);

    // Gọi service tạo adset
    const result = await publishAdsetService({
      ad_account_id,
      access_token,
      campaignId,
      adset: {
        ...adset,
        created_by: req.user._id,
      },
      dry_run,
      adsetDraftId,
    });

    return res.status(200).json({
      success: true,
      message: "Tạo adset thành công!",
      data: result,
    });

  } catch (error) {
    console.error("❌ Lỗi publish adset:", error);
    const error_user_msg = error?.response?.data?.error_user_msg || error.message;
    const status = error?.response?.status || 500;

    return res.status(status).json({
      success: false,
      message: "Tạo adset thất bại.",
      error_user_msg,
    });
  }
}

/**
 * 🎯 Controller: Tạo Ad cho AdSet đã có
 * POST /api/ads-wizard/publish-ad
 */
export async function publishAdController(req, res) {
  try {
    const {
      ad_account_id,
      access_token: tokenFromFE,
      adsetId,
      creative,
      ad,
      dry_run = false,
      adDraftId,
    } = req.body;

    // Lấy Access Token
    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại hoặc chưa đăng nhập.",
      });
    }
    const access_token = user.facebookAccessToken || tokenFromFE;

    if (!ad_account_id || !access_token || !adsetId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ad_account_id, access_token hoặc adsetId.",
      });
    }

    // Kiểm tra quyền sở hữu tài khoản quảng cáo
    const account = await AdsAccount.findOne({
      external_id: ad_account_id,
      $or: [
        { user: req.user._id },
        { shop_admin_id: req.user._id },
        { shop_user_id: req.user._id },
      ],
    });

    if (!account) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản quảng cáo không thuộc quyền sở hữu của bạn.",
      });
    }

    // Validate dữ liệu đầu vào
    if (!creative?.object_story_spec) {
      return res.status(400).json({
        success: false,
        message: "Thiếu nội dung quảng cáo (Creative.object_story_spec).",
      });
    }

    if (!ad?.name) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tên quảng cáo (Ad).",
      });
    }

    console.log(`[Ad Only] Bắt đầu tạo ad: ${ad.name} cho adset: ${adsetId}`);

    // Gọi service tạo ad
    const result = await publishAdService({
      ad_account_id,
      access_token,
      adsetId,
      creative: {
        ...creative,
        created_by: req.user._id,
      },
      ad: {
        ...ad,
        created_by: req.user._id,
      },
      dry_run,
      adDraftId,
    });

    return res.status(200).json({
      success: true,
      message: "Tạo ad thành công!",
      data: result,
    });

  } catch (error) {
    console.error("❌ Lỗi publish ad:", error);
    const error_user_msg = error?.response?.data?.error_user_msg || error.message;
    const status = error?.response?.status || 500;

    return res.status(status).json({
      success: false,
      message: "Tạo ad thất bại.",
      error_user_msg,
    });
  }
}

/**
 * 🎯 Controller: Tạo toàn bộ cấu trúc linh hoạt
 * POST /api/ads-wizard/publish-flexible
 */
export async function publishFlexibleController(req, res) {
  try {
    const {
      ad_account_id,
      access_token: tokenFromFE,
      campaignsList,
      dry_run = false,
    } = req.body;

    // Lấy Access Token
    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại hoặc chưa đăng nhập.",
      });
    }
    const access_token = user.facebookAccessToken || tokenFromFE;

    if (!ad_account_id || !access_token) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ad_account_id hoặc access_token.",
      });
    }

    // Kiểm tra quyền sở hữu tài khoản quảng cáo
    const account = await AdsAccount.findOne({
      external_id: ad_account_id,
      $or: [
        { user: req.user._id },
        { shop_admin_id: req.user._id },
        { shop_user_id: req.user._id },
      ],
    });

    if (!account) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản quảng cáo không thuộc quyền sở hữu của bạn.",
      });
    }

    // Validate dữ liệu đầu vào
    if (!campaignsList || !Array.isArray(campaignsList) || campaignsList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Thiếu danh sách campaigns hoặc danh sách rỗng.",
      });
    }

    // Validate từng campaign
    for (let i = 0; i < campaignsList.length; i++) {
      const campaign = campaignsList[i];
      if (!campaign?.name || !campaign?.objective) {
        return res.status(400).json({
          success: false,
          message: `Campaign ${i + 1}: Thiếu tên hoặc mục tiêu.`,
        });
      }
      if (!campaign?.adsets || !Array.isArray(campaign.adsets) || campaign.adsets.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Campaign ${i + 1}: Thiếu danh sách adsets.`,
        });
      }
    }

    console.log(`[Flexible Structure] Bắt đầu tạo ${campaignsList.length} campaigns với cấu trúc linh hoạt`);

    // Chuẩn bị dữ liệu với thông tin user
    const enrichedCampaignsList = campaignsList.map(campaign => ({
      ...campaign,
      account_id: account._id,
      shop_id: account.shop_id || req.user.shop_id,
      created_by: req.user._id,
      adsets: campaign.adsets.map(adset => ({
        ...adset,
        created_by: req.user._id,
        ads: adset.ads.map(ad => ({
          ...ad,
          created_by: req.user._id,
          creative: {
            ...ad.creative,
            created_by: req.user._id,
          }
        }))
      }))
    }));

    // Gọi service tạo cấu trúc linh hoạt
    const result = await publishFlexibleService({
      ad_account_id,
      access_token,
      campaignsList: enrichedCampaignsList,
      dry_run,
    });

    return res.status(200).json({
      success: result.success,
      message: result.message,
      data: result,
    });

  } catch (error) {
    console.error("❌ Lỗi publish flexible structure:", error);
    const error_user_msg = error?.response?.data?.error_user_msg || error.message;
    const status = error?.response?.status || 500;

    return res.status(status).json({
      success: false,
      message: "Tạo cấu trúc linh hoạt thất bại.",
      error_user_msg,
    });
  }
}

/**
 * 🔄 Controller: Update toàn bộ cấu trúc linh hoạt
 * PUT /api/ads-wizard/update-flexible
 */
export async function updateFlexibleController(req, res) {
  try {
    const {
      ad_account_id,
      access_token: tokenFromFE,
      campaignsList,
    } = req.body;

    // Lấy Access Token
    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại hoặc chưa đăng nhập.",
      });
    }
    const access_token = user.facebookAccessToken || tokenFromFE;

    if (!ad_account_id || !access_token) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ad_account_id hoặc access_token.",
      });
    }

    // Kiểm tra quyền sở hữu tài khoản quảng cáo
    const account = await AdsAccount.findOne({
      external_id: ad_account_id,
      $or: [
        { user: req.user._id },
        { shop_admin_id: req.user._id },
        { shop_user_id: req.user._id },
      ],
    });

    if (!account) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản quảng cáo không thuộc quyền sở hữu của bạn.",
      });
    }

    // Validate dữ liệu đầu vào
    if (!campaignsList || !Array.isArray(campaignsList) || campaignsList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Thiếu danh sách campaigns hoặc danh sách rỗng.",
      });
    }

    console.log(`Bắt đầu update ${campaignsList.length} campaigns`);

    // Chuẩn bị dữ liệu (⚠️ KHÔNG ghi đè created_by khi update)
    const enrichedCampaignsList = campaignsList.map(campaign => ({
      ...campaign,
      account_id: account._id,
      shop_id: account.shop_id || req.user.shop_id,
      // ⚠️ Không set created_by khi update - chỉ set khi tạo mới trong service
      adsets: (campaign.adsets || []).map(adset => ({
        ...adset,
        ads: (adset.ads || []).map(ad => ({
          ...ad,
          creative: ad.creative ? {
            ...ad.creative,
          } : undefined
        }))
      }))
    }));

    // Gọi service update cấu trúc linh hoạt
    const result = await updateFlexibleService({
      ad_account_id,
      access_token,
      campaignsList: enrichedCampaignsList,
    });

    return res.status(200).json({
      success: result.success,
      message: result.message,
      data: result,
    });

  } catch (error) {
    console.error("❌ Lỗi update flexible structure:", error);
    const error_user_msg = error?.response?.data?.error_user_msg || error.message;
    const status = error?.response?.status || 500;

    return res.status(status).json({
      success: false,
      message: "Cập nhật cấu trúc linh hoạt thất bại.",
      error_user_msg,
    });
  }
}

/**
 * 🔍 Helper: Kiểm tra xem ID có phải ObjectId hợp lệ không (không phải temp ID)
 */
function isValidObjectId(id) {
  if (!id) return false;
  // Kiểm tra format ObjectId và không phải temp ID
  return mongoose.Types.ObjectId.isValid(id) && !id.toString().startsWith('temp_');
}

/**
 * 💾 Controller: Lưu nháp campaign/adset/ad
 * POST /api/ads-wizard/save-draft
 */
export async function saveDraftController(req, res) {
  try {
    const { ad_account_id, campaigns } = req.body;
    
    if (!ad_account_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ad_account_id"
      });
    }
    
    if (!campaigns || campaigns.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Thiếu dữ liệu campaigns"
      });
    }

    // Kiểm tra quyền sở hữu tài khoản quảng cáo
    const account = await AdsAccount.findOne({
      external_id: ad_account_id,
      $or: [
        { user: req.user._id },
        { shop_admin_id: req.user._id },
        { shop_user_id: req.user._id },
      ],
    });

    if (!account) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản quảng cáo không thuộc quyền sở hữu của bạn.",
      });
    }

    const savedItems = {
      campaigns: [],
      adsets: [],
      ads: [],
      creatives: []
    };

    // Lưu từng campaign
    for (const campaignData of campaigns) {
      // ✅ Tạo hoặc update Campaign draft (check ObjectId hợp lệ)
      const campaignDoc = isValidObjectId(campaignData._id)
        ? await AdsCampaign.findByIdAndUpdate(
            campaignData._id,
            {
              name: campaignData.name,
              objective: campaignData.objective,
              status: 'DRAFT',
              daily_budget: campaignData.daily_budget,
              lifetime_budget: campaignData.lifetime_budget,
              external_account_id: ad_account_id,
              // ✅ XÓA page_id và page_name từ campaign (đã di chuyển sang adset)
              // page_id: campaignData.facebookPageId,
              // page_name: campaignData.facebookPage,
              updated_at: new Date()
            },
            { new: true }
          )
        :             await AdsCampaign.create({
              name: campaignData.name,
              objective: campaignData.objective,
              status: 'DRAFT',
              daily_budget: campaignData.daily_budget,
              lifetime_budget: campaignData.lifetime_budget,
              external_account_id: ad_account_id,
              // ✅ XÓA page_id và page_name từ campaign (đã di chuyển sang adset)
              // page_id: campaignData.facebookPageId,
              // page_name: campaignData.facebookPage,
              account_id: account._id,
              shop_id: account.shop_id,
              created_by: req.user._id,
            });

      savedItems.campaigns.push(campaignDoc);

      // Lưu AdSets nếu có
      if (campaignData.adsets && campaignData.adsets.length > 0) {
        for (const adsetData of campaignData.adsets) {
          // ✅ Tạo hoặc update AdSet draft (check ObjectId hợp lệ)
          const adsetDoc = isValidObjectId(adsetData._id)
            ? await AdsSet.findByIdAndUpdate(
                adsetData._id,
                {
                  name: adsetData.name,
                  status: 'DRAFT',
                  campaign_id: campaignDoc._id,
                  daily_budget: adsetData.budgetAmount,
                  targeting: adsetData.targeting,
                  optimization_goal: adsetData.optimization_goal,
                  billing_event: adsetData.billing_event,
                  bid_strategy: adsetData.bid_strategy,
                  // ✅ THÊM page_id và page_name từ adset (đã di chuyển từ campaign)
                  ...(adsetData.facebookPageId && { page_id: adsetData.facebookPageId }),
                  ...(adsetData.facebookPage && { page_name: adsetData.facebookPage }),
                  updated_at: new Date()
                },
                { new: true }
              )
            : await AdsSet.create({
                name: adsetData.name,
                status: 'DRAFT',
                campaign_id: campaignDoc._id,
                external_account_id: ad_account_id,
                daily_budget: adsetData.budgetAmount,
                targeting: adsetData.targeting,
                optimization_goal: adsetData.optimization_goal,
                billing_event: adsetData.billing_event,
                bid_strategy: adsetData.bid_strategy,
                // ✅ THÊM page_id và page_name từ adset (đã di chuyển từ campaign)
                ...(adsetData.facebookPageId && { page_id: adsetData.facebookPageId }),
                ...(adsetData.facebookPage && { page_name: adsetData.facebookPage }),
                created_by: req.user._id, 
              });

          savedItems.adsets.push(adsetDoc);

          // Lưu Ads nếu có
          if (adsetData.ads && adsetData.ads.length > 0) {
            for (const adData of adsetData.ads) {
              // ✅ Tạo hoặc update Ad draft (check ObjectId hợp lệ)
              const adDoc = isValidObjectId(adData._id)
                ? await Ads.findByIdAndUpdate(
                    adData._id,
                    {
                      name: adData.name,
                      status: 'DRAFT',
                      set_id: adsetDoc._id,
                      updated_at: new Date()
                    },
                    { new: true }
                  )
                : await Ads.create({
                    name: adData.name,
                    status: 'DRAFT',
                    set_id: adsetDoc._id,
                    external_account_id: ad_account_id,
                    created_by: req.user._id,
                  });

              savedItems.ads.push(adDoc);

              // ✅ Lưu Creative nếu có dữ liệu creative
              if (adData.primaryText || adData.headline || adData.mediaUrl || adData.destinationUrl) {
                try {
                  // Kiểm tra xem đã có creative cho ad này chưa
                  let creativeDoc = await Creative.findOne({ ads_id: adDoc._id });
                  
                  const creativeData = {
                    name: adData.name + ' Creative',
                    ads_id: adDoc._id,
                    // ✅ LẤY page_id TỪ ADSET THAY VÌ CAMPAIGN
                    page_id: adsetData.facebookPageId || campaignData.facebookPageId,
                    object_story_spec: {
                      page_id: adsetData.facebookPageId || campaignData.facebookPageId,
                      link_data: {
                        message: adData.primaryText || '',
                        link: adData.destinationUrl || 'https://fchat.vn',
                        name: adData.headline || '',
                        description: adData.description || '',
                        call_to_action: {
                          type: convertCTAToFacebookType(adData.cta),
                        },
                        ...(adData.mediaUrl && { picture: adData.mediaUrl }),
                      },
                    },
                  };

                  if (creativeDoc) {
                    // Update creative hiện có
                    creativeDoc = await Creative.findByIdAndUpdate(
                      creativeDoc._id,
                      creativeData,
                      { new: true }
                    );
                  } else {
                    // Tạo mới creative
                    creativeDoc = await Creative.create(creativeData);
                  }

                  savedItems.creatives.push(creativeDoc);
                } catch (creativeError) {
                  console.error('⚠️ Lỗi khi lưu creative:', creativeError);
                  // Không throw error, tiếp tục lưu ad khác
                }
              }
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Đã lưu nháp thành công',
      data: savedItems
    });

  } catch (error) {
    console.error('❌ Lỗi lưu draft:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lưu nháp',
      error: error.message
    });
  }
}
