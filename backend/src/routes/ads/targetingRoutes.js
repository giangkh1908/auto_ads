import express from 'express';
import { searchTargeting, getTargetingSuggestions } from '../../services/ads/targetingSearchService.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/targeting/search
 * Search for targeting options (interests, behaviors, demographics)
 * Query params:
 *   - q: Search query (required)
 *   - types: Comma-separated targeting types (optional, default: 'interest')
 *            Valid types: interest, behavior, demographic
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q: query, types } = req.query;

    // Validate required parameters
    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required',
      });
    }

    // Get access token from user
    const User = (await import('../../models/user/user.model.js')).default;
    const user = await User.findById(req.user._id).select('+facebookAccessToken');
    const accessToken = user?.facebookAccessToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Facebook access token not found. Please login again.',
      });
    }

    // Parse targeting types
    const targetingTypes = types
      ? types.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      : ['interest'];

    // Validate targeting types
    const validTypes = ['interest', 'behavior', 'demographic'];
    const invalidTypes = targetingTypes.filter(t => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid targeting types: ${invalidTypes.join(', ')}. Valid types: ${validTypes.join(', ')}`,
      });
    }

    // Search targeting options
    const results = await searchTargeting(query, targetingTypes, accessToken);

    return res.status(200).json({
      success: true,
      data: results,
      count: results.length,
    });

  } catch (error) {
    console.error('❌ Targeting search error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to search targeting options',
    });
  }
});

/**
 * GET /api/targeting/suggestions
 * Get popular targeting suggestions (browse mode)
 * Query params:
 *   - types: Comma-separated targeting types (optional, default: 'interest')
 */
router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const { types } = req.query;

    // Get access token from user
    const User = (await import('../../models/user/user.model.js')).default;
    const user = await User.findById(req.user._id).select('+facebookAccessToken');
    const accessToken = user?.facebookAccessToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Facebook access token not found. Please login again.',
      });
    }

    // Parse targeting types
    const targetingTypes = types
      ? types.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      : ['interest'];

    // Get suggestions
    const suggestions = await getTargetingSuggestions(targetingTypes, accessToken);

    return res.status(200).json({
      success: true,
      data: suggestions,
      count: suggestions.length,
    });

  } catch (error) {
    console.error('❌ Targeting suggestions error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get targeting suggestions',
    });
  }
});

export default router;

