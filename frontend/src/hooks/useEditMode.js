import { useEffect, useRef } from "react";
import axiosInstance from "../utils/axios";
import { useToast } from "./useToast";
import { extractObjectId, findIdInObject } from "../utils/wizardUtils";

/**
 * Custom hook để xử lý logic edit mode
 * ✅ CẢI THIỆN: Load FULL HIERARCHY (campaign + tất cả adsets + ads)
 */
export function useEditMode({
  mode,
  editingItem,
  selectedAccountId,
  setCampaignsList,
  setLoading,
  openProgress, // Thêm progress callbacks
  updateProgress,
}) {
  const toast = useToast();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const loadUpdateData = async () => {
      if (mode !== "edit" || !editingItem || !selectedAccountId) {
        console.log("🔍 Early return:", { mode });
        return;
      }

      // ✅ Chỉ load MỘT LẦN
      if (hasLoadedRef.current) {
        console.log("⏭️ [SKIP] Already loaded full hierarchy");
        return;
      }

      // Tìm ID trong các trường có thể có
      let rawItemId = editingItem.id || editingItem._id || editingItem.campaign_id || 
                     editingItem.adset_id || editingItem.ad_id || editingItem.creative_id || 
                     editingItem.set_id;

      // Nếu không tìm thấy ID, thử tìm trong toàn bộ object
      if (!rawItemId) {
        rawItemId = findIdInObject(editingItem);
      }

      // Mã hóa id từ ObjectId
      const itemId = extractObjectId(rawItemId);

      setLoading(true);
      
      // ✅ Mở progress popup nếu có openProgress callback
      openProgress?.({
        type: 'load',
        title: 'Đang tải dữ liệu quảng cáo',
        total: 4, // Campaign, AdSets, Ads, Creatives
      });
      
      try {
        // Determine campaign ID based on editing item type
        let campaignId = null;
        let campaignData = null;
        let adsetData = null;
        let adData = null;
        // let creativeData = null;

        updateProgress?.({ current: 1, message: 'Đang xác định campaign...' });

        if (editingItem.type === "campaign") {
          campaignId = itemId;
        } else if (editingItem.type === "adset") {
          const adsetRes = await axiosInstance.get("/api/adsets/database", {
            params: { adset_id: itemId },
          });
          const adsetJson = adsetRes.data;
          console.log("📋 Adset response:", adsetJson);
          adsetData = adsetJson.data;
          campaignId = adsetData?.campaign_id;
        } else if (editingItem.type === "ad") {
          console.log("🔍 Fetching ad data for ID:", itemId);
          const adRes = await axiosInstance.get("/api/ads/database", {
            params: { ad_id: itemId },
          });
          const adJson = adRes.data;
          console.log("📋 Ad response:", adJson);
          adData = adJson.data;

          // Ad không có campaign_id trực tiếp, cần tìm qua set_id
          if (adData && adData.set_id) {
            console.log("🔍 Ad không có campaign_id, tìm qua set_id:", adData.set_id);
            const adsetRes = await axiosInstance.get("/api/adsets/database", {
              params: { adset_id: adData.set_id },
            });
            const adsetJson = adsetRes.data;
            console.log("📋 Adset response for campaign lookup:", adsetJson);

            if (adsetJson.success && adsetJson.data) {
              campaignId = adsetJson.data.campaign_id;
              console.log("📋 Found campaign_id through adset:", campaignId);
            }
          } else {
            campaignId = adData?.campaign_id;
          }
        }

        if (!campaignId) {
          throw new Error("Không tìm thấy campaign ID");
        }

        // ========================================
        // 🎯 LOAD FULL HIERARCHY
        // ========================================
        
        // Step 1: Fetch campaign data
        updateProgress?.({ current: 1, message: 'Đang tải thông tin campaign...' });
        const campaignRes = await axiosInstance.get("/api/campaigns/database", {
          params: { campaign_id: campaignId },
        });
        campaignData = campaignRes.data.data;
        console.log('[DEBUG objective-outcome]', campaignData.objective);
        console.log("📋 Campaign loaded:", campaignData?.name);

        // Step 2: Fetch ALL adsets của campaign
        updateProgress?.({ current: 2, message: `Đang tải adsets của "${campaignData?.name}"...` });
        const adsetsRes = await axiosInstance.get("/api/adsets/database", {
          params: { campaign_id: campaignId },
        });
        const allAdsetsData = adsetsRes.data.data || [];
        console.log(`📦 Loaded ${allAdsetsData.length} adsets`);

        // Step 3: Fetch ALL ads của campaign
        updateProgress?.({ current: 3, message: `Đang tải ads (${allAdsetsData.length} adsets)...` });
        const adsRes = await axiosInstance.get("/api/ads/database", {
          params: { campaign_id: campaignId },
        });
        const allAdsData = adsRes.data.data || [];
        console.log(`📝 Loaded ${allAdsData.length} ads`);

        // Step 4: Fetch ALL creatives (parallel with error handling)
        const creativeIds = [...new Set(allAdsData.map(ad => ad.creative_id).filter(Boolean))];
        const creativesMap = {};
        
        if (creativeIds.length > 0) {
          updateProgress?.({ current: 3.5, message: `Đang tải ${creativeIds.length} creatives...` });
          const creativesPromises = creativeIds.map(id =>
            axiosInstance.get("/api/creatives/database", {
              params: { creative_id: id },
            }).catch(err => {
              console.warn(`⚠️ Failed to fetch creative ${id}:`, err.message);
              return null;
            })
          );
          
          const creativesResults = await Promise.all(creativesPromises);
          creativesResults.forEach(res => {
            if (res?.data?.data) {
              const creative = res.data.data;
              creativesMap[creative._id] = creative;
            }
          });
          console.log(`✅ Loaded ${Object.keys(creativesMap).length} creatives`);
        }

        // Step 5: Build FULL HIERARCHY structure
        const buildAdsetWithAds = (adsetDbData) => {
          const adsetAds = allAdsData
            .filter(ad => ad.set_id?.toString() === adsetDbData._id?.toString())
            .map(ad => {
              const creative = creativesMap[ad.creative_id];
              return {
                id: ad._id,
                _id: ad._id,
                external_id: ad.external_id,
                adset_id: adsetDbData._id, // ✅ THÊM adset_id để filter trong update
                name: ad.name || "Quảng cáo mới",
                status: ad.status,
                creative_id: ad.creative_id,
                page: campaignData?.page_name || "Facebook Page",
                media: creative?.object_story_spec?.link_data?.picture ? "image" : "text",
                mediaUrl: creative?.object_story_spec?.link_data?.picture || null,
                primaryText: creative?.object_story_spec?.link_data?.message || "Hãy giới thiệu về nội dung quảng cáo của bạn",
                headline: creative?.object_story_spec?.link_data?.name || "Chat trong Messenger",
                description: creative?.object_story_spec?.link_data?.description || "Khám phá dịch vụ của chúng tôi ngay!",
                cta: creative?.object_story_spec?.link_data?.call_to_action?.type || "Gửi tin nhắn",
                destinationUrl: creative?.object_story_spec?.link_data?.link || "https://fchat.vn",
                creative: creative ? {
                  name: creative.name,
                  object_story_spec: creative.object_story_spec,
                } : null,
              };
            });

          const promotedObject = adsetDbData.promoted_object || {};
          return {
            id: adsetDbData._id,
            _id: adsetDbData._id,
            external_id: adsetDbData.external_id,
            name: adsetDbData.name || "Nhóm quảng cáo mới",
            status: adsetDbData.status,
            // Prefill Facebook Page info (for AdsetStep selector)
            facebookPage: campaignData?.page_name || null,
            facebookPageId: campaignData?.page_id || null,
            facebookPageAvatar: campaignData?.page_id
              ? `https://graph.facebook.com/${campaignData.page_id}/picture?type=square`
              : null,
            budgetType: adsetDbData.daily_budget ? "daily" : "lifetime",
            budgetAmount: adsetDbData.daily_budget || adsetDbData.lifetime_budget,
            daily_budget: adsetDbData.daily_budget,
            lifetime_budget: adsetDbData.lifetime_budget,
            start_time: adsetDbData.start_time,
            end_time: adsetDbData.end_time,
            schedule: {
              start: adsetDbData.start_time
                ? new Date(adsetDbData.start_time).toISOString().split("T")[0]
                : "",
              end: adsetDbData.end_time
                ? new Date(adsetDbData.end_time).toISOString().split("T")[0]
                : "",
            },
            placement: "AUTOMATIC",
            targeting: adsetDbData.targeting || {
              location: "Việt Nam",
              ageMin: 18,
              ageMax: 65,
            },
            // Optimization / Billing / Conversion settings
            optimization_goal: adsetDbData.optimization_goal,
            conversion_event: adsetDbData.conversion_event,
            billing_event: adsetDbData.billing_event,
            traffic_destination: adsetDbData.traffic_destination || adsetDbData.destination_type || null,
            promoted_object: {
              page_id: promotedObject.page_id ?? campaignData?.page_id ?? null,
              pixel_id: promotedObject.pixel_id ?? null,
              custom_event_type: promotedObject.custom_event_type ?? null,
              application_id: promotedObject.application_id ?? null,
              object_store_url: promotedObject.object_store_url ?? null,
            },
            bid_strategy: adsetDbData.bid_strategy,
            bid_amount: adsetDbData.bid_amount,
            ads: adsetAds, // ✅ Nested ads
          };
        };

        const adsetsWithAds = allAdsetsData.map(buildAdsetWithAds);
        console.log(`✅ Built hierarchy: ${adsetsWithAds.length} adsets with ${allAdsData.length} total ads`);

        // Step 5: Update progress - Building hierarchy
        updateProgress?.({ current: 4, message: 'Đang xây dựng cấu trúc dữ liệu...' });

        // Step 6: Set FULL HIERARCHY to campaignsList
        if (campaignData && setCampaignsList) {
          const fullHierarchy = [{
            id: campaignData._id,
            _id: campaignData._id,
            external_id: campaignData.external_id,
            name: campaignData.name || "Chiến dịch mới",
            objective: campaignData.objective || "POST_ENGAGEMENT",
            status: campaignData.status || "PAUSED",
            budgetType: campaignData.daily_budget ? "CAMPAIGN" : "ADSET",
            facebookPage: campaignData.page_name || "Facebook Page",
            facebookPageId: campaignData.page_id,
            facebookPageAvatar: campaignData.page_id
              ? `https://graph.facebook.com/${campaignData.page_id}/picture?type=square`
              : null,
            daily_budget: campaignData.daily_budget,
            lifetime_budget: campaignData.lifetime_budget,
            start_time: campaignData.start_time,
            stop_time: campaignData.stop_time,
            adsets: adsetsWithAds, // ✅ Full nested structure
          }];

          setCampaignsList(fullHierarchy);
          
          hasLoadedRef.current = true; // ✅ Mark as loaded
          
          console.log("HIERARCHY loaded successfully:", {
            campaign: campaignData?.name,
            adsets: adsetsWithAds.length,
            totalAds: allAdsData.length,
          });

          // ✅ Update progress: Success
          updateProgress?.({
            status: 'success',
            current: 4,
            message: `Đã tải thành công ${adsetsWithAds.length} adsets và ${allAdsData.length} ads`,
            successCount: 1 + adsetsWithAds.length + allAdsData.length,
          });
        }

      } catch (e) {
        console.log("Failed to load update data from database:", e);
        
        // ✅ Update progress: Error
        updateProgress?.({
          status: 'error',
          message: e?.response?.status === 401 
            ? 'Phiên đăng nhập đã hết hạn' 
            : 'Không tải được dữ liệu',
          errors: [{ error: e.message || 'Unknown error' }],
        });
        
        if (e?.response?.status === 401) {
          toast.error("Phiên đăng nhập đã hết hạn", {
            description: "Vui lòng đăng nhập lại để tiếp tục",
          });
        } else {
          toast.error("Không tải được dữ liệu", {
            description: "Vui lòng thử lại hoặc kiểm tra kết nối mạng",
          });
        }
      } finally {
        setLoading(false);
      }
    };
    loadUpdateData();
    
    // ✅ Simplified dependency array (thêm openProgress, updateProgress)
  }, [mode, editingItem, selectedAccountId, setCampaignsList, setLoading, toast, openProgress, updateProgress]);
}
