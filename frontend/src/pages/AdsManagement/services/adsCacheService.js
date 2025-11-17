/**
 * Cache service for Ads Management
 * Handles cache key generation, TTL management, and cache invalidation
 */

const CACHE_TTL = 120000; // 120 seconds

/**
 * Generate cache key for entity fetch
 */
export const getCacheKey = (accountId, entityType, contextId = null) => {
  if (contextId) {
    return `${entityType}_${contextId}_${accountId}`;
  }
  return `${entityType}_all_${accountId}`;
};

/**
 * Generate cache key for sync
 */
export const getSyncCacheKey = (accountId, entityType) => {
  return `${accountId}_${entityType}`;
};

/**
 * Check if cache is valid
 */
export const isCacheValid = (lastFetch, ttl = CACHE_TTL) => {
  if (!lastFetch) return false;
  return (Date.now() - lastFetch) < ttl;
};

/**
 * Invalidate cache for entity type and related entities
 */
export const invalidateCache = (cache, accountId, entityType) => {
  const updatedCache = { ...cache.lastFetch };
  const cacheKey = getSyncCacheKey(accountId, entityType);
  delete updatedCache[cacheKey];

  // Invalidate related entities
  if (entityType === "campaigns") {
    Object.keys(updatedCache).forEach(k => {
      if (k.includes("adsets") || k.includes("ads")) {
        delete updatedCache[k];
      }
    });
  } else if (entityType === "adsets") {
    Object.keys(updatedCache).forEach(k => {
      if (k.includes("ads")) {
        delete updatedCache[k];
      }
    });
  }

  return {
    ...cache,
    lastFetch: updatedCache
  };
};

/**
 * Update cache timestamp
 */
export const updateCacheTimestamp = (cache, key, timestamp = Date.now()) => {
  return {
    ...cache,
    lastFetch: {
      ...cache.lastFetch,
      [key]: timestamp
    }
  };
};

