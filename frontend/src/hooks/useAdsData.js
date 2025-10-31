import { useState, useCallback, useRef } from 'react';
import axiosInstance from '../utils/axios';

/**
 * Custom hook để quản lý data fetching cho Campaigns, AdSets, và Ads
 * Xử lý: sync, fetch, cache, data transformation
 */
export function useAdsData() {
  const [datasets, setDatasets] = useState({
    campaigns: [],
    adsets: [],
    ads: []
  });
  
  const [loading, setLoading] = useState(false);
  
  // ✅ Dùng useRef thay vì useState để tránh infinite loop
  const cacheRef = useRef({
    lastSync: null,
    lastFetch: {}
  });

  /**
   * Transform campaign data from API
   */
  const transformCampaign = useCallback((campaign) => ({
    ...campaign,
    id: campaign._id || campaign.id || campaign.external_id,
    external_id: campaign.external_id,
    isChecked: false,
    enabled: campaign.status === 'ACTIVE' || campaign.effective_status === 'ACTIVE',
    budget: campaign.daily_budget || campaign.lifetime_budget || 0,
    start_time: campaign.start_time,
    end_time: campaign.stop_time,
    objective: campaign.objective,
    buying_type: campaign.buying_type,
    updated_at: campaign.updated_at || campaign.updatedAt,
    creator_name: campaign.created_by?.full_name || campaign.created_by?.email || 'Không rõ'
  }), []);

  /**
   * Transform adset data from API
   */
  const transformAdset = useCallback((adset, campaignId) => ({
    ...adset,
    id: adset._id || adset.id || adset.external_id,
    external_id: adset.external_id,
    campaignId: campaignId || adset.campaign_id,
    isChecked: false,
    enabled: adset.status === 'ACTIVE' || adset.effective_status === 'ACTIVE',
    budget: adset.daily_budget || adset.lifetime_budget || 0,
    start_time: adset.start_time,
    end_time: adset.end_time,
    targeting: adset.targeting || {},
    optimization_goal: adset.optimization_goal,
    bid_strategy: adset.bid_strategy,
    bid_amount: adset.bid_amount,
    updated_at: adset.updated_at || adset.updatedAt,
    creator_name: adset.created_by?.full_name || adset.created_by?.email || 'Không rõ'
  }), []);

  /**
   * Transform ad data from API
   */
  const transformAd = useCallback((ad, adsetId) => ({
    ...ad,
    id: ad._id || ad.id || ad.external_id,
    external_id: ad.external_id,
    adsetId: adsetId || ad.adset_id || ad.set_id,
    isChecked: false,
    enabled: ad.status === 'ACTIVE' || ad.effective_status === 'ACTIVE',
    budget: 0,
    updated_at: ad.updated_at || ad.updatedAt,
    creator_name: ad.created_by?.full_name || ad.created_by?.email || 'Không rõ'
  }), []);

  /**
   * Sync data từ Facebook
   * ✅ Dùng useRef để tránh infinite loop
   */
  const syncData = useCallback(async (accountId, forceSync = false) => {
    if (!accountId) return;
    
    const now = Date.now();
    const lastSync = cacheRef.current.lastSync; // ← Đọc từ ref
    
    // Chỉ sync nếu chưa sync trong 30 giây hoặc force sync
    if (!forceSync && lastSync && (now - lastSync) < 30000) {
      console.log('⏭️ Skip sync - cached recently');
      return;
    }
    
    try {
      await Promise.all([
        axiosInstance.get(`/api/campaigns/sync?account_id=${accountId}`),
        axiosInstance.get(`/api/adsets/sync?account_id=${accountId}`),
        axiosInstance.get(`/api/ads/sync?account_id=${accountId}`)
      ]);
      
      // ✅ Update ref (không trigger re-render)
      cacheRef.current.lastSync = now;
      console.log('✅ Sync completed at', new Date(now).toLocaleTimeString());
    } catch (error) {
      console.error('Sync error:', error);
    }
  }, []); // ← EMPTY dependency array - không bao giờ recreate

  /**
   * Fetch campaigns
   */
  const fetchCampaigns = useCallback(async (accountId, pagination) => {
    if (!accountId) return null;
    
    setLoading(true);
    try {
      const response = await axiosInstance.get('/api/campaigns', {
        params: {
          account_id: accountId,
          page: pagination.page,
          limit: pagination.limit
        }
      });

      if (response.data) {
        const { items, total, pages } = response.data;
        const transformedItems = items.map(campaign => transformCampaign(campaign));
        
        setDatasets(prev => ({
          ...prev,
          campaigns: transformedItems
        }));

        return {
          items: transformedItems,
          pagination: { total, pages, page: pagination.page }
        };
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [transformCampaign]);

  /**
   * Fetch adsets
   */
  const fetchAdsets = useCallback(async (params, pagination) => {
    if (!params.account_id && !params.campaign_id) return null;
    
    setLoading(true);
    try {
      const response = await axiosInstance.get('/api/adsets', {
        params: {
          ...params,
          page: pagination.page,
          limit: pagination.limit
        }
      });

      if (response.data) {
        const { items, total, pages } = response.data;
        const transformedItems = items.map(adset => 
          transformAdset(adset, params.campaign_id)
        );
        
        setDatasets(prev => ({
          ...prev,
          adsets: transformedItems
        }));

        return {
          items: transformedItems,
          pagination: { total, pages, page: pagination.page }
        };
      }
    } catch (error) {
      console.error('Error fetching adsets:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [transformAdset]);

  /**
   * Fetch ads
   */
  const fetchAds = useCallback(async (params, pagination) => {
    if (!params.account_id && !params.adset_id) return null;
    
    setLoading(true);
    try {
      const response = await axiosInstance.get('/api/ads', {
        params: {
          ...params,
          page: pagination.page,
          limit: pagination.limit
        }
      });

      if (response.data) {
        const { items, total, pages } = response.data;
        const mapped = items.map(ad => transformAd(ad, params.adset_id));

        // Fetch insights for ads
        const adIds = mapped.map(a => a.external_id).filter(Boolean);
        let insightsMap = {};
        
        if (adIds.length > 0) {
          try {
            const { data: ins } = await axiosInstance.get(
              `/api/ads/insights?ids=${adIds.join(',')}`
            );
            if (ins?.items?.length) {
              insightsMap = ins.items.reduce((acc, it) => {
                acc[it.id] = it.insights || {};
                return acc;
              }, {});
            }
          } catch (e) {
            console.warn('Insights fetch failed', e);
          }
        }

        // Merge insights với ads data
        const merged = mapped.map(a => {
          const ins = insightsMap[a.external_id] || {};
          const actions = Array.isArray(ins.actions) ? ins.actions : [];
          const results = actions.reduce((sum, act) => sum + (Number(act.value) || 0), 0);
          
          return {
            ...a,
            impressions: ins.impressions || 0,
            reach: ins.reach || 0,
            results,
            quality: ins.quality_ranking || '-'
          };
        });
        
        setDatasets(prev => ({
          ...prev,
          ads: merged
        }));

        return {
          items: merged,
          pagination: { total, pages, page: pagination.page }
        };
      }
    } catch (error) {
      console.error('Error fetching ads:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [transformAd]);

  /**
   * Fetch ALL data (campaigns, adsets, ads) một lần
   * Dùng cho client-side pagination
   */
  const fetchAllData = useCallback(async (accountId) => {
    if (!accountId) return;
    
    setLoading(true);
    console.log('🔄 Fetching all data for account:', accountId);
    
    try {
      // Fetch tất cả data với limit lớn (không phân trang)
      const [campaignsRes, adsetsRes, adsRes] = await Promise.all([
        axiosInstance.get('/api/campaigns', {
          params: { account_id: accountId, page: 1, limit: 9999 }
        }),
        axiosInstance.get('/api/adsets', {
          params: { account_id: accountId, page: 1, limit: 9999 }
        }),
        axiosInstance.get('/api/ads', {
          params: { account_id: accountId, page: 1, limit: 9999 }
        })
      ]);

      // Transform campaigns
      const campaigns = (campaignsRes.data?.items || []).map(c => transformCampaign(c));
      
      // Transform adsets
      const adsets = (adsetsRes.data?.items || []).map(a => transformAdset(a));
      
      // Transform ads
      const adsItems = (adsRes.data?.items || []).map(a => transformAd(a));
      
      // Fetch insights for all ads
      const adIds = adsItems.map(a => a.external_id).filter(Boolean);
      let insightsMap = {};
      
      if (adIds.length > 0) {
        try {
          const { data: ins } = await axiosInstance.get(
            `/api/ads/insights?ids=${adIds.join(',')}`
          );
          if (ins?.items?.length) {
            insightsMap = ins.items.reduce((acc, it) => {
              acc[it.id] = it.insights || {};
              return acc;
            }, {});
          }
        } catch (e) {
          console.warn('⚠️ Insights fetch failed', e);
        }
      }

      // Merge insights with ads
      const ads = adsItems.map(a => {
        const ins = insightsMap[a.external_id] || {};
        const actions = Array.isArray(ins.actions) ? ins.actions : [];
        const results = actions.reduce((sum, act) => sum + (Number(act.value) || 0), 0);
        
        return {
          ...a,
          impressions: ins.impressions || 0,
          reach: ins.reach || 0,
          results,
          quality: ins.quality_ranking || '-'
        };
      });

      // Update all datasets
      setDatasets({
        campaigns,
        adsets,
        ads
      });

      console.log('✅ Fetched all data:', {
        campaigns: campaigns.length,
        adsets: adsets.length,
        ads: ads.length
      });

      return { campaigns, adsets, ads };
    } catch (error) {
      console.error('❌ Error fetching all data:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [transformCampaign, transformAdset, transformAd]);

  /**
   * Clear all datasets
   */
  const clearDatasets = useCallback(() => {
    setDatasets({
      campaigns: [],
      adsets: [],
      ads: []
    });
  }, []);

  return {
    datasets,
    setDatasets,
    loading,
    syncData,
    fetchCampaigns,
    fetchAdsets,
    fetchAds,
    fetchAllData, // ← NEW: Fetch tất cả data 1 lần
    clearDatasets
  };
}

