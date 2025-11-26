import express from "express";
import AdsAccount from "../models/ads/adsAccount.model.js";
import { syncEntitiesForAccount } from "../services/entitySyncService.js";
import { startBackfill } from "../services/backfillService.js";

const router = express.Router();

router.post("/entities", async (req, res) => {
  try {
    const { accountId, accessToken } = req.body;
    if (!accountId) {
      return res.status(400).json({ message: "accountId is required" });
    }

    if (!accessToken) {
      return res.status(400).json({ message: "accessToken is required" });
    }

    await syncEntitiesForAccount(accountId, accessToken);

    return res.json({ success: true });
  } catch (err) {
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


