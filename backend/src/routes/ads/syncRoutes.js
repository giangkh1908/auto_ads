import express from "express";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import { syncEntitiesForAccount } from "../../services/ads/entitySyncService.js";
import { syncInsightsForAccount } from "../../services/ads/insightsSyncService.js";
import { startBackfill } from "../../services/ads/backfillService.js";
import User from "../../models/user/user.model.js";

const router = express.Router();

router.post("/entities", async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ message: "accountId is required" });
    }

    const account = await AdsAccount.findOne({ external_id: accountId });
    
    if (!account) {
      console.error(`[sync/entities] AdsAccount not found: ${accountId}`);
      return res.status(404).json({ message: "AdsAccount not found" });
    }

    if (!account.shop_admin_id) {
      console.error(`[sync/entities] Account ${accountId} has no shop_admin_id`);
      return res.status(400).json({ 
        message: "Account has no shop_admin_id. Please reconnect your Facebook account." 
      });
    }

    const user = await User.findById(account.shop_admin_id).select("+facebookAccessToken");
    
    if (!user) {
      console.error(`[sync/entities] User not found: ${account.shop_admin_id}`);
      return res.status(400).json({ 
        message: "User not found for this account. Please reconnect your Facebook account." 
      });
    }

    const accessToken = user.facebookAccessToken;
    
    if (!accessToken) {
      console.error(`[sync/entities] User ${account.shop_admin_id} has no facebookAccessToken`);
      return res.status(400).json({ 
        message: "Missing Facebook access token for account. Please reconnect your Facebook account." 
      });
    }

    if (account.sync_metadata?.entities_status === "syncing") {
      return res.status(409).json({
        success: false,
        message: "Đang đồng bộ dữ liệu. Vui lòng chờ hoàn tất trước khi đồng bộ lại.",
        alreadySyncing: true,
      });
    }

    await syncEntitiesForAccount(accountId, accessToken);

    return res.json({ success: true });
  } catch (err) {
    console.error("[sync/entities] Error:", err);
    console.error("[sync/entities] Error details:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      errorCode: err.response?.data?.error?.code,
      errorType: err.response?.data?.error?.type,
      errorMessage: err.response?.data?.error?.message,
    });

    const fbError = err.response?.data?.error;

    if (fbError?.code === 190) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
        error: fbError.message || err.message,
        tokenExpired: true,
      });
    }

    if (fbError?.code === 10) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập quảng cáo. Vui lòng cấp thêm quyền.",
        error: fbError.message || err.message,
        permissionDenied: true,
      });
    }

    if (fbError?.code === 17 || fbError?.code === 4) {
      return res.status(429).json({
        success: false,
        message: fbError?.error_user_msg || "Đã vượt quá giới hạn số lượng request. Vui lòng chờ một chút và thử lại.",
        error: fbError?.message || err.message,
        rateLimitReached: true,
        fbErrorCode: fbError?.code,
        fbErrorType: fbError?.type,
        retryAfter: fbError?.error_subcode === 2446079 ? 60 : 30,
      });
    }

    if (fbError?.code === 100) {
      return res.status(400).json({
        success: false,
        message: "Tham số không hợp lệ. Vui lòng kiểm tra lại account ID.",
        error: fbError.message || err.message,
        invalidParameter: true,
      });
    }

    if (err.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: fbError?.error_user_msg || fbError?.message || "Lỗi từ Facebook API",
        error: fbError?.message || err.message,
        fbErrorCode: fbError?.code,
        fbErrorType: fbError?.type,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to trigger entity sync",
      error: fbError?.message || err.message,
      fbErrorCode: fbError?.code,
    });
  }
});

router.post("/insights", async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ message: "accountId is required" });
    }

    const account = await AdsAccount.findOne({ external_id: accountId });
    
    if (!account) {
      console.error(`[sync/insights] AdsAccount not found: ${accountId}`);
      return res.status(404).json({ message: "AdsAccount not found" });
    }

    if (account.sync_metadata?.insights_status === "syncing") {
      return res.status(409).json({
        success: false,
        message: "Đang đồng bộ insights. Vui lòng chờ hoàn tất.",
        alreadySyncing: true,
      });
    }

    console.log(`[sync/insights] Manual trigger for account ${accountId}`);
    await syncInsightsForAccount(account._id);

    return res.json({ 
      success: true,
      message: "Insights sync completed"
    });
  } catch (err) {
    console.error("[sync/insights] Error:", err);
    
    const fbError = err.response?.data?.error;
    
    if (fbError?.code === 17 || fbError?.code === 4) {
      return res.status(429).json({
        success: false,
        message: "Rate limit exceeded. Please wait and try again.",
        rateLimitReached: true,
        retryAfter: 60,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to sync insights",
      error: err.message,
    });
  }
});

router.post("/full", async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ message: "accountId is required" });
    }

    const account = await AdsAccount.findOne({ external_id: accountId });
    
    if (!account) {
      return res.status(404).json({ message: "AdsAccount not found" });
    }

    if (!account.shop_admin_id) {
      return res.status(400).json({ 
        message: "Account has no shop_admin_id. Please reconnect your Facebook account." 
      });
    }

    const user = await User.findById(account.shop_admin_id).select("+facebookAccessToken");
    
    if (!user?.facebookAccessToken) {
      return res.status(400).json({ 
        message: "Missing Facebook access token. Please reconnect your Facebook account." 
      });
    }

    console.log(`[sync/full] Manual FULL sync for account ${accountId}`);
    
    await syncEntitiesForAccount(accountId, user.facebookAccessToken);
    console.log(`[sync/full] Entity sync completed for ${accountId}`);
    
    await syncInsightsForAccount(account._id);
    console.log(`[sync/full] Insights sync completed for ${accountId}`);

    return res.json({ 
      success: true,
      message: "Full sync (entities + insights) completed"
    });
  } catch (err) {
    console.error("[sync/full] Error:", err);
    
    return res.status(500).json({
      success: false,
      message: "Failed to complete full sync",
      error: err.message,
    });
  }
});

router.get("/status/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;
    const account = await AdsAccount.findOne({ external_id: accountId });
    if (!account) {
      return res.status(404).json({ message: "AdsAccount not found" });
    }

    const sync = account.sync_metadata || {};

    return res.json({
      entities: sync.entities_status || "idle",
      insights: sync.insights_status || "idle",
      backfill: sync.backfill_status || "idle",
      backfill_progress_percent: sync.backfill_progress_percent || 0,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to get sync status",
      error: err.message,
    });
  }
});

router.post("/backfill", async (req, res) => {
  try {
    const { accountId, startDate, endDate } = req.body;
    if (!accountId || !startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "accountId, startDate and endDate are required" });
    }

    await startBackfill(accountId, startDate, endDate);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to start backfill",
      error: err.message,
    });
  }
});

export default router;


