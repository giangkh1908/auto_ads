import express from 'express';
import { searchAdLocations, getPopularVietnamLocations } from '../../services/ads/locationService.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/location/search
 * Search for ad locations using Facebook Marketing API
 * Query params:
 *   - q: Search query (required)
 *   - types: Comma-separated location types (optional, default: 'city,region')
 *   - ad_account_id: Facebook Ad Account ID (required)
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q: query, types, ad_account_id } = req.query;

    // Validate required parameters
    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required',
      });
    }

    if (!ad_account_id) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "ad_account_id" is required',
      });
    }

    // Get access token from user (same as other ads controllers)
    const User = (await import('../../models/user/user.model.js')).default;
    const user = await User.findById(req.user._id).select('+facebookAccessToken');
    const accessToken = user?.facebookAccessToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Facebook access token not found. Please login again.',
      });
    }

    // Verify ads account exists (optional check)
    const AdsAccount = (await import('../../models/ads/adsAccount.model.js')).default;
    const adsAccount = await AdsAccount.findOne({
      external_id: ad_account_id.includes('act_') ? ad_account_id : `act_${ad_account_id}`,
    });

    if (!adsAccount) {
      console.warn('⚠️ Ad Account not found:', ad_account_id);
      // Don't block the request, just log warning
    }

    // Parse location types
    const locationTypes = types
      ? types.split(',').map(t => t.trim()).filter(Boolean)
      : ['city', 'region'];

    // Validate location types
    const validTypes = ['city', 'region', 'district', 'locality', 'country', 'zip'];
    const invalidTypes = locationTypes.filter(t => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid location types: ${invalidTypes.join(', ')}. Valid types: ${validTypes.join(', ')}`,
      });
    }

    // Search locations using user's access token
    const locations = await searchAdLocations(query, locationTypes, accessToken);

    return res.status(200).json({
      success: true,
      data: locations,
      count: locations.length,
    });
  } catch (error) {
    console.error('❌ Location search error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to search locations',
    });
  }
});

/**
 * GET /api/location/popular
 * Get popular Vietnam locations (pre-defined list)
 */
router.get('/popular', authenticate, async (req, res) => {
  try {
    const locations = getPopularVietnamLocations();

    return res.status(200).json({
      success: true,
      data: locations,
      count: locations.length,
    });
  } catch (error) {
    console.error('❌ Popular locations error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get popular locations',
    });
  }
});

export default router;

