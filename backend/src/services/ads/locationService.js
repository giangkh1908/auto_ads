import axios from 'axios';

const FB_API_VERSION = 'v23.0';
const FB_GRAPH_API = `https://graph.facebook.com/${FB_API_VERSION}`;
const MAPBOX_API = 'https://api.mapbox.com/geocoding/v5';
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

// In-memory cache cho location search (TTL: 1 hour)
const locationCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cache for Facebook key lookups (Mapbox ID -> Facebook key)
const facebookKeyCache = new Map();
const FACEBOOK_KEY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if a key is a valid Facebook location key (numeric)
 * Facebook keys are integers, Mapbox IDs are strings like "place.xxxxx" or "region.xxxxx"
 * @param {string|number} key - Location key to validate
 * @returns {boolean} True if valid Facebook key
 */
function isValidFacebookKey(key) {
  if (key == null) return false;
  
  // Convert to string for checking
  const keyStr = String(key);
  
  // Mapbox IDs contain dots (e.g., "place.9521396", "region.12345")
  if (keyStr.includes('.')) {
    return false;
  }
  
  // Facebook keys are numeric (can be string representation of integer)
  // Check if it's a valid integer
  const numKey = Number(keyStr);
  return !isNaN(numKey) && isFinite(numKey) && numKey > 0;
}

/**
 * Search for ad locations using Mapbox Geocoding API
 * Returns format compatible with existing Facebook location structure
 * @param {string} query - Search query (e.g., "hanoi", "ho chi minh")
 * @param {string[]} types - Location types to search: ['city', 'region', 'country', 'zip']
 * @param {string} accessToken - Facebook access token (used for Facebook key lookup, optional)
 * @returns {Promise<Array>} Array of location objects
 */
export async function searchAdLocations(query, types = ['city', 'region'], accessToken) {
  if (!query || !query.trim()) {
    return [];
  }

  if (!MAPBOX_TOKEN) {
    throw new Error('MAPBOX_ACCESS_TOKEN is required. Please set it in your .env file');
  }

  // Check cache first
  const cacheKey = `mapbox_${query.toLowerCase()}_${types.join(',')}`;
  const cached = locationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Location cache hit for: ${query}`);
    return cached.data;
  }

  try {
    console.log(`🔍 [Mapbox] Searching locations: query="${query}", types=${types.join(',')}`);

    // Map frontend types to Mapbox types
    const mapboxTypes = mapTypesToMapbox(types);
    
    const response = await axios.get(`${MAPBOX_API}/mapbox.places/${encodeURIComponent(query)}.json`, {
      params: {
        access_token: MAPBOX_TOKEN,
        country: 'vn', // Limit to Vietnam
        types: mapboxTypes.join(','), // place (city), region (province)
        language: 'vi', // Vietnamese
        limit: 50,
        proximity: '108.2772,14.0583', // Center of Vietnam for better results
      },
    });

    const features = response.data.features || [];
    
    // Transform Mapbox format to Facebook-compatible format
    const mapboxLocations = features.map(feature => {
      const [lng, lat] = feature.center;
      const context = feature.context || [];
      
      // Determine location type
      const placeType = feature.place_type?.[0] || 'place';
      const locationType = placeType === 'place' ? 'city' : 
                         placeType === 'region' ? 'region' : 
                         placeType === 'district' ? 'district' : // Quận/Huyện
                         placeType === 'locality' ? 'district' : // Phường/Xã (treat as district for Facebook)
                         'city';
      
      // Extract region/province from context
      const region = extractRegionFromContext(context);
      
      // Extract main name (city name)
      const name = feature.text || feature.place_name;
      
      return {
        key: feature.id, // Mapbox feature ID (will be mapped to Facebook key)
        name: name,
        type: locationType,
        country_code: 'VN',
        country_name: 'Vietnam',
        region: region,
        region_id: null,
        supports_region: locationType === 'region',
        supports_city: locationType === 'city',
        // Mapbox-specific data (for Facebook key lookup)
        _mapbox: {
          id: feature.id,
          coordinates: { lat, lng },
          bbox: feature.bbox,
          place_name: feature.place_name,
          context: context,
        },
      };
    });

    console.log(`✅ [Mapbox] Found ${mapboxLocations.length} locations for: ${query}`);

    // Lookup Facebook keys for all locations (batch lookup)
    const allLocations = await batchLookupFacebookKeys(mapboxLocations, accessToken);

    // Filter: Return locations with Facebook keys, but also keep districts even if unmapped
    // (Facebook may not have district keys, but we still want to show them)
    const locations = allLocations.filter(loc => {
      const hasFbKey = loc.facebook_key && isValidFacebookKey(loc.key);
      
      // For districts, if no Facebook key found, use the parent city's key as fallback
      if (!hasFbKey && loc.type === 'district' && loc._mapbox?.context) {
        // Try to find parent city from context
        const cityContext = loc._mapbox.context.find(ctx => 
          ctx.id?.startsWith('place')
        );
        if (cityContext) {
          // Lookup parent city's Facebook key
          const parentCityLocation = {
            name: cityContext.text,
            type: 'city',
            _mapbox: { id: cityContext.id, place_name: cityContext.text },
          };
          
          // This is async, so we'll handle it in batchLookupFacebookKeys
          // For now, keep the district but mark it as needing parent lookup
          loc._needsParentLookup = true;
          loc._parentCityName = cityContext.text;
          return true; // Keep district even without direct Facebook key
        }
      }
      
      if (!hasFbKey && loc.type !== 'district') {
        console.warn(`⚠️ Filtering out unmapped location: ${loc.name} (Mapbox ID: ${loc._mapbox_id || loc.key})`);
      }
      
      return hasFbKey || loc.type === 'district'; // Keep districts even if unmapped
    });

    // For districts without Facebook keys, try to use parent city's key
    const locationsWithParentKeys = await Promise.all(
      locations.map(async (loc) => {
        if (loc._needsParentLookup && loc._parentCityName && accessToken) {
          const parentCityLocation = {
            name: loc._parentCityName,
            type: 'city',
            _mapbox: { id: `place.${loc._parentCityName}`, place_name: loc._parentCityName },
          };
          const parentFbKey = await lookupFacebookLocationKey(parentCityLocation, accessToken);
          if (parentFbKey) {
            // Use parent city's key for the district
            loc.key = parentFbKey;
            loc.facebook_key = parentFbKey;
            loc._usingParentKey = true;
            console.log(`✅ [District] Using parent city key ${parentFbKey} for district: ${loc.name}`);
          }
        }
        return loc;
      })
    );

    // Final filter: Only return locations with valid Facebook keys (numeric)
    const finalLocations = locationsWithParentKeys.filter(loc => {
      const hasValidKey = isValidFacebookKey(loc.key);
      if (!hasValidKey) {
        console.warn(`⚠️ Filtering out location without valid Facebook key: ${loc.name} (type: ${loc.type})`);
      }
      return hasValidKey;
    });

    console.log(`✅ [Mapbox] Returning ${finalLocations.length}/${allLocations.length} locations with Facebook keys`);

    // Cache results (only mapped locations)
    locationCache.set(cacheKey, {
      data: finalLocations,
      timestamp: Date.now(),
    });

    // Clean up old cache entries (simple LRU)
    if (locationCache.size > 1000) {
      const oldestKey = locationCache.keys().next().value;
      locationCache.delete(oldestKey);
    }

    return finalLocations;
  } catch (error) {
    console.error('❌ [Mapbox] Error searching locations:', error.response?.data || error.message);
    
    // Handle specific Mapbox API errors
    if (error.response?.data?.message) {
      throw new Error(`Mapbox API Error: ${error.response.data.message}`);
    }

    throw new Error('Failed to search locations from Mapbox API');
  }
}

/**
 * Map frontend location types to Mapbox types
 * @param {string[]} types - Frontend types: ['city', 'region', 'district', 'country', 'zip']
 * @returns {string[]} Mapbox types: ['place', 'region', 'district', 'locality', 'country', 'postcode']
 */
function mapTypesToMapbox(types) {
  const typeMap = {
    'city': 'place',
    'region': 'region',
    'district': 'district', // Quận/Huyện
    'locality': 'locality', // Phường/Xã (smaller administrative units)
    'country': 'country',
    'zip': 'postcode',
  };
  
  // If searching for districts, also include locality for better results
  if (types.includes('district')) {
    return ['district', 'locality', 'place'].filter(Boolean);
  }
  
  return types.map(t => typeMap[t] || 'place').filter(Boolean);
}

/**
 * Extract region/province name from Mapbox context
 * @param {Array} context - Mapbox context array
 * @returns {string} Region name
 */
function extractRegionFromContext(context) {
  // Find region (administrative area level 1) in context
  const region = context.find(ctx => 
    ctx.id?.startsWith('region') || 
    ctx.id?.startsWith('province')
  );
  return region?.text || '';
}

/**
 * Lookup Facebook location key from Mapbox location
 * Uses hybrid approach: Search Facebook API with location name/coordinates
 * @param {Object} mapboxLocation - Location object from Mapbox search
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<string|null>} Facebook location key or null if not found
 */
export async function lookupFacebookLocationKey(mapboxLocation, accessToken) {
  if (!mapboxLocation || !mapboxLocation._mapbox) {
    return null;
  }

  const mapboxId = mapboxLocation._mapbox.id;
  
  // Check cache first
  const cached = facebookKeyCache.get(mapboxId);
  if (cached && Date.now() - cached.timestamp < FACEBOOK_KEY_CACHE_TTL) {
    console.log(`📦 Facebook key cache hit for Mapbox ID: ${mapboxId}`);
    return cached.key;
  }

  if (!accessToken) {
    console.warn('⚠️ No Facebook access token for key lookup');
    return null;
  }

  try {
    // Try searching Facebook API with location name
    const searchQuery = mapboxLocation.name || mapboxLocation._mapbox.place_name;
    
    // For districts, try multiple search strategies
    let searchQueries = [searchQuery];
    let locationType = mapboxLocation.type;
    
    // If it's a district, try with full context (e.g., "Quận 1, Hà Nội")
    if (locationType === 'district' && mapboxLocation._mapbox?.context) {
      const context = mapboxLocation._mapbox.context;
      // Find city/province name from context
      const cityContext = context.find(ctx => 
        ctx.id?.startsWith('place') || 
        ctx.id?.startsWith('region')
      );
      if (cityContext) {
        // Try with full name: "Quận 1, Hà Nội"
        searchQueries.push(`${searchQuery}, ${cityContext.text}`);
        // Also try: "Hà Nội, Quận 1"
        searchQueries.push(`${cityContext.text}, ${searchQuery}`);
        // Try without "Quận" prefix: "1, Hà Nội" or "Hà Nội, 1"
        const districtNameWithoutPrefix = searchQuery.replace(/^Quận\s*/i, '').replace(/^Huyện\s*/i, '');
        if (districtNameWithoutPrefix !== searchQuery) {
          searchQueries.push(`${districtNameWithoutPrefix}, ${cityContext.text}`);
          searchQueries.push(`${cityContext.text}, ${districtNameWithoutPrefix}`);
        }
      }
    }
    
    // Map location type to Facebook location types
    // Facebook supports: 'country', 'region', 'city', 'zip'
    // For districts, try searching as 'city' first (Facebook may not have district type)
    if (locationType === 'district' || locationType === 'locality') {
      // Try city first for districts/wards, as Facebook may classify them as cities
      locationType = 'city';
    } else if (locationType === 'region') {
      locationType = 'region';
    } else {
      locationType = 'city'; // Default to city
    }
    
    // Try each search query
    let matchedLocation = null;
    for (const query of searchQueries) {
      console.log(`🔍 [Facebook Key Lookup] Searching for: "${query}" (type: ${mapboxLocation.type} → Facebook: ${locationType})`);
      
      const response = await axios.get(`${FB_GRAPH_API}/search`, {
        params: {
          type: 'adgeolocation',
          q: query,
          location_types: JSON.stringify([locationType]),
          access_token: accessToken,
          limit: 10,
        },
      });

      const fbLocations = response.data.data || [];
      
      // Try to match by name (fuzzy match)
      matchedLocation = fbLocations.find(fbLoc => {
        const fbName = fbLoc.name?.toLowerCase() || '';
        const queryLower = query.toLowerCase();
        
        // Check if Facebook name contains district name or vice versa
        return fbName === queryLower || 
               fbName.includes(queryLower) || 
               queryLower.includes(fbName) ||
               // For districts, check if name contains "Quận" or district number
               (mapboxLocation.type === 'district' && 
                (fbName.includes('quận') || 
                 fbName.includes('huyện') ||
                 fbName.includes('district') ||
                 // Check if district number matches (e.g., "1" in "Quận 1")
                 (queryLower.match(/\d+/) && fbName.includes(queryLower.match(/\d+/)?.[0] || ''))));
      });

      if (matchedLocation) {
        break; // Found a match, stop searching
      }
      
      // If no match but have results, try the first result as fallback
      if (!matchedLocation && fbLocations.length > 0) {
        matchedLocation = fbLocations[0];
        break;
      }
    }

    if (matchedLocation) {
      const fbKey = matchedLocation.key;
      
      // Cache the mapping
      facebookKeyCache.set(mapboxId, {
        key: fbKey,
        timestamp: Date.now(),
      });
      
      console.log(`✅ [Facebook Key Lookup] Found key: ${fbKey} for "${searchQuery}"`);
      return fbKey;
    }

    console.warn(`⚠️ [Facebook Key Lookup] No match found for: "${searchQuery}"`);
    return null;
  } catch (error) {
    console.error('❌ [Facebook Key Lookup] Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Batch lookup Facebook keys for multiple Mapbox locations
 * @param {Array} mapboxLocations - Array of location objects from Mapbox
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<Array>} Array of locations with Facebook keys (use Facebook key as main key)
 */
export async function batchLookupFacebookKeys(mapboxLocations, accessToken) {
  if (!mapboxLocations || mapboxLocations.length === 0) {
    return [];
  }

  if (!accessToken) {
    console.warn('⚠️ No Facebook access token for batch lookup, returning Mapbox IDs');
    return mapboxLocations;
  }

  console.log(`🔄 [Batch Lookup] Looking up Facebook keys for ${mapboxLocations.length} locations`);

  // Lookup keys in parallel (with rate limiting)
  const lookupPromises = mapboxLocations.map(async (location) => {
    const fbKey = await lookupFacebookLocationKey(location, accessToken);
    
    if (fbKey) {
      // Use Facebook key as main key, keep Mapbox ID for reference
      return {
        ...location,
        key: fbKey, // Facebook key (numeric) - this is what frontend will use
        facebook_key: fbKey,
        _mapbox_id: location.key, // Keep original Mapbox ID for reference
      };
    } else {
      // Lookup failed - still return but with warning
      console.warn(`⚠️ Could not map Mapbox ID ${location.key} to Facebook key for "${location.name}"`);
      return {
        ...location,
        // Keep Mapbox ID but mark as unmapped
        _unmapped: true,
        _mapbox_id: location.key,
      };
    }
  });

  const results = await Promise.all(lookupPromises);
  
  const foundCount = results.filter(r => r.facebook_key).length;
  const unmappedCount = results.filter(r => r._unmapped).length;
  
  console.log(`✅ [Batch Lookup] Mapped ${foundCount}/${mapboxLocations.length} locations to Facebook keys`);
  if (unmappedCount > 0) {
    console.warn(`⚠️ [Batch Lookup] ${unmappedCount} locations could not be mapped to Facebook keys`);
  }

  return results;
}

/**
 * Get popular Vietnam locations (pre-defined for quick access)
 * @returns {Array} Array of popular location objects
 */
export function getPopularVietnamLocations() {
  return [
    { key: '1583829', name: 'Hà Nội', type: 'city', country_code: 'VN', country_name: 'Vietnam' },
    { key: '1580240', name: 'Thành phố Hồ Chí Minh', type: 'city', country_code: 'VN', country_name: 'Vietnam' },
    { key: '1584595', name: 'Đà Nẵng', type: 'city', country_code: 'VN', country_name: 'Vietnam' },
    { key: '1584068', name: 'Cần Thơ', type: 'city', country_code: 'VN', country_name: 'Vietnam' },
    { key: '1582907', name: 'Hải Phòng', type: 'city', country_code: 'VN', country_name: 'Vietnam' },
    { key: '1565131', name: 'Biên Hòa', type: 'city', country_code: 'VN', country_name: 'Vietnam' },
    { key: '1580762', name: 'Nha Trang', type: 'city', country_code: 'VN', country_name: 'Vietnam' },
    { key: '1582926', name: 'Huế', type: 'city', country_code: 'VN', country_name: 'Vietnam' },
  ];
}

/**
 * Clear location cache (useful for testing or manual refresh)
 */
export function clearLocationCache() {
  locationCache.clear();
  console.log('🗑️ Location cache cleared');
}

/**
 * Resolve Mapbox coordinates to Facebook location key (optional)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<string|null>} Facebook city key or null
 */
export async function resolveMapboxToFb(lat, lng, accessToken) {
  // For now, just return null - custom locations will use lat/lng directly
  // This can be enhanced later to reverse geocode and find nearest Facebook city
  return null;
}

export default {
  searchAdLocations,
  getPopularVietnamLocations,
  clearLocationCache,
  lookupFacebookLocationKey,
  batchLookupFacebookKeys,
  resolveMapboxToFb,
};

