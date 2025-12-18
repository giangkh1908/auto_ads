import { useCallback, useRef, useEffect } from "react";
import axiosInstance from "../../utils/api/axios";
import { getSyncCacheKey, isCacheValid, updateCacheTimestamp } from "../../services/ads/adsCacheService";

// Cache TTL: 30 phút cho auto-sync (tránh rate limit)
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const SYNC_COOLDOWN = 10 * 60 * 1000; // 10 phút cooldown giữa các lần sync

// LocalStorage keys
const STORAGE_KEY_LAST_SYNC = 'ads_last_sync';
const STORAGE_KEY_ENTITY_CACHE = 'ads_entity_cache';

/**
 * Lấy last sync time từ localStorage
 */
function getStoredLastSync(accountId) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
    if (stored) {
      const data = JSON.parse(stored);
      return data[accountId] || null;
    }
  } catch (e) {
    console.warn('Error reading sync cache from localStorage:', e);
  }
  return null;
}

/**
 * Lưu last sync time vào localStorage
 */
function setStoredLastSync(accountId, timestamp) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
    const data = stored ? JSON.parse(stored) : {};
    data[accountId] = timestamp;
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, JSON.stringify(data));
  } catch (e) {
    console.warn('Error saving sync cache to localStorage:', e);
  }
}

/**
 * Lấy entity cache từ localStorage
 */
function getStoredEntityCache(accountId, entityType) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ENTITY_CACHE);
    if (stored) {
      const data = JSON.parse(stored);
      const key = `${accountId}_${entityType}`;
      return data[key] || null;
    }
  } catch (e) {
    console.warn('Error reading entity cache from localStorage:', e);
  }
  return null;
}

/**
 * Lưu entity cache vào localStorage
 */
function setStoredEntityCache(accountId, entityType, timestamp) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ENTITY_CACHE);
    const data = stored ? JSON.parse(stored) : {};
    const key = `${accountId}_${entityType}`;
    data[key] = timestamp;
    localStorage.setItem(STORAGE_KEY_ENTITY_CACHE, JSON.stringify(data));
  } catch (e) {
    console.warn('Error saving entity cache to localStorage:', e);
  }
}

/**
 * Custom hook to manage sync with Facebook
 * Handles batch sync optimization and cache management
 * Sử dụng localStorage để persist cache qua page refresh
 */
export function useAdsSync(cache, setCache, activeTab) {
  const activeTabRef = useRef(activeTab);
  const cacheRef = useRef(cache);
  const syncingRef = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    activeTabRef.current = activeTab;
    cacheRef.current = cache;
  }, [activeTab, cache]);

  const syncData = useCallback(async (accountId, forceSync = false, syncTypes = null) => {
    if (!accountId) return;
    
    if (syncingRef.current) {
      console.log("⏭️ Skip sync - already syncing");
      return;
    }
    
    const now = Date.now();
    const currentActiveTab = activeTabRef.current;
    
    // Check localStorage cho last sync time (persist qua page refresh)
    const storedLastSync = getStoredLastSync(accountId);
    if (!forceSync && storedLastSync && (now - storedLastSync) < SYNC_COOLDOWN) {
      console.log(`⏭️ Skip sync - synced ${Math.round((now - storedLastSync) / 1000)}s ago (cooldown: ${SYNC_COOLDOWN / 1000}s)`);
      return;
    }
    
    // Auto-determine syncTypes based on activeTab if not provided
    // Phải sync theo thứ tự: campaigns → adsets → ads để đảm bảo parent-child relationship
    if (!syncTypes) {
      if (currentActiveTab === "campaigns") {
        syncTypes = ['campaigns'];
      } else if (currentActiveTab === "adsets") {
        // Cần sync campaigns trước để adsets có thể link đúng
        syncTypes = ['campaigns', 'adsets'];
      } else if (currentActiveTab === "ads") {
        // Cần sync campaigns + adsets trước để ads có thể link đúng
        syncTypes = ['campaigns', 'adsets', 'ads'];
      } else {
        syncTypes = ['campaigns'];
      }
    }
    
    // Check cache for each entity type (dùng localStorage)
    // forceSync: chỉ force sync entity type hiện tại, parents vẫn dùng cache nếu có
    const needsSync = syncTypes.filter(type => {
      // Nếu forceSync, chỉ force sync entity type của tab hiện tại
      // Parents (campaigns, adsets) vẫn check cache để tránh gọi API không cần thiết
      if (forceSync) {
        const currentEntityType = currentActiveTab === "campaigns" ? "campaigns" 
          : currentActiveTab === "adsets" ? "adsets" : "ads";
        
        // Force sync entity type hiện tại
        if (type === currentEntityType) return true;
        
        // Parents: chỉ sync nếu chưa có trong cache (TTL dài hơn cho parents)
        const PARENT_CACHE_TTL = 60 * 60 * 1000; // 1 giờ cho parents khi forceSync
        const storedEntitySync = getStoredEntityCache(accountId, type);
        return !storedEntitySync || (now - storedEntitySync) > PARENT_CACHE_TTL;
      }
      
      // Normal sync: check localStorage cache
      const storedEntitySync = getStoredEntityCache(accountId, type);
      return !storedEntitySync || (now - storedEntitySync) > CACHE_TTL;
    });
    
    if (needsSync.length === 0) {
      console.log("⏭️ Skip sync - all entities cached");
      return;
    }
    
    syncingRef.current = true;
    
    // Timeout dài hơn cho sync vì pagination có thể mất nhiều thời gian
    const SYNC_TIMEOUT = 180000; // 3 phút cho mỗi entity type
    
    try {
      // Sequential sync to ensure parent-child relationships (Campaign -> AdSet -> Ad)
      // Chỉ sync những gì cần thiết (không sync tất cả khi forceSync)
      
      // 1. Campaigns
      if (needsSync.includes('campaigns')) {
        console.log("🔄 Syncing Campaigns...");
        await axiosInstance.get("/api/campaigns/live", { 
          params: { account_id: accountId },
          timeout: SYNC_TIMEOUT
        });
      }

      // 2. AdSets
      if (needsSync.includes('adsets')) {
        console.log("🔄 Syncing AdSets...");
        await axiosInstance.get("/api/adsets/live", { 
          params: { account_id: accountId },
          timeout: SYNC_TIMEOUT
        });
      }

      // 3. Ads
      if (needsSync.includes('ads')) {
        console.log("🔄 Syncing Ads...");
        await axiosInstance.get("/api/ads/live", { 
          params: { account_id: accountId },
          timeout: SYNC_TIMEOUT
        });
      }
      
      console.log(`✅ Live sync completed for: ${needsSync.join(', ')}`);
      
      // Lưu vào localStorage để persist qua page refresh
      setStoredLastSync(accountId, now);
      needsSync.forEach(type => {
        setStoredEntityCache(accountId, type, now);
      });
      
      // Update React state cache (cho session hiện tại)
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
      const errorResponse = error.response?.data;
      console.error("Live sync error:", errorResponse || error.message);
      
      // Don't throw error to prevent breaking the UI
      // User can still use the app, data will be fetched from DB
    } finally {
      syncingRef.current = false;
    }
  }, [setCache]);

  return { syncData };
}

