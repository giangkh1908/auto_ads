import express from "express";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { syncEntitiesForAccount } from "../services/entitySyncService.js";
import { startBackfill } from "../services/backfillService.js";
import User from "../models/user.model.js";

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

    await syncEntitiesForAccount(accountId, accessToken);

    return res.json({ success: true });
  } catch (err) {
    console.error("[sync/entities] Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to trigger entity sync",
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


