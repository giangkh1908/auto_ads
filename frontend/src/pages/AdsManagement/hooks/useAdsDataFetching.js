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
export function useAdsDataFetching(
  datasets,
  setDatasets,
  cache,
  setCache,
  setInitialSyncState
) {
  const cacheRef = useRef(cache);
  const datasetsRef = useRef(datasets);
  const setDatasetsRef = useRef(setDatasets);

  // Update refs when state changes
  useEffect(() => {
    cacheRef.current = cache;
    datasetsRef.current = datasets;
    setDatasetsRef.current = setDatasets;
  }, [cache, datasets, setDatasets]);

  /**
   * Fetch insights in batches
   */
  const fetchInsightsBatch = useCallback(async (entityIds, endpoint, signal = null) => {
    if (!entityIds.length) return {};
    
    const insightsMap = {};
    try {
      for (let i = 0; i < entityIds.length; i += BATCH_SIZE) {
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        
        const batch = entityIds.slice(i, i + BATCH_SIZE);
        try {
          const { data: ins } = await axiosInstance.get(
            `${endpoint}?ids=${batch.join(',')}`,
            { signal }
          );
          if (ins?.items?.length) {
            ins.items.forEach(it => {
              if (it.id && it.insights) {
                insightsMap[it.id] = it.insights || {};
              }
            });
          }
        } catch (batchError) {
          // Nếu batch request fail (rate limit, GraphBatchException), skip batch này
          // Không throw để tiếp tục với các batch khác
          const errorData = batchError.response?.data;
          const fbError = errorData?.detail?.error || errorData?.error;
          
          if (fbError?.type === 'GraphBatchException' || 
              fbError?.code === 4 || 
              fbError?.code === 17 ||
              fbError?.code === 100) {
            // Skip batch này, tiếp tục với batch tiếp theo (không log để tránh spam)
            continue;
          }
          // Nếu là lỗi khác, skip batch này nhưng không log
          if (batchError.name === 'AbortError' || batchError.name === 'CanceledError') {
            throw batchError;
          }
          // Skip batch này, tiếp tục
          continue;
        }
        
        // Delay between batches to avoid rate limit
        if (i + BATCH_SIZE < entityIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Tăng delay lên 100ms
        }
      }
    } catch (e) {
      if (e.name === 'AbortError' || e.name === 'CanceledError') {
        throw e;
      }
      // Không log error ở đây vì đã handle trong loop
    }
    return insightsMap;
  }, []);

  /**
   * Fetch insights for visible items only (lazy load)
   */
  const fetchInsightsForVisibleItems = useCallback(async (
    visibleItems,
    endpoint,
    signal = null
  ) => {
    if (!visibleItems || visibleItems.length === 0) return {};
    
    const entityIds = visibleItems
      .filter(item => {
        // Chỉ fetch insights cho items chưa có insights hoặc insights rỗng
        return item.external_id && (!item.insights || Object.keys(item.insights || {}).length === 0);
      })
      .map(item => item.external_id)
      .filter(Boolean);
    
    if (entityIds.length === 0) return {};
    
    const insightsMap = await fetchInsightsBatch(entityIds, endpoint, signal);
    
    // Update datasets với insights mới
    if (Object.keys(insightsMap).length > 0) {
      setDatasetsRef.current(prev => {
        const key = endpoint.includes('/ads/insights') ? 'ads' : 
                   endpoint.includes('/adsets/insights') ? 'adsets' : 'campaigns';
        
        return {
          ...prev,
          [key]: prev[key].map(item => {
            if (insightsMap[item.external_id]) {
              return mergeInsights(item, insightsMap[item.external_id]);
            }
            return item;
          }),
        };
      });
    }
    
    return insightsMap;
  }, [fetchInsightsBatch]);

  /**
   * Fetch campaigns for account
   */
  const fetchCampaignsForAccount = useCallback(async (accountId, signal = null) => {
    if (!accountId) return;
    
    try {
      const response = await axiosInstance.get(`/api/campaigns`, {
        params: {
          account_id: accountId,
          fetch_all: true
        },
        signal
      });
      
      if (signal?.aborted) return;
      
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
        
        // Progressive loading: Hiển thị data ngay, insights load sau
        setDatasets(prev => ({
          ...prev,
          campaigns: mapped,
        }));
        
        // Fetch insights async (không block UI)
        const campaignIds = mapped.map((c) => c.external_id).filter(Boolean);
        if (campaignIds.length > 0) {
          fetchInsightsBatch(campaignIds, '/api/campaigns/insights', signal)
            .then(insightsMap => {
              if (signal?.aborted) return;
              
              setDatasets(prev => ({
                ...prev,
                campaigns: prev.campaigns.map(c => 
                  mergeInsights(c, insightsMap[c.external_id] || {})
                ),
              }));
            })
            .catch(err => {
              if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.warn('Campaigns insights fetch failed, but data is displayed', err);
              }
            });
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      console.error("Error fetching campaigns:", error);
    }
  }, [fetchInsightsBatch, setDatasets]);

  /**
   * Fetch adsets for campaign
   */
  const fetchAdsetsForCampaign = useCallback(async (campaignId, accountId, signal = null) => {
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
        },
        signal
      });
      
      if (signal?.aborted) return;
      
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
        
        // Progressive loading: Hiển thị data ngay, insights load sau
        setDatasets((prev) => {
          const otherAdsets = prev.adsets.filter(
            a => String(a.campaignId) !== String(campaignId)
          );
          return {
            ...prev,
            adsets: [...otherAdsets, ...mapped]
          };
        });
        
        // Fetch insights async (không block UI)
        const adsetIds = mapped.map((a) => a.external_id).filter(Boolean);
        if (adsetIds.length > 0) {
          fetchInsightsBatch(adsetIds, '/api/adsets/insights', signal)
            .then(insightsMap => {
              if (signal?.aborted) return;
              
              setDatasets((prev) => {
                const otherAdsets = prev.adsets.filter(
                  a => String(a.campaignId) !== String(campaignId)
                );
                const updatedAdsets = prev.adsets
                  .filter(a => String(a.campaignId) === String(campaignId))
                  .map(a => mergeInsights(a, insightsMap[a.external_id] || {}));
                
                return {
                  ...prev,
                  adsets: [...otherAdsets, ...updatedAdsets]
                };
              });
            })
            .catch(err => {
              if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.warn('Adsets insights fetch failed, but data is displayed', err);
              }
            });
        }
        
        // Update cache
        setCache(prev => updateCacheTimestamp(prev, cacheKey));
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      console.error("Error fetching adsets:", error);
    }
  }, [fetchInsightsBatch, setDatasets, setCache]);

  /**
   * Fetch ads for adset
   */
  const fetchAdsForAdset = useCallback(async (adsetId, accountId = null, signal = null) => {
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
        },
        signal
      });
      
      if (signal?.aborted) return;
      
      if (response.data) {
        const { items } = response.data;
        
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned ads by status:`, statusCount);
        }
        
        const mapped = items.map((ad) => ({
          ...transformAd(ad, adsetId),
          updated_at: ad.updated_at || ad.updatedAt,
        }));
        
        // Progressive loading: Hiển thị data ngay, insights load sau
        setDatasets((prev) => {
          const otherAds = prev.ads.filter(
            a => String(a.adsetId) !== String(adsetId)
          );
          return {
            ...prev,
            ads: [...otherAds, ...mapped]
          };
        });
        
        // Fetch insights async (không block UI)
        const adIds = mapped.map((a) => a.external_id).filter(Boolean);
        if (adIds.length > 0) {
          fetchInsightsBatch(adIds, '/api/ads/insights', signal)
            .then(insightsMap => {
              if (signal?.aborted) return;
              
              setDatasets((prev) => {
                const otherAds = prev.ads.filter(
                  a => String(a.adsetId) !== String(adsetId)
                );
                const updatedAds = prev.ads
                  .filter(a => String(a.adsetId) === String(adsetId))
                  .map(a => mergeInsights(a, insightsMap[a.external_id] || {}));
                
                return {
                  ...prev,
                  ads: [...otherAds, ...updatedAds]
                };
              });
            })
            .catch(err => {
              if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.warn('Ads insights fetch failed, but data is displayed', err);
              }
            });
        }
        
        // Update cache
        setCache(prev => updateCacheTimestamp(prev, cacheKey));
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      console.error("Error fetching ads:", error);
    }
  }, [fetchInsightsBatch, setDatasets, setCache]);

  /**
   * Fetch all adsets for account
   */
  const fetchAllAdsetsForAccount = useCallback(async (accountId, signal = null) => {
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
        },
        signal
      });
      
      if (signal?.aborted) return;
      
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
        
        // Progressive loading: Hiển thị data ngay, insights load sau
        setDatasets((prev) => ({
          ...prev,
          adsets: mapped,
        }));
        
        // Fetch insights async (không block UI)
        const adsetIds = mapped.map((a) => a.external_id).filter(Boolean);
        if (adsetIds.length > 0) {
          fetchInsightsBatch(adsetIds, '/api/adsets/insights', signal)
            .then(insightsMap => {
              if (signal?.aborted) return;
              
              setDatasets((prev) => ({
                ...prev,
                adsets: prev.adsets.map(a => 
                  mergeInsights(a, insightsMap[a.external_id] || {})
                ),
              }));
            })
            .catch(err => {
              if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.warn('Adsets insights fetch failed, but data is displayed', err);
              }
            });
        }
        
        // Update cache
        setCache(prev => updateCacheTimestamp(prev, cacheKey));
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      console.error("Error fetching adsets:", error);
    }
  }, [fetchInsightsBatch, setDatasets, setCache]);

  /**
   * Fetch all ads for account
   */
  const fetchAllAdsForAccount = useCallback(async (accountId, signal = null) => {
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
        },
        signal
      });
      
      if (signal?.aborted) return;
      
      if (response.data) {
        if (response.data.status === "initial_sync") {
          if (setInitialSyncState) {
            setInitialSyncState({
              isInitialSync: true,
              message:
                response.data.message ||
                "Hệ thống đang tải dữ liệu lần đầu. Vui lòng refresh sau 15-30s.",
            });
          }
          return;
        }

        if (setInitialSyncState) {
          setInitialSyncState({
            isInitialSync: false,
            message: "",
          });
        }

        const { items } = response.data;
        
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned ads by status:`, statusCount);
        }
        
        const mapped = items.map((ad) => ({
          ...transformAd(ad),
          updated_at: ad.updated_at || ad.updatedAt,
        }));
        
        // Progressive loading: Hiển thị data ngay, insights load sau
        setDatasets((prev) => ({ ...prev, ads: mapped }));
        
        // Fetch insights async (không block UI)
        const adIds = mapped.map((a) => a.external_id).filter(Boolean);
        if (adIds.length > 0) {
          fetchInsightsBatch(adIds, '/api/ads/insights', signal)
            .then(insightsMap => {
              if (signal?.aborted) return;
              
              setDatasets((prev) => ({
                ...prev,
                ads: prev.ads.map(a => 
                  mergeInsights(a, insightsMap[a.external_id] || {})
                ),
              }));
            })
            .catch(err => {
              if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.warn('Ads insights fetch failed, but data is displayed', err);
              }
            });
        }
        
        // Update cache
        setCache(prev => updateCacheTimestamp(prev, cacheKey));
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      console.error("Error fetching ads:", error);
    }
  }, [fetchInsightsBatch, setDatasets, setCache]);

  return {
    fetchCampaignsForAccount,
    fetchAdsetsForCampaign,
    fetchAdsForAdset,
    fetchAllAdsetsForAccount,
    fetchAllAdsForAccount,
    fetchInsightsForVisibleItems,
  };
}

