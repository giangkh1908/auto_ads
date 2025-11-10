import express from "express";
import {
  chatAnalyze,
  getModules,
} from "../../controllers/ai/chatController.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/modules", getModules);
router.post("/analyze", chatAnalyze);

export default router;
