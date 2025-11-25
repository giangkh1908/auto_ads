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
import { adminActionLogger } from "../../middlewares/adminActionLogger.middleware.js";

const router = express.Router();

// Route công khai - không cần authenticate (user tạo transaction)
router.post("/", createPaymentTransaction);

// Routes admin (cần authenticate và log)
router.use(authenticate);
router.use(adminActionLogger); // Log admin actions
router.get("/", getPaymentTransactions);
router.get("/:id", getPaymentTransactionById);
router.put("/:id", updatePaymentTransaction);
router.patch("/:id/set-method", setPaymentMethod);
router.patch("/:id/confirm-transfer", confirmBankTransfer);
router.delete("/:id", deletePaymentTransaction);

export default router;