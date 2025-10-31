import express from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/userControllers.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// 🛡️ Yêu cầu xác thực + quyền quản lý user
router.use(authenticate);

// 📋 CRUD user
router.get("/", authorize("user", "view"), getUsers);
router.get("/:id", authorize("user", "view"), getUserById);
router.post("/", authorize("user", "create"), createUser);
router.put("/:id", authorize("user", "update"), updateUser);
router.delete("/:id", authorize("user", "delete"), deleteUser);

export default router;
