import express from "express";
import { getCustomerLogs } from "../../controllers/admin/logController.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// 🛡️ Yêu cầu xác thực
router.use(authenticate);

// 📋 Log routes
router.get("/customers", (req, res) => {
    const { limit, lastLogId } = req.query; // Accept limit and lastLogId as query parameters
    getCustomerLogs(req, res, limit, lastLogId); // Pass them to the controller
}); // Lấy danh sách customer logs

export default router;
