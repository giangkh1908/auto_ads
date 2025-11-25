import express from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { createVnpayPayment, vnpayReturn, queryVnpayTransaction } from "../../controllers/transaction/vnPayTransactionControllers.js";

const router = express.Router();

router.post("/:orderId/create", authenticate, createVnpayPayment);
router.get("/return", vnpayReturn); // Public
router.get("/query-test", async (req, res) => {
  const result = await queryVnpayTransaction("n2cu8Vwlhc", "20251123150809");
  res.json(result);
});

export default router;