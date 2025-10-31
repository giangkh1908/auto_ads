// src/routes/ads/adsRoutes.js
import express from "express";
import { listAdsCtrl, syncAdsCtrl, getAdsLiveCtrl, toggleAdStatusCtrl, deleteAdCtrl, getAdFromDatabase, getAdsInsightsCtrl, copyAdCtrl } from "../../controllers/ads/ads.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Thêm route đặc biệt để xử lý yêu cầu cũ đến /count
router.get("/count", (req, res) => {
  return res.status(200).json({ count: 0 });
});

// NEW: lấy ads trực tiếp từ Facebook
router.get("/live", getAdsLiveCtrl);
// Insights
router.get("/insights", getAdsInsightsCtrl);
// Database endpoints
router.get("/database", getAdFromDatabase);
router.post("/:id/copy", copyAdCtrl);
// Đồng bộ ads từ Facebook
router.get("/sync", syncAdsCtrl);

// List ads
router.get("/", listAdsCtrl);
router.patch("/:id/status", toggleAdStatusCtrl);
router.delete("/:id", deleteAdCtrl);

export default router;
