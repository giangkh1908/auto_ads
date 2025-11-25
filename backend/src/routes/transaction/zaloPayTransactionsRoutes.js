import express from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { createZaloPayOrder, zaloPayCallback } from '../../controllers/transaction/zaloPayTransactionControllers.js';

const router = express.Router();

// Tạo order ZaloPay (FE gọi)
router.post('/:orderId/create', authenticate, createZaloPayOrder);

// Callback từ ZaloPay (public, GET)
router.get('/callback', zaloPayCallback);

export default router;