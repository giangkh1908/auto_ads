import express from "express";
import {
  chatAnalyze,
} from "../../controllers/ai/chatController.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post("/analyze", chatAnalyze);

export default router;
