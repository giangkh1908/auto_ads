import express from "express";
import {
  getInvoiceByTransactionId,
  getInvoiceById,
} from "../../controllers/invoice/invoiceControllers.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Tất cả routes đều cần authenticate
router.use(authenticate);

// GET /api/invoices/transaction/:transactionId - Lấy invoice theo transaction
router.get("/transaction/:transactionId", getInvoiceByTransactionId);

// GET /api/invoices/:id - Lấy invoice theo ID
router.get("/:id", getInvoiceById);

export default router;

