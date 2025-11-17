import express from "express";
import {
  chatAnalyze,
} from "../../controllers/ai/chatController.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  FEATURE_KEYS,
  requireFeature,
} from "../../middlewares/featureGate.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post(
  "/analyze",
  requireFeature(FEATURE_KEYS.ANALYTICS_CHAT_AI),
  chatAnalyze
);

export default router;
