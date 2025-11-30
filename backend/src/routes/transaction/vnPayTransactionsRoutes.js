import express from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { createVnpayPayment, vnpayReturn } from "../../controllers/transaction/vnPayTransactionControllers.js";

const router = express.Router();

router.post("/:orderId/create", authenticate, createVnpayPayment);
router.get("/return", vnpayReturn); // Public

export default router;