import express from "express";
import {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  updateRolePermissions,
  checkRolePermission,
} from "../../controllers/admin/roleControllers.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// 🛡️ Bảo vệ route
router.use(authenticate);

// 📋 CRUD Role
router.get("/", authorize("role", "view"), getRoles);
router.get("/:id", authorize("role", "view"), getRoleById);
router.post("/", authorize("role", "create"), createRole);
router.put("/:id", authorize("role", "update"), updateRole);
router.delete("/:id", authorize("role", "delete"), deleteRole);

// ⚙️ Permission trong Role
router.put("/:id/permissions", authorize("role", "update"), updateRolePermissions);
router.get("/:id/check", authorize("role", "view"), checkRolePermission);

export default router;
