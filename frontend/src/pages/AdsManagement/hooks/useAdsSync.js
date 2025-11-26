import { useCallback, useRef, useEffect } from "react";
import axiosInstance from "../../../utils/axios";
import { getSyncCacheKey, isCacheValid, updateCacheTimestamp } from "../services/adsCacheService";

const CACHE_TTL = 120000; // 120 seconds

/**
 * Custom hook to manage sync with Facebook
 * Handles batch sync optimization and cache management
 */
export function useAdsSync(cache, setCache, activeTab) {
  const activeTabRef = useRef(activeTab);
  const cacheRef = useRef(cache);

  // Update refs when state changes
  useEffect(() => {
    activeTabRef.current = activeTab;
    cacheRef.current = cache;
  }, [activeTab, cache]);

  const syncData = useCallback(async (accountId, forceSync = false, syncTypes = null) => {
    if (!accountId) return;
    
    const now = Date.now();
    const currentActiveTab = activeTabRef.current;
    const currentCache = cacheRef.current;
    
    // Auto-determine syncTypes based on activeTab if not provided
    if (!syncTypes) {
      if (currentActiveTab === "campaigns") {
        syncTypes = ['campaigns'];
      } else if (currentActiveTab === "adsets") {
        syncTypes = ['campaigns', 'adsets'];
      } else if (currentActiveTab === "ads") {
        syncTypes = ['campaigns', 'adsets', 'ads'];
      } else {
        syncTypes = ['campaigns', 'adsets', 'ads'];
      }
    }
    
    // Check cache for each entity type
    const needsSync = syncTypes.filter(type => {
      if (forceSync) return true;
      const cacheKey = getSyncCacheKey(accountId, type);
      const lastSync = currentCache.lastFetch?.[cacheKey];
      return !isCacheValid(lastSync, CACHE_TTL);
    });
    
    if (needsSync.length === 0) {
      console.log("⏭️ Skip sync - all entities cached");
      return;
    }
    
    try {
      // Call new unified entity sync API (backend will auto-resolve access token)
      await axiosInstance.post("/api/sync/entities", {
        accountId: accountId,
      });
      
      console.log(`✅ Entity sync completed (${needsSync.length} entities needed: ${needsSync.join(', ')})`);
      
      // Update cache for all synced entity types
      setCache(prev => {
        let updatedCache = { ...prev.lastFetch };
        needsSync.forEach(type => {
          const cacheKey = getSyncCacheKey(accountId, type);
          updatedCache = updateCacheTimestamp({ ...prev, lastFetch: updatedCache }, cacheKey, now).lastFetch;
        });
        return {
          ...prev,
          lastSync: now,
          lastFetch: updatedCache
        };
      });
    } catch (error) {
      console.error("Sync error:", error);
      // Don't throw error to prevent breaking the UI
      // User can still use the app, data will be fetched from DB
    }
  }, [cache, setCache]);

  return { syncData };
}

