/**
 * Targeting Builder Service for Facebook Marketing API v23.0
 * Transforms frontend location input into Facebook Ad Set targeting spec
 * Implements Advantage+ Audience logic: Age/Gender are suggestions, Location is hard constraint
 * 
 * Key Features:
 * - Deduplication: Removes duplicate location keys
 * - Radius Clamping: Cities 17-80km, Custom pins 1-80km (fixes Error 1487110)
 * - Limit Validation: Max 250 locations (fixes Error 1487756)
 * - Mapbox Integration: Maps Mapbox location IDs to Facebook location keys before publishing
 * - Validation: Ensures only Facebook keys (numeric) are sent to Facebook API
 */

/**
 * Build Facebook targeting payload from frontend input
 * @param {Object} input - Frontend targeting input
 * @param {number} input.age_min - Minimum age (18-65)
 * @param {number} input.age_max - Maximum age (18-65)
 * @param {number[]} input.genders - Array of gender codes (1=Male, 2=Female, 0=All)
 * @param {Object} input.locations - Location targeting object
 * @param {string[]} input.locations.regions - Array of region keys
 * @param {Object[]} input.locations.cities - Array of {key, radius, name} objects
 * @param {Object[]} input.locations.custom_locations - Array of {lat, lng, radius} objects
 * @param {string[]} input.locations.excluded_ids - Array of excluded location keys
 * @param {Object} existingTargeting - Existing targeting object to merge with
 * @returns {Object} Facebook targeting specification
 */
export function buildTargetingPayload(input, existingTargeting = {}) {
  console.log('🎯 Building targeting payload from input:', JSON.stringify(input, null, 2));

  // Initialize targeting object with defaults
  // DON'T merge geo_locations from existingTargeting - we'll build fresh to avoid conflicts
  const { geo_locations: _unused, ...existingWithoutGeo } = existingTargeting;
  
  const targeting = {
    ...existingWithoutGeo,
    publisher_platforms: existingTargeting.publisher_platforms || ['facebook'],
    facebook_positions: existingTargeting.facebook_positions || ['feed', 'video_feeds', 'marketplace', 'search'],
  };

  // === AGE TARGETING (Advantage+ Suggestion) ===
  if (input.age_min !== undefined && input.age_min >= 18 && input.age_min <= 65) {
    targeting.age_min = input.age_min;
  }
  if (input.age_max !== undefined && input.age_max >= 18 && input.age_max <= 65) {
    targeting.age_max = input.age_max;
  }

  // === GENDER TARGETING (Advantage+ Suggestion) ===
  // 0 = All, 1 = Male, 2 = Female
  if (input.genders && Array.isArray(input.genders) && input.genders.length > 0) {
    // If includes 0 (All), don't set genders field (means all genders)
    if (!input.genders.includes(0)) {
      targeting.genders = input.genders.filter(g => g === 1 || g === 2);
    }
  }

  // === LOCATION TARGETING (Hard Constraint) ===
  if (input.locations) {
    // Build geo_locations fresh - don't pass existingTargeting to avoid conflicts
    targeting.geo_locations = buildGeoLocations(input.locations);
  }

  // Validate total location count
  const totalLocations = getTotalLocationCount(targeting.geo_locations);
  if (totalLocations > 250) {
    throw new Error(`Total location count (${totalLocations}) exceeds Facebook limit of 250`);
  }

  console.log('✅ Built targeting payload:', JSON.stringify(targeting, null, 2));
  return targeting;
}

/**
 * Build geo_locations object from frontend locations input
 * Applies deduplication and radius clamping
 * @param {Object} locations - Frontend locations object
 * @returns {Object} Facebook geo_locations specification
 */
function buildGeoLocations(locations) {
  const geoLocations = {};  // Start fresh to avoid conflicts

  // === COUNTRIES ===
  // ONLY set default country if NO specific locations are provided
  // This prevents Error 1487756 (overlap) when cities/regions are specified
  if (!locations.regions?.length && !locations.cities?.length && !locations.custom_locations?.length) {
    geoLocations.countries = ['VN'];
    console.log('✅ Using default country: VN (no specific locations provided)');
  } else {
    console.log('✅ Skipping default country (specific locations provided)');
  }

  // === REGIONS (States/Provinces) ===
  if (locations.regions && locations.regions.length > 0) {
    // FIX Error 1487756: Use Set for deduplication
    const uniqueRegions = [...new Set(locations.regions)];
    
    // Validate: Only Facebook keys (numeric) should reach here after mapping
    const validRegions = uniqueRegions.filter(regionKey => {
      const isValid = isValidFacebookKey(regionKey);
      if (!isValid) {
        console.error(`❌ Invalid region key detected (should have been mapped): ${regionKey}`);
      }
      return isValid;
    });
    
    if (validRegions.length === 0 && uniqueRegions.length > 0) {
      throw new Error('All region keys are invalid. Mapbox IDs should have been mapped to Facebook keys.');
    }
    
    geoLocations.regions = validRegions.map(regionKey => ({
      key: String(regionKey), // Ensure it's a string (Facebook expects string representation of integer)
    }));
    console.log(`✅ Added ${validRegions.length} unique regions (deduplicated from ${locations.regions.length})`);
  }

  // === CITIES ===
  if (locations.cities && locations.cities.length > 0) {
    // FIX Error 1487756: Deduplicate cities by key
    const uniqueCities = Array.from(
      new Map(locations.cities.map(city => [city.key, city])).values()
    );

    // Validate: Only Facebook keys (numeric) should reach here after mapping
    const validCities = uniqueCities.filter(city => {
      const isValid = isValidFacebookKey(city.key);
      if (!isValid) {
        console.error(`❌ Invalid city key detected (should have been mapped): ${city.key} (${city.name || 'unknown'})`);
      }
      return isValid;
    });
    
    if (validCities.length === 0 && uniqueCities.length > 0) {
      throw new Error('All city keys are invalid. Mapbox IDs should have been mapped to Facebook keys.');
    }

    geoLocations.cities = validCities.map(city => {
      const citySpec = { key: String(city.key) }; // Ensure it's a string (Facebook expects string representation of integer)
      
      // FIX Error 1487110: Radius Clamping for Cities (17-80km)
      if (city.radius && city.radius > 0) {
        const clampedRadius = Math.max(17, Math.min(80, city.radius));
        
        if (clampedRadius !== city.radius) {
          console.log(`⚠️ Radius clamped for city ${city.key}: ${city.radius}km → ${clampedRadius}km`);
        }
        
        citySpec.radius = clampedRadius;
        citySpec.distance_unit = 'kilometer';
      }
      
      return citySpec;
    });
    
    console.log(`✅ Added ${validCities.length} unique cities (deduplicated from ${locations.cities.length})`);
  }

  // === CUSTOM LOCATIONS (Lat/Lng with Radius) ===
  if (locations.custom_locations && locations.custom_locations.length > 0) {
    // Facebook API limit: max 10 custom locations
    if (locations.custom_locations.length > 10) {
      throw new Error('Maximum 10 custom locations allowed');
    }

    geoLocations.custom_locations = locations.custom_locations.map(customLoc => {
      // FIX Error 1487110: Radius Clamping for Pins (1-80km)
      const clampedRadius = Math.max(1, Math.min(80, customLoc.radius || 10));
      
      if (clampedRadius !== (customLoc.radius || 10)) {
        console.log(`⚠️ Radius clamped for custom location: ${customLoc.radius || 10}km → ${clampedRadius}km`);
      }

      return {
        latitude: customLoc.lat,
        longitude: customLoc.lng,
        radius: clampedRadius,
        distance_unit: 'kilometer',
      };
    });
    
    console.log(`✅ Added ${locations.custom_locations.length} custom locations`);
  }

  // === EXCLUDED LOCATIONS ===
  if (locations.excluded_ids && locations.excluded_ids.length > 0) {
    geoLocations.location_types = geoLocations.location_types || ['home'];
    
    // Validate excluded locations (should be Facebook keys after mapping)
    const validExcludedIds = locations.excluded_ids.filter(key => {
      const isValid = isValidFacebookKey(key);
      if (!isValid) {
        console.warn(`⚠️ Skipping invalid excluded location key: ${key}`);
      }
      return isValid;
    });
    
    if (validExcludedIds.length > 0) {
      // Excluded locations can be cities or regions
      geoLocations.excluded_geo_locations = {
        cities: validExcludedIds.map(key => ({ key: String(key) })),
      };
      
      console.log(`✅ Added ${validExcludedIds.length} excluded locations (filtered ${locations.excluded_ids.length - validExcludedIds.length} invalid keys)`);
    }
  }

  return geoLocations;
}

/**
 * Count total number of locations in geo_locations object
 * @param {Object} geoLocations - Facebook geo_locations object
 * @returns {number} Total count
 */
function getTotalLocationCount(geoLocations) {
  if (!geoLocations) return 0;

  let count = 0;
  if (geoLocations.countries) count += geoLocations.countries.length;
  if (geoLocations.regions) count += geoLocations.regions.length;
  if (geoLocations.cities) count += geoLocations.cities.length;
  if (geoLocations.custom_locations) count += geoLocations.custom_locations.length;
  
  return count;
}

/**
 * Validate targeting payload before sending to Facebook
 * @param {Object} targeting - Targeting object
 * @throws {Error} If validation fails
 */
export function validateTargeting(targeting) {
  // Check age range
  if (targeting.age_min !== undefined && targeting.age_max !== undefined) {
    if (targeting.age_min > targeting.age_max) {
      throw new Error('age_min cannot be greater than age_max');
    }
  }

  // Check location count
  const totalLocations = getTotalLocationCount(targeting.geo_locations);
  if (totalLocations === 0) {
    throw new Error('At least one location must be specified');
  }
  if (totalLocations > 250) {
    throw new Error(`Total location count (${totalLocations}) exceeds Facebook limit of 250`);
  }

  // Check custom locations limit
  if (targeting.geo_locations?.custom_locations?.length > 10) {
    throw new Error('Maximum 10 custom locations allowed');
  }

  return true;
}

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
 * Transform adset targeting object to include locations and detailed targeting
 * This is the main function to call from adsWizardService
 * @param {Object} adset - Adset object from frontend
 * @param {string} accessToken - Facebook access token (optional, for Mapbox->Facebook key mapping)
 * @returns {Promise<Object>} Adset with transformed targeting
 */
export async function transformAdsetTargeting(adset, accessToken = null) {
  console.log('🎯 [transformAdsetTargeting] Input adset.targeting:', JSON.stringify(adset.targeting, null, 2));
  
  if (!adset || !adset.targeting) {
    console.log('⚠️ [transformAdsetTargeting] No adset or targeting, returning as-is');
    return adset;
  }

  let newTargeting = { ...adset.targeting };

  // === LOCATION TARGETING ===
  // Check if targeting has the new locations structure
  if (adset.targeting.locations) {
    console.log('✅ [transformAdsetTargeting] Found locations structure:', adset.targeting.locations);
    
    try {
      // Map Mapbox keys to Facebook keys if needed
      let locations = adset.targeting.locations;
      
      if (accessToken) {
        locations = await mapMapboxKeysToFacebook(locations, accessToken);
      }
      
      // Build new targeting payload
      newTargeting = buildTargetingPayload(
        {
          age_min: adset.targeting.age_min,
          age_max: adset.targeting.age_max,
          genders: adset.targeting.genders,
          locations: locations,
        },
        adset.targeting
      );

      console.log('✅ [transformAdsetTargeting] New targeting after build:', JSON.stringify(newTargeting, null, 2));

      // Remove the temporary locations field before sending to Facebook
      delete newTargeting.locations;
    } catch (error) {
      console.error('❌ [transformAdsetTargeting] Error with locations:', error.message);
      throw error;
    }
  }

  // === DETAILED TARGETING (Interests, Behaviors, Demographics) ===
  // Check if targeting has detailed_targeting array from frontend
  if (adset.targeting.detailed_targeting && Array.isArray(adset.targeting.detailed_targeting)) {
    console.log('✅ [transformAdsetTargeting] Found detailed_targeting:', adset.targeting.detailed_targeting);
    
    try {
      // Build flexible_spec from detailed_targeting items
      const flexibleSpec = buildFlexibleSpec(adset.targeting.detailed_targeting);
      
      if (flexibleSpec && flexibleSpec.length > 0) {
        newTargeting.flexible_spec = flexibleSpec;
        console.log('✅ [transformAdsetTargeting] Added flexible_spec:', JSON.stringify(flexibleSpec, null, 2));
      }
      
      // Remove the temporary detailed_targeting field before sending to Facebook
      delete newTargeting.detailed_targeting;
    } catch (error) {
      console.error('❌ [transformAdsetTargeting] Error with detailed_targeting:', error.message);
      // Don't throw, just log - detailed targeting is optional
      console.warn('⚠️ Continuing without detailed targeting');
    }
  }

  const result = {
    ...adset,
    targeting: newTargeting,
  };

  console.log('✅ [transformAdsetTargeting] Final result:', JSON.stringify(result.targeting, null, 2));
  return result;
}

/**
 * Map Mapbox location keys to Facebook location keys
 * @param {Object} locations - Frontend locations object (may contain Mapbox IDs)
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<Object>} Locations with Facebook keys
 */
async function mapMapboxKeysToFacebook(locations, accessToken) {
  const { lookupFacebookLocationKey } = await import('./locationService.js');
  
  const mappedLocations = { ...locations };
  
  // Map cities
  if (locations.cities && locations.cities.length > 0) {
    console.log(`🔄 [Mapbox->Facebook] Validating ${locations.cities.length} cities...`);
    
    // Check if any cities need mapping (fallback for unmapped locations)
    const citiesNeedingMapping = locations.cities.filter(city => !isValidFacebookKey(city.key));
    
    if (citiesNeedingMapping.length > 0) {
      console.log(`⚠️ Found ${citiesNeedingMapping.length} cities with Mapbox IDs, attempting to map...`);
      
      const citiesWithFbKeys = await Promise.all(
        locations.cities.map(async (city) => {
          // Check if key is already a valid Facebook key
          if (isValidFacebookKey(city.key)) {
            // Already a Facebook key (from search), return as-is
            return city;
          }
          
          // This is a Mapbox ID (fallback case), need to lookup Facebook key
          console.log(`🔍 Looking up Facebook key for Mapbox ID: ${city.key} (${city.name || 'unknown'})`);
          const fbKey = await lookupFacebookLocationKey(city, accessToken);
          
          if (fbKey && isValidFacebookKey(fbKey)) {
            console.log(`✅ Mapped ${city.key} → ${fbKey} (${city.name || 'unknown'})`);
            return {
              ...city,
              key: fbKey,
              facebook_key: fbKey,
            };
          } else {
            // Lookup failed - this is a problem, we can't use Mapbox ID
            console.error(`❌ Failed to map Mapbox ID to Facebook key: ${city.key} (${city.name || 'unknown'})`);
            throw new Error(
              `Cannot map Mapbox location "${city.name || city.key}" to Facebook location key. ` +
              `Please try selecting the location again or use a different location.`
            );
          }
        })
      );
      
      mappedLocations.cities = citiesWithFbKeys;
    } else {
      // All cities already have Facebook keys (from search)
      console.log(`✅ All ${locations.cities.length} cities already have Facebook keys`);
      mappedLocations.cities = locations.cities;
    }
  }
  
  // Map regions
  if (locations.regions && locations.regions.length > 0) {
    console.log(`🔄 [Mapbox->Facebook] Validating ${locations.regions.length} regions...`);
    
    // Check if any regions need mapping (fallback for unmapped locations)
    const regionsNeedingMapping = locations.regions.filter(regionKey => !isValidFacebookKey(regionKey));
    
    if (regionsNeedingMapping.length > 0) {
      console.log(`⚠️ Found ${regionsNeedingMapping.length} regions with Mapbox IDs, attempting to map...`);
      
      const regionsWithFbKeys = await Promise.all(
        locations.regions.map(async (regionKey) => {
          // Check if key is already a valid Facebook key
          if (isValidFacebookKey(regionKey)) {
            // Already a Facebook key (from search), return as-is
            return regionKey;
          }
          
          // This is a Mapbox ID (fallback case), need to lookup Facebook key
          console.log(`🔍 Looking up Facebook key for Mapbox region ID: ${regionKey}`);
          const tempLocation = {
            key: regionKey,
            type: 'region',
            name: regionKey,
            _mapbox: { id: regionKey },
          };
          
          const fbKey = await lookupFacebookLocationKey(tempLocation, accessToken);
          
          if (fbKey && isValidFacebookKey(fbKey)) {
            console.log(`✅ Mapped region ${regionKey} → ${fbKey}`);
            return fbKey;
          } else {
            // Lookup failed - this is a problem, we can't use Mapbox ID
            console.error(`❌ Failed to map Mapbox region ID to Facebook key: ${regionKey}`);
            throw new Error(
              `Cannot map Mapbox region "${regionKey}" to Facebook location key. ` +
              `Please try selecting the region again or use a different region.`
            );
          }
        })
      );
      
      mappedLocations.regions = regionsWithFbKeys;
    } else {
      // All regions already have Facebook keys (from search)
      console.log(`✅ All ${locations.regions.length} regions already have Facebook keys`);
      mappedLocations.regions = locations.regions;
    }
  }
  
  return mappedLocations;
}

/**
 * Parse Facebook geo_locations back to our frontend locations format
 * Used for Edit Mode to populate LocationSelector
 * @param {Object} geo_locations - Facebook geo_locations object from database
 * @returns {Object} Frontend locations format
 */
export function parseGeoLocationsToFrontend(geo_locations) {
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
    console.log(`✅ Parsed ${locations.regions.length} regions`);
  }

  // Parse cities
  if (geo_locations.cities && Array.isArray(geo_locations.cities)) {
    locations.cities = geo_locations.cities.map(c => ({
      key: c.key || c,
      radius: c.radius || 20, // Default radius if not specified
      name: c.name || c.key || c, // Use name if available, fallback to key
    }));
    console.log(`✅ Parsed ${locations.cities.length} cities`);
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

/**
 * Build flexible_spec for detailed targeting (interests, behaviors, demographics)
 * Facebook API uses flexible_spec for OR logic within targeting groups
 * @param {Array} targetingItems - Array of targeting items from frontend
 *   Each item: { id: string, name: string, type: 'interest'|'behavior'|'life_event'|'family_status'|'work'|'education' }
 * @returns {Array} Facebook flexible_spec format
 * 
 * @example
 * Input: [
 *   { id: "6003107902433", name: "Shopping", type: "interest" },
 *   { id: "6002714895372", name: "Online shopping", type: "behavior" }
 * ]
 * Output: [
 *   {
 *     interests: [{ id: "6003107902433", name: "Shopping" }],
 *     behaviors: [{ id: "6002714895372", name: "Online shopping" }]
 *   }
 * ]
 */
export function buildFlexibleSpec(targetingItems) {
  if (!targetingItems || !Array.isArray(targetingItems) || targetingItems.length === 0) {
    return undefined; // Don't include flexible_spec if empty
  }

  console.log('🎯 [buildFlexibleSpec] Input:', JSON.stringify(targetingItems, null, 2));

  // Validate and filter items - only include items with valid numeric IDs
  const validItems = targetingItems.filter(item => {
    if (!item || !item.id) return false;
    // Facebook IDs are numeric
    const isValidId = /^\d+$/.test(String(item.id));
    if (!isValidId) {
      console.warn(`⚠️ [buildFlexibleSpec] Skipping invalid targeting ID: ${item.id} (${item.name})`);
    }
    return isValidId;
  });

  if (validItems.length === 0) {
    console.log('⚠️ [buildFlexibleSpec] No valid targeting items after validation');
    return undefined;
  }

  // Group items by type
  const grouped = {
    interests: [],
    behaviors: [],
    life_events: [],
    family_statuses: [],
    work_employers: [],
    work_positions: [],
    education_schools: [],
  };

  validItems.forEach(item => {
    const fbItem = { id: String(item.id), name: item.name };
    
    switch (item.type) {
      case 'interest':
        grouped.interests.push(fbItem);
        break;
      case 'behavior':
        grouped.behaviors.push(fbItem);
        break;
      case 'life_event':
        grouped.life_events.push(fbItem);
        break;
      case 'family_status':
        grouped.family_statuses.push(fbItem);
        break;
      case 'work':
      case 'employer':
        grouped.work_employers.push(fbItem);
        break;
      case 'job_title':
      case 'position':
        grouped.work_positions.push(fbItem);
        break;
      case 'education':
      case 'school':
        grouped.education_schools.push(fbItem);
        break;
      default:
        // Default to interests if type unknown
        console.warn(`⚠️ [buildFlexibleSpec] Unknown type "${item.type}" for "${item.name}", defaulting to interest`);
        grouped.interests.push(fbItem);
    }
  });

  // Build flexible_spec object - only include non-empty arrays
  const flexibleSpecItem = {};
  
  if (grouped.interests.length > 0) {
    flexibleSpecItem.interests = grouped.interests;
  }
  if (grouped.behaviors.length > 0) {
    flexibleSpecItem.behaviors = grouped.behaviors;
  }
  if (grouped.life_events.length > 0) {
    flexibleSpecItem.life_events = grouped.life_events;
  }
  if (grouped.family_statuses.length > 0) {
    flexibleSpecItem.family_statuses = grouped.family_statuses;
  }
  if (grouped.work_employers.length > 0) {
    flexibleSpecItem.work_employers = grouped.work_employers;
  }
  if (grouped.work_positions.length > 0) {
    flexibleSpecItem.work_positions = grouped.work_positions;
  }
  if (grouped.education_schools.length > 0) {
    flexibleSpecItem.education_schools = grouped.education_schools;
  }

  // If nothing was added, return undefined
  if (Object.keys(flexibleSpecItem).length === 0) {
    return undefined;
  }

  // flexible_spec is an array with one object for OR logic
  const result = [flexibleSpecItem];
  
  console.log('✅ [buildFlexibleSpec] Output:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Parse flexible_spec from Facebook format back to frontend format
 * Used for Edit Mode to populate DetailedTargetingSelector
 * @param {Array} flexibleSpec - Facebook flexible_spec array
 * @returns {Array} Frontend targeting items format
 */
export function parseFlexibleSpecToFrontend(flexibleSpec) {
  if (!flexibleSpec || !Array.isArray(flexibleSpec) || flexibleSpec.length === 0) {
    return [];
  }

  const items = [];

  flexibleSpec.forEach(specGroup => {
    // Parse interests
    if (specGroup.interests && Array.isArray(specGroup.interests)) {
      specGroup.interests.forEach(interest => {
        items.push({
          id: interest.id,
          name: interest.name,
          type: 'interest',
        });
      });
    }

    // Parse behaviors
    if (specGroup.behaviors && Array.isArray(specGroup.behaviors)) {
      specGroup.behaviors.forEach(behavior => {
        items.push({
          id: behavior.id,
          name: behavior.name,
          type: 'behavior',
        });
      });
    }

    // Parse life events
    if (specGroup.life_events && Array.isArray(specGroup.life_events)) {
      specGroup.life_events.forEach(event => {
        items.push({
          id: event.id,
          name: event.name,
          type: 'life_event',
        });
      });
    }

    // Parse family statuses
    if (specGroup.family_statuses && Array.isArray(specGroup.family_statuses)) {
      specGroup.family_statuses.forEach(status => {
        items.push({
          id: status.id,
          name: status.name,
          type: 'family_status',
        });
      });
    }

    // Parse work employers
    if (specGroup.work_employers && Array.isArray(specGroup.work_employers)) {
      specGroup.work_employers.forEach(employer => {
        items.push({
          id: employer.id,
          name: employer.name,
          type: 'work',
        });
      });
    }

    // Parse work positions
    if (specGroup.work_positions && Array.isArray(specGroup.work_positions)) {
      specGroup.work_positions.forEach(position => {
        items.push({
          id: position.id,
          name: position.name,
          type: 'job_title',
        });
      });
    }

    // Parse education schools
    if (specGroup.education_schools && Array.isArray(specGroup.education_schools)) {
      specGroup.education_schools.forEach(school => {
        items.push({
          id: school.id,
          name: school.name,
          type: 'education',
        });
      });
    }
  });

  console.log('🔄 Parsed flexible_spec to frontend format:', items);
  return items;
}

export default {
  buildTargetingPayload,
  validateTargeting,
  transformAdsetTargeting,
  parseGeoLocationsToFrontend,
  getTotalLocationCount,
  buildFlexibleSpec,
  parseFlexibleSpecToFrontend,
};

