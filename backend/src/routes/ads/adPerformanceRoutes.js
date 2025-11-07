import express from "express";
import { 
  getAdPerformance, 
  refreshAdPerformance,
  getAdPerformanceStats 
} from "../../controllers/ads/adPerformance.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authenticate, getAdPerformance);
router.post("/refresh", authenticate, refreshAdPerformance);
router.get("/stats", authenticate, getAdPerformanceStats);

export default router;