import express from "express";
import {
  listCampaignsCtrl,
  getCampaignCtrl,
  syncCampaignsCtrl,
  getCampaignsLiveCtrl,
  toggleCampaignStatusCtrl,
  deleteCampaignCascadeCtrl,
  getCampaignFromDatabase,
  copyCampaignCascadeCtrl,
  getCampaignInsightsCtrl,
} from "../../controllers/ads/adsCampaign.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// QUAN TRỌNG: Thêm route đặc biệt để xử lý yêu cầu cũ đến /count
router.get("/count", (req, res) => {
  // Trả về 0 để đảm bảo không gây lỗi cho frontend
  return res.status(200).json({ count: 0 });
});

// Đặt các routes cụ thể TRƯỚC route có tham số /:id
router.get("/live", getCampaignsLiveCtrl);
router.get("/database", getCampaignFromDatabase);
router.get("/sync", syncCampaignsCtrl);
router.get("/insights", getCampaignInsightsCtrl);
router.get("/", listCampaignsCtrl);

// Routes với tham số động
router.post("/:id/copy", copyCampaignCascadeCtrl);
router.patch("/:id/status", toggleCampaignStatusCtrl);
router.get("/:id", getCampaignCtrl);
router.delete("/:id", deleteCampaignCascadeCtrl);

export default router;