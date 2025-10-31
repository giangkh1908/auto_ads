import express from "express";
import {
  assignRole,
  getUserRoles,
  getUserRoleById,
  getRolesByUser,
  updateUserRole,
  deleteUserRole,
} from "../controllers/userRoleControllers.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

//  Chỉ cho phép người có quyền role/userRole
router.use(authenticate);

//  Gán và quản lý role
router.get("/", authorize("userRole", "view"), getUserRoles);
router.get("/:id", authorize("userRole", "view"), getUserRoleById);
router.get("/user/:userId", authorize("userRole", "view"), getRolesByUser);
router.post("/", authorize("userRole", "assign"), assignRole);
router.put("/:id", authorize("userRole", "update"), updateUserRole);
router.delete("/:id", authorize("userRole", "delete"), deleteUserRole);

export default router;
