import express from 'express';
import { createCheckoutSession,
  stripeWebhook,
} from '../../controllers/transaction/stripeTransactionControllers.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Tạo Checkout Session (bảo vệ bằng auth)
router.post('/:orderId/create-checkout-session', authenticate, createCheckoutSession);

// Webhook (không cần auth, Stripe gọi)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

export default router;