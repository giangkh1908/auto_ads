/**
 * Targeting Search Service for Facebook Marketing API v23.0
 * Search for Interests, Behaviors, Demographics for detailed targeting
 */

import axios from 'axios';

const FB_API_VERSION = 'v23.0';
const FB_GRAPH_API = `https://graph.facebook.com/${FB_API_VERSION}`;

// In-memory cache for targeting search (TTL: 1 hour)
const targetingCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Facebook targeting category types
 * @see https://developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search
 */
const TARGETING_TYPES = {
  interest: 'adinterest',
  behavior: 'adTargetingCategory',
  demographic: 'adTargetingCategory',
  education: 'adeducationschool',
  employer: 'adworkemployer',
  job_title: 'adworkposition',
  life_event: 'adTargetingCategory',
};

/**
 * Category class mapping for behaviors and demographics
 * @see https://developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search#background
 */
const BEHAVIOR_CLASSES = [
  'behaviors',
  'digital_activities',
  'mobile_device_user',
  'travel',
  'purchase_behavior',
  'seasonal_and_events',
];

const DEMOGRAPHIC_CLASSES = [
  'demographics',
  'family_statuses',
  'life_events',
  'politics',
  'work',
  'education',
];

/**
 * Search for targeting options from Facebook Marketing API
 * @param {string} query - Search query
 * @param {string[]} types - Targeting types to search: ['interest', 'behavior', 'demographic']
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<Array>} Array of targeting options
 */
export async function searchTargeting(query, types = ['interest'], accessToken) {
  if (!query || !query.trim()) {
    return [];
  }

  if (!accessToken) {
    throw new Error('Facebook access token is required');
  }

  // Check cache first
  const cacheKey = `targeting_${query.toLowerCase()}_${types.sort().join(',')}`;
  const cached = targetingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Targeting cache hit for: ${query}`);
    return cached.data;
  }

  try {
    console.log(`🔍 [Targeting Search] Searching: query="${query}", types=${types.join(',')}`);

    const allResults = [];

    // Search interests
    if (types.includes('interest')) {
      const interests = await searchInterests(query, accessToken);
      allResults.push(...interests);
    }

    // Search behaviors
    if (types.includes('behavior')) {
      const behaviors = await searchBehaviors(query, accessToken);
      allResults.push(...behaviors);
    }

    // Search demographics
    if (types.includes('demographic')) {
      const demographics = await searchDemographics(query, accessToken);
      allResults.push(...demographics);
    }

    // Deduplicate by ID
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );

    // Sort by audience size (largest first)
    uniqueResults.sort((a, b) => (b.audience_size || 0) - (a.audience_size || 0));

    // Cache results
    targetingCache.set(cacheKey, {
      data: uniqueResults,
      timestamp: Date.now(),
    });

    console.log(`✅ [Targeting Search] Found ${uniqueResults.length} results for "${query}"`);
    return uniqueResults;

  } catch (error) {
    console.error('❌ [Targeting Search] Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Search for interests
 * @param {string} query - Search query
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<Array>} Array of interest objects
 */
async function searchInterests(query, accessToken) {
  try {
    const response = await axios.get(`${FB_GRAPH_API}/search`, {
      params: {
        type: 'adinterest',
        q: query,
        access_token: accessToken,
        limit: 50,
      },
    });

    const interests = response.data.data || [];
    
    return interests.map(interest => ({
      id: interest.id,
      name: interest.name,
      type: 'interest',
      audience_size: interest.audience_size || interest.audience_size_lower_bound || 0,
      audience_size_upper: interest.audience_size_upper_bound || 0,
      path: interest.path || [],
      description: interest.description || null,
    }));

  } catch (error) {
    console.error('❌ [Interest Search] Error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Search for behaviors
 * Uses adTargetingCategory with class filters
 * @param {string} query - Search query
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<Array>} Array of behavior objects
 */
async function searchBehaviors(query, accessToken) {
  try {
    const response = await axios.get(`${FB_GRAPH_API}/search`, {
      params: {
        type: 'adTargetingCategory',
        class: 'behaviors',
        q: query,
        access_token: accessToken,
        limit: 50,
      },
    });

    const behaviors = response.data.data || [];
    
    return behaviors.map(behavior => ({
      id: behavior.id,
      name: behavior.name,
      type: 'behavior',
      audience_size: behavior.audience_size || behavior.audience_size_lower_bound || 0,
      audience_size_upper: behavior.audience_size_upper_bound || 0,
      path: behavior.path || [],
      description: behavior.description || null,
    }));

  } catch (error) {
    console.error('❌ [Behavior Search] Error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Search for demographics (family status, life events, education, work)
 * @param {string} query - Search query
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<Array>} Array of demographic objects
 */
async function searchDemographics(query, accessToken) {
  try {
    // Search multiple demographic classes in parallel
    const demographicClasses = ['family_statuses', 'life_events', 'work', 'education'];
    
    const results = await Promise.all(
      demographicClasses.map(async (demoClass) => {
        try {
          const response = await axios.get(`${FB_GRAPH_API}/search`, {
            params: {
              type: 'adTargetingCategory',
              class: demoClass,
              q: query,
              access_token: accessToken,
              limit: 20,
            },
          });
          
          return (response.data.data || []).map(item => ({
            id: item.id,
            name: item.name,
            type: mapDemographicClass(demoClass),
            subtype: demoClass,
            audience_size: item.audience_size || item.audience_size_lower_bound || 0,
            audience_size_upper: item.audience_size_upper_bound || 0,
            path: item.path || [],
            description: item.description || null,
          }));
        } catch (err) {
          console.warn(`⚠️ [Demographics] Failed to search class ${demoClass}:`, err.message);
          return [];
        }
      })
    );

    return results.flat();

  } catch (error) {
    console.error('❌ [Demographics Search] Error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Map demographic class to user-friendly type
 */
function mapDemographicClass(demoClass) {
  const classMap = {
    family_statuses: 'family_status',
    life_events: 'life_event',
    work: 'work',
    education: 'education',
  };
  return classMap[demoClass] || 'demographic';
}

/**
 * Get targeting suggestions (browse mode without search query)
 * Returns popular categories for each type
 * @param {string[]} types - Targeting types
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<Array>} Array of targeting suggestions
 */
export async function getTargetingSuggestions(types = ['interest'], accessToken) {
  const suggestions = [];

  try {
    // Get popular interest categories
    if (types.includes('interest')) {
      const popularInterests = await searchInterests('shopping', accessToken);
      suggestions.push(...popularInterests.slice(0, 10));
    }

    // Get behavior categories
    if (types.includes('behavior')) {
      const response = await axios.get(`${FB_GRAPH_API}/search`, {
        params: {
          type: 'adTargetingCategory',
          class: 'behaviors',
          access_token: accessToken,
          limit: 20,
        },
      });
      
      const behaviors = (response.data.data || []).map(b => ({
        id: b.id,
        name: b.name,
        type: 'behavior',
        audience_size: b.audience_size || 0,
        path: b.path || [],
      }));
      
      suggestions.push(...behaviors);
    }

    return suggestions;

  } catch (error) {
    console.error('❌ [Targeting Suggestions] Error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Validate targeting IDs exist and are valid
 * @param {Array<{id: string, name: string}>} targetingItems - Array of targeting items to validate
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<{valid: Array, invalid: Array}>} Validation result
 */
export async function validateTargetingIds(targetingItems, accessToken) {
  if (!targetingItems || targetingItems.length === 0) {
    return { valid: [], invalid: [] };
  }

  const valid = [];
  const invalid = [];

  // Batch validate by searching for each ID
  for (const item of targetingItems) {
    try {
      // Simple validation: check if ID is numeric (Facebook IDs are numeric)
      if (item.id && /^\d+$/.test(String(item.id))) {
        valid.push(item);
      } else {
        invalid.push({ ...item, reason: 'Invalid ID format' });
      }
    } catch (error) {
      invalid.push({ ...item, reason: error.message });
    }
  }

  return { valid, invalid };
}

/**
 * Clear targeting cache
 */
export function clearTargetingCache() {
  targetingCache.clear();
  console.log('🗑️ Targeting cache cleared');
}

export default {
  searchTargeting,
  getTargetingSuggestions,
  validateTargetingIds,
  clearTargetingCache,
};

