import express from "express";
import { getCustomerLogs } from "../controllers/logController.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

// 🛡️ Yêu cầu xác thực
router.use(authenticate);

// 📋 Log routes
router.get("/customers", getCustomerLogs); // Lấy danh sách customer logs

export default router;

