import express from "express";
import {
  listAnalyticsSnapshotsCtrl,
  syncAnalyticsSnapshotsCtrl,
} from "../../controllers/analytics/analyticsSnapshot.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// GET /api/analytics/snapshots - List analytics snapshots
router.get("/snapshots", authenticate, listAnalyticsSnapshotsCtrl);

// POST /api/analytics/snapshots/sync - Trigger manual sync
router.post("/snapshots/sync", authenticate, syncAnalyticsSnapshotsCtrl);

export default router;
