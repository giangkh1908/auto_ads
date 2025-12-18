import express from "express";
import {
  getAutomationRules,
  getAutomationRuleById,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  toggleAutomationRule,
} from "../../controllers/auto/automationRule.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  FEATURE_KEYS,
  requireFeature,
} from "../../middlewares/featureGate.middleware.js";

const router = express.Router();

// Tất cả routes đều yêu cầu authentication
router.use(authenticate);
router.use(requireFeature(FEATURE_KEYS.ADS_AUTO_RUN));

// GET /api/automation-rules - Lấy danh sách rules
router.get("/", getAutomationRules);

// GET /api/automation-rules/:id - Lấy chi tiết rule
router.get("/:id", getAutomationRuleById);

// POST /api/automation-rules - Tạo rule mới
router.post("/", createAutomationRule);

// PUT /api/automation-rules/:id - Cập nhật rule
router.put("/:id", updateAutomationRule);

// DELETE /api/automation-rules/:id - Xóa rule
router.delete("/:id", deleteAutomationRule);

// PATCH /api/automation-rules/:id/toggle - Bật/tắt rule
router.patch("/:id/toggle", toggleAutomationRule);

export default router;

