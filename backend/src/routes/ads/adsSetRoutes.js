// src/routes/ads/adsSetRoutes.js
import express from "express";
import {
  listAdSetsCtrl,
  syncAdSetsCtrl,
  getAdSetsLiveCtrl,
  toggleAdsetStatusCtrl,
  deleteAdsetCascadeCtrl,
  getAdsetFromDatabase,
  copyAdsetCascadeCtrl,
  getAdsetInsightsCtrl,
} from "../../controllers/ads/adsSet.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Đặt các routes cụ thể TRƯỚC route có tham số /:id
router.get("/live", getAdSetsLiveCtrl);
router.get("/database", getAdsetFromDatabase);
router.get("/sync", syncAdSetsCtrl);
router.get("/insights", getAdsetInsightsCtrl);
router.get("/", listAdSetsCtrl);

// Routes với tham số động
router.post("/:id/copy", copyAdsetCascadeCtrl);
router.patch("/:id/status", toggleAdsetStatusCtrl);
router.delete("/:id", deleteAdsetCascadeCtrl);

export default router;
