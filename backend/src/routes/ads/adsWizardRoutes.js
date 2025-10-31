// routes/ads/adsWizardRoutes.js
import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { 
  publishAdsWizard, 
  updateAdsWizard,
  publishCampaignController,
  publishAdsetController,
  publishAdController,
  publishFlexibleController,
  updateFlexibleController,
  saveDraftController,
} from "../../controllers/ads/adsWizard.controller.js";

const router = Router();

// Original routes (giữ nguyên để tương thích)
router.post("/publish", authenticate, publishAdsWizard);
router.put("/update", authenticate, updateAdsWizard);

// New flexible routes - Publish
router.post("/publish-campaign", authenticate, publishCampaignController);
router.post("/publish-adset", authenticate, publishAdsetController);
router.post("/publish-ad", authenticate, publishAdController);
router.post("/publish-flexible", authenticate, publishFlexibleController);

// New flexible routes - Update
router.put("/update-flexible", authenticate, updateFlexibleController);

// Save Draft route
router.post("/save-draft", authenticate, saveDraftController);

export default router;
