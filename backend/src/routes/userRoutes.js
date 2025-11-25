import express from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  createInternalStaff,
  getCustomers,
  getUserShops,
  getInternalStaff,
} from "../controllers/userControllers.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { adminActionLogger } from "../middlewares/adminActionLogger.middleware.js";

const router = express.Router();

// 🛡️ Yêu cầu xác thực + quyền quản lý user
router.use(authenticate);
router.use(adminActionLogger); // Log admin actions

// 📋 CRUD user
router.get("/", authorize("user", "view"), getUsers);
router.get("/customers", getCustomers); // Lấy danh sách customers (users không có internal_role)
router.get("/internal-staff", getInternalStaff); // Lấy danh sách internal staff (users có internal_role)
router.get("/:id/shops", getUserShops); // Lấy danh sách shop và role của user
router.get("/:id", authorize("user", "view"), getUserById);
router.post("/", authorize("user", "create"), createUser);
router.put("/:id", updateUser); // Kiểm tra quyền trong controller (cho phép System Admin bypass)
router.delete("/:id", authorize("user", "delete"), deleteUser);

// 👥 Tạo nhân viên nội bộ (chỉ System Admin, kiểm tra trong controller)
router.post("/internal", createInternalStaff);

export default router;
