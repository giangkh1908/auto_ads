/**
 * Utility functions to parse Facebook geo_locations format to frontend locations format
 * Used when loading adset data in edit mode
 */

/**
 * Parse Facebook geo_locations back to our frontend locations format
 * @param {Object} targeting - Targeting object from database (may contain both locations and geo_locations)
 * @returns {Object} Frontend locations format
 */
export function parseGeoLocationsToFrontend(targeting) {
  // ✅ PRIORITY 1: If targeting.locations exists (saved with names), use it directly
  if (targeting?.locations && typeof targeting.locations === 'object' && !Array.isArray(targeting.locations)) {
    console.log('✅ Using saved locations with names from database');
    return {
      regions: targeting.locations.regions || [],
      cities: targeting.locations.cities || [],
      custom_locations: targeting.locations.custom_locations || [],
      excluded_ids: targeting.locations.excluded_ids || [],
      _regionNames: targeting.locations._regionNames || {}
    };
  }

  // ✅ PRIORITY 2: Parse from geo_locations (Facebook format)
  const geo_locations = targeting?.geo_locations || targeting;
  
  if (!geo_locations) {
    return {
      regions: [],
      cities: [],
      custom_locations: [],
      excluded_ids: []
    };
  }

  const locations = {
    regions: [],
    cities: [],
    custom_locations: [],
    excluded_ids: [],
    _regionNames: {}
  };

  // Parse regions
  if (geo_locations.regions && Array.isArray(geo_locations.regions)) {
    locations.regions = geo_locations.regions.map(r => r.key || r);
    console.log(`✅ Parsed ${locations.regions.length} regions from geo_locations`);
  }

  // Parse cities
  if (geo_locations.cities && Array.isArray(geo_locations.cities)) {
    locations.cities = geo_locations.cities.map(c => ({
      key: c.key || c,
      radius: c.radius || 20, // Default radius if not specified
      name: c.name || c.key || c, // Use name if available, fallback to key
    }));
    console.log(`✅ Parsed ${locations.cities.length} cities from geo_locations`);
  }

  // Parse custom locations (pins)
  if (geo_locations.custom_locations && Array.isArray(geo_locations.custom_locations)) {
    locations.custom_locations = geo_locations.custom_locations.map(cl => ({
      lat: cl.latitude || cl.lat,
      lng: cl.longitude || cl.lng,
      radius: cl.radius || 10
    }));
    console.log(`✅ Parsed ${locations.custom_locations.length} custom locations`);
  }

  // Parse excluded locations
  if (geo_locations.excluded_geo_locations?.cities) {
    locations.excluded_ids = geo_locations.excluded_geo_locations.cities.map(c => c.key || c);
    console.log(`✅ Parsed ${locations.excluded_ids.length} excluded locations`);
  }

  // If only countries exist (old format), return empty (will use default)
  if (geo_locations.countries && !locations.regions.length && !locations.cities.length && !locations.custom_locations.length) {
    console.log('⚠️ Only countries found, returning empty locations (will use default)');
    return {
      regions: [],
      cities: [],
      custom_locations: [],
      excluded_ids: []
    };
  }

  console.log('🔄 Parsed geo_locations to frontend format:', locations);
  return locations;
}

export default {
  parseGeoLocationsToFrontend,
};

