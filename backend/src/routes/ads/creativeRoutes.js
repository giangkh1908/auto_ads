// routes/ads/creativeRoutes.js
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { getCreativeFromDatabase, listCreativesCtrl } from "../../controllers/ads/creative.controller.js";

const router = Router();

// Database endpoints
router.get("/database", authenticate, getCreativeFromDatabase);

// List endpoints
router.get("/", authenticate, listCreativesCtrl);

export default router;
