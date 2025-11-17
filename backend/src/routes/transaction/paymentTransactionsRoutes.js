import express from "express";
import {
  createPaymentTransaction,
  getPaymentTransactions,
  getPaymentTransactionById,
  updatePaymentTransaction,
  deletePaymentTransaction,
  setPaymentMethod,
  confirmBankTransfer
} from "../../controllers/transaction/paymentTransactionControllers.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Tạo mới giao dịch
router.post("/", createPaymentTransaction);

// Lấy danh sách giao dịch
router.get("/", getPaymentTransactions);

// Lấy chi tiết theo ID
router.get("/:id", getPaymentTransactionById);

// Cập nhật
router.put("/:id", updatePaymentTransaction);

router.patch("/:id/set-method", authenticate, setPaymentMethod),

router.patch("/:id/confirm-transfer", authenticate, confirmBankTransfer),

// Xóa (soft delete)
router.delete("/:id", deletePaymentTransaction);

export default router;