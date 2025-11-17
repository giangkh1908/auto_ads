import express from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireFeature, FEATURE_KEYS } from '../../middlewares/featureGate.middleware.js';
import { 
  suggestKeywords, 
  confirmContext, 
  generateText, 
  generateImages,
  createAIConfig,
  getAIConfigs,
  getAIConfig,
  updateAIConfig,
  deleteAIConfig,
  setDefaultAIConfig,
  previewAIConfigPrompt
} from '../../controllers/ai/aiControllers.js';

const router = express.Router();

// Tất cả các routes đều yêu cầu xác thực và quyền sử dụng Content AI
router.use(authenticate);
router.use(requireFeature(FEATURE_KEYS.CONTENT_AI));

// Suggest keywords route
router.post('/keywords/suggest', suggestKeywords);

// Confirm context route
router.post('/context/confirm', confirmContext);

// Generate text route
router.post('/generate-text', generateText);

// Generate images route
router.post('/images/generate', generateImages);

// AI Config routes
router.post('/configs', createAIConfig);
router.get('/configs', getAIConfigs);
router.get('/configs/:id', getAIConfig);
router.get('/configs/:id/preview-prompt', previewAIConfigPrompt);
router.put('/configs/:id', updateAIConfig);
router.delete('/configs/:id', deleteAIConfig);
router.post('/configs/:id/set-default', setDefaultAIConfig);

export default router;