import express from 'express';
import { authenticate, authenticateSSE } from '../../middlewares/auth.middleware.js';
import { 
  suggestKeywords, 
  confirmContext, 
  generateText, 
  generateImages 
} from '../../controllers/ai/aiControllers.js';

const router = express.Router();

// Tất cả các routes đều yêu cầu xác thực
router.use(authenticate);

// Suggest keywords route
router.post('/keywords/suggest', suggestKeywords);

// Confirm context route
router.post('/context/confirm', confirmContext);

// Generate text route
router.post('/generate-text', generateText);

// Generate images route
router.post('/images/generate', generateImages);

export default router;