// backend/src/routes/systemLogRoutes.js
import express from 'express';
import { getSystemLogs } from '../controllers/systemLogController.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Yêu cầu xác thực
router.use(authenticate);

// System Log routes
router.get('/', getSystemLogs);

export default router;
