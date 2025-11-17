import { useCallback, useRef, useEffect } from "react";
import axiosInstance from "../../../utils/axios";
import {
  transformCampaign,
  transformAdset,
  transformAd,
  mergeInsights,
} from "../services/adsDataService";
import {
  getCacheKey,
  isCacheValid,
  updateCacheTimestamp,
} from "../services/adsCacheService";

const BATCH_SIZE = 50;
const CACHE_TTL = 120000;

/**
 * Custom hook to manage data fetching for campaigns, adsets, and ads
 * Handles caching, insights fetching, and data transformation
 */
export function useAdsDataFetching(datasets, setDatasets, cache, setCache) {
  const cacheRef = useRef(cache);
  const datasetsRef = useRef(datasets);

  // Update refs when state changes
  useEffect(() => {
    cacheRef.current = cache;
    datasetsRef.current = datasets;
  }, [cache, datasets]);

  /**
   * Fetch insights in batches
   */
  const fetchInsightsBatch = useCallback(async (entityIds, endpoint) => {
    if (!entityIds.length) return {};
    
    const insightsMap = {};
    try {
      for (let i = 0; i < entityIds.length; i += BATCH_SIZE) {
        const batch = entityIds.slice(i, i + BATCH_SIZE);
        const { data: ins } = await axiosInstance.get(
          `${endpoint}?ids=${batch.join(',')}`
        );
        if (ins?.items?.length) {
          ins.items.forEach(it => {
            insightsMap[it.id] = it.insights || {};
          });
        }
        // Delay between batches to avoid rate limit
        if (i + BATCH_SIZE < entityIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (e) {
      console.warn(`${endpoint} insights fetch failed`, e);
    }
    return insightsMap;
  }, []);

  /**
   * Fetch campaigns for account
   */
  const fetchCampaignsForAccount = useCallback(async (accountId) => {
    if (!accountId) return;
    
    try {
      const response = await axiosInstance.get(`/api/campaigns`, {
        params: {
          account_id: accountId,
          fetch_all: true
        }
      });
      
      if (response.data) {
        const { items } = response.data;
        
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned campaigns by status:`, statusCount);
        }
        
        const mapped = items.map(transformCampaign);
        const campaignIds = mapped.map((c) => c.external_id).filter(Boolean);
        const insightsMap = await fetchInsightsBatch(campaignIds, '/api/campaigns/insights');
        
        const merged = mapped.map((c) => mergeInsights(c, insightsMap[c.external_id] || {}));
        
        setDatasets(prev => ({
          ...prev,
          campaigns: merged,
        }));
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    }
  }, [fetchInsightsBatch, setDatasets]);

  /**
   * Fetch adsets for campaign
   */
  const fetchAdsetsForCampaign = useCallback(async (campaignId, accountId) => {
    if (!campaignId || !accountId) return;
    
    const cacheKey = getCacheKey(accountId, 'adsets', campaignId);
    const currentCache = cacheRef.current;
    const currentDatasets = datasetsRef.current;
    
    const lastFetch = currentCache.lastFetch?.[cacheKey];
    if (isCacheValid(lastFetch, CACHE_TTL)) {
      const cachedAdsets = currentDatasets.adsets.filter(
        a => String(a.campaignId) === String(campaignId) && 
             a.status !== "DELETED" && 
             a.status !== "ARCHIVED"
      );
      if (cachedAdsets.length > 0) {
        console.log(`✅ Using ${cachedAdsets.length} cached adsets for campaign ${campaignId}`);
        return;
      }
    }
    
    try {
      const response = await axiosInstance.get(`/api/adsets`, {
        params: {
          campaign_id: campaignId,
          fetch_all: true
        }
      });
      
      if (response.data) {
        const { items } = response.data;
        
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned adsets by status:`, statusCount);
        }
        
        const mapped = items.map((adset) => transformAdset(adset, campaignId));
        const adsetIds = mapped.map((a) => a.external_id).filter(Boolean);
        const insightsMap = await fetchInsightsBatch(adsetIds, '/api/adsets/insights');
        
        const merged = mapped.map((a) => mergeInsights(a, insightsMap[a.external_id] || {}));
        
        // Merge: Keep adsets from other campaigns, only update this campaign
        setDatasets((prev) => {
          const otherAdsets = prev.adsets.filter(
            a => String(a.campaignId) !== String(campaignId)
          );
          return {
            ...prev,
            adsets: [...otherAdsets, ...merged]
          };
        });
        
        // Update cache
        setCache(prev => updateCacheTimestamp(prev, cacheKey));
      }
    } catch (error) {
      console.error("Error fetching adsets:", error);
    }
  }, [fetchInsightsBatch, setDatasets, setCache]);

  /**
   * Fetch ads for adset
   */
  const fetchAdsForAdset = useCallback(async (adsetId, accountId = null) => {
    if (!adsetId) return;
    
    const cacheKey = getCacheKey(accountId, 'ads', adsetId);
    const currentCache = cacheRef.current;
    const currentDatasets = datasetsRef.current;
    
    const lastFetch = currentCache.lastFetch?.[cacheKey];
    if (isCacheValid(lastFetch, CACHE_TTL)) {
      const cachedAds = currentDatasets.ads.filter(
        a => String(a.adsetId) === String(adsetId) && 
             a.status !== "DELETED" && 
             a.status !== "ARCHIVED"
      );
      if (cachedAds.length > 0) {
        console.log(`✅ Using ${cachedAds.length} cached ads for adset ${adsetId}`);
        return;
      }
    }
    
    try {
      const response = await axiosInstance.get(`/api/ads`, {
        params: {
          adset_id: adsetId,
          ...(accountId && { account_id: accountId }),
          fetch_all: true
        }
      });
      
      if (response.data) {
        const { items } = response.data;
        
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned ads by status:`, statusCount);
        }
        
        const mapped = items.map((ad) => transformAd(ad, adsetId));
        const adIds = mapped.map((a) => a.external_id).filter(Boolean);
        const insightsMap = await fetchInsightsBatch(adIds, '/api/ads/insights');
        
        const merged = mapped.map((a) => ({
          ...mergeInsights(a, insightsMap[a.external_id] || {}),
          updated_at: a.updated_at || a.updatedAt,
        }));
        
        // Merge: Keep ads from other adsets, only update this adset
        setDatasets((prev) => {
          const otherAds = prev.ads.filter(
            a => String(a.adsetId) !== String(adsetId)
          );
          return {
            ...prev,
            ads: [...otherAds, ...merged]
          };
        });
        
        // Update cache
        setCache(prev => updateCacheTimestamp(prev, cacheKey));
      }
    } catch (error) {
      console.error("Error fetching ads:", error);
    }
  }, [fetchInsightsBatch, setDatasets, setCache]);

  /**
   * Fetch all adsets for account
   */
  const fetchAllAdsetsForAccount = useCallback(async (accountId) => {
    if (!accountId) return;
    
    const cacheKey = getCacheKey(accountId, 'adsets');
    const currentCache = cacheRef.current;
    const currentDatasets = datasetsRef.current;
    
    const lastFetch = currentCache.lastFetch?.[cacheKey];
    if (isCacheValid(lastFetch, CACHE_TTL)) {
      const cachedAdsets = currentDatasets.adsets.filter(
        a => a.status !== "DELETED" && a.status !== "ARCHIVED"
      );
      if (cachedAdsets.length > 0) {
        console.log(`✅ Using ${cachedAdsets.length} cached adsets for account ${accountId}`);
        return;
      }
    }
    
    try {
      const response = await axiosInstance.get(`/api/adsets`, {
        params: {
          account_id: accountId,
          fetch_all: true
        }
      });
      
      if (response.data) {
        const { items } = response.data;
        
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned adsets by status:`, statusCount);
        }
        
        const mapped = items.map((adset) => transformAdset(adset));
        const adsetIds = mapped.map((a) => a.external_id).filter(Boolean);
        const insightsMap = await fetchInsightsBatch(adsetIds, '/api/adsets/insights');
        
        const merged = mapped.map((a) => mergeInsights(a, insightsMap[a.external_id] || {}));
        
        setDatasets((prev) => ({
          ...prev,
          adsets: merged,
        }));
        
        // Update cache
        setCache(prev => updateCacheTimestamp(prev, cacheKey));
      }
    } catch (error) {
      console.error("Error fetching adsets:", error);
    }
  }, [fetchInsightsBatch, setDatasets, setCache]);

  /**
   * Fetch all ads for account
   */
  const fetchAllAdsForAccount = useCallback(async (accountId) => {
    if (!accountId) return;
    
    const cacheKey = getCacheKey(accountId, 'ads');
    const currentCache = cacheRef.current;
    const currentDatasets = datasetsRef.current;
    
    const lastFetch = currentCache.lastFetch?.[cacheKey];
    if (isCacheValid(lastFetch, CACHE_TTL)) {
      const cachedAds = currentDatasets.ads.filter(
        a => a.status !== "DELETED" && a.status !== "ARCHIVED"
      );
      if (cachedAds.length > 0) {
        console.log(`✅ Using ${cachedAds.length} cached ads for account ${accountId}`);
        return;
      }
    }
    
    try {
      const response = await axiosInstance.get(`/api/ads`, {
        params: {
          account_id: accountId,
          fetch_all: true
        }
      });
      
      if (response.data) {
        const { items } = response.data;
        
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned ads by status:`, statusCount);
        }
        
        const mapped = items.map((ad) => transformAd(ad));
        const adIds = mapped.map((a) => a.external_id).filter(Boolean);
        const insightsMap = await fetchInsightsBatch(adIds, '/api/ads/insights');
        
        const merged = mapped.map((a) => ({
          ...mergeInsights(a, insightsMap[a.external_id] || {}),
          updated_at: a.updated_at || a.updatedAt,
        }));
        
        setDatasets((prev) => ({ ...prev, ads: merged }));
        
        // Update cache
        setCache(prev => updateCacheTimestamp(prev, cacheKey));
      }
    } catch (error) {
      console.error("Error fetching ads:", error);
    }
  }, [fetchInsightsBatch, setDatasets, setCache]);

  return {
    fetchCampaignsForAccount,
    fetchAdsetsForCampaign,
    fetchAdsForAdset,
    fetchAllAdsetsForAccount,
    fetchAllAdsForAccount,
  };
}

