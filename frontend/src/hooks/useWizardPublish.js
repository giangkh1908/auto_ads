import { useState } from "react";
import { useToast } from "./useToast";
import {
  publishAdsWizard,
  updateAdsWizard,
} from "../services/adsWizardService";
import { buildPayload } from "../utils/wizardUtils";
import {
  FB_OBJECTIVE_MAP,
  FB_ADSET_DEFAULTS_BY_OBJECTIVE,
} from "../constants/wizardConstants";
import axiosInstance from "../utils/axios";

/**
 * Custom hook để xử lý logic publish/update quảng cáo
 */
export function useWizardPublish() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const toast = useToast();

  // Sequential Publish Logic - Xử lý từng campaign một cách tuần tự
  const handleSmartPublish = async ({
    campaignsList,
    selectedAccountId,
    mode,
    onSuccess,
    onClose,
  }) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log("📝 Using Sequential API for all campaigns");

      let totalSuccessCount = 0;
      let totalAds = 0;

      // Đếm tổng số ads trong tất cả campaigns
      campaignsList.forEach((campaign) => {
        campaign.adsets.forEach((adset) => {
          totalAds += adset.ads.length;
        });
      });

      // Xử lý từng campaign
      for (
        let campaignIndex = 0;
        campaignIndex < campaignsList.length;
        campaignIndex++
      ) {
        const campaign = campaignsList[campaignIndex];

        // Xử lý từng adset và ads trong campaign
        for (
          let adsetIndex = 0;
          adsetIndex < campaign.adsets.length;
          adsetIndex++
        ) {
          const adset = campaign.adsets[adsetIndex];

          for (let adIndex = 0; adIndex < adset.ads.length; adIndex++) {
            const ad = adset.ads[adIndex];

            const payload = buildPayload({
              campaign,
              adset,
              ad,
              selectedAccountId,
              editingItem: null,
              fbObjectiveMap: FB_OBJECTIVE_MAP,
              fbAdsetDefaultsByObjective: FB_ADSET_DEFAULTS_BY_OBJECTIVE,
            });

            if (mode === "edit") {
              await updateAdsWizard(payload);
            } else {
              await publishAdsWizard(payload);
            }

            totalSuccessCount++;
          }
        }
      }

      toast.success(
        `Tạo thành công ${totalSuccessCount}/${totalAds} quảng cáo trong ${campaignsList.length} chiến dịch!`
      );

      setSuccess(true);
      setTimeout(() => {
        setLoading(false);
        onSuccess?.();
        onClose?.();
      }, 1200);
    } catch (err) {
      console.error("Lỗi khi xử lý quảng cáo:", err);
      setLoading(false);

      const data = err?.response?.data || {};
      const fbMsg = data.error_user_msg || null;
      setError(fbMsg || null);

      if (fbMsg) {
        toast.error(mode === "edit" ? "Cập nhật thất bại" : "Đăng thất bại", {
          description: fbMsg,
        });
      }
    }
  };

  return {
    loading,
    error,
    success,
    handleSmartPublish, // FUNCTION MỚI
  };
}

/**
 * 🎯 NEW FLEXIBLE PUBLISH LOGIC
 * Hỗ trợ tất cả mô hình: 1-1-1, 1-nhiều-nhiều, nhiều-nhiều-nhiều
 */
export function useFlexibleWizardPublish() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const toast = useToast();

  /**
   * Publish toàn bộ cấu trúc linh hoạt
   * Sử dụng API mới: /api/ads-wizard/publish-flexible
   */
  const handleFlexiblePublish = async ({
    campaignsList,
    selectedAccountId,
    onSuccess,
    onClose,
    updateProgress,
  }) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log("🚀 Using Flexible API for all campaigns");

      // Đếm tổng số entities để tính %
      const totalEntities = campaignsList.reduce((sum, camp) => {
        const adsetsCount = camp.adsets?.length || 0;
        const adsCount = camp.adsets?.reduce((s, adset) => s + (adset.ads?.length || 0), 0) || 0;
        return sum + 1 + adsetsCount + adsCount; // campaign + adsets + ads
      }, 0);

      // Bắt đầu - set trạng thái loading
      updateProgress?.({
        status: 'loading',
        current: 0,
        total: totalEntities,
        percentage: 0,
        message: 'Đang chuẩn bị dữ liệu...',
      });

      // Log campaign structure BEFORE building payload
      console.log(
        "📊 Campaign Structure BEFORE building payload:",
        campaignsList.map((campaign) => ({
          name: campaign.name,
          adsets: campaign.adsets.map((adset) => ({
            name: adset.name,
            _id: adset._id,
            ads_count: adset.ads.length,
            ads: adset.ads.map((ad) => ({
              name: ad.name,
              adset_id: ad.adset_id,
              match: ad.adset_id === adset._id ? "✅" : "❌",
            })),
          })),
        }))
      );

      // Chuẩn bị dữ liệu cho API
      const payload = {
        ad_account_id: selectedAccountId,
        campaignsList: campaignsList.map((campaign) => ({
          ...buildCampaignPayload(campaign, selectedAccountId),
          adsets: campaign.adsets.map((adset) => {
            console.log(
              `🔍 Processing adset: ${adset.name}, _id: ${adset._id}`
            );

            const filteredAds = adset.ads.filter((ad) => {
              const match = ad.adset_id === adset._id;
              console.log(
                `  Ad: ${ad.name}, adset_id: ${ad.adset_id}, match: ${match}`
              );
              return match;
            });

            console.log(`  ✅ Filtered ads count: ${filteredAds.length}`);

            return {
              ...buildAdsetPayload(adset, campaign),
              ads: filteredAds.map((ad) => ({
                ...buildAdPayload(ad),
                creative: buildCreativePayload(ad, campaign, adset),
              })),
            };
          }),
        })),
        dry_run: false,
      };

      // Giả lập progress trong khi chờ BE xử lý
      let simulatedProgress = 10;
      const progressInterval = setInterval(() => {
        if (simulatedProgress < 90) {
          simulatedProgress += 5;
          updateProgress?.({
            current: Math.floor((totalEntities * simulatedProgress) / 100),
            percentage: simulatedProgress,
            message: `Đang xử lý... ${simulatedProgress}%`,
          });
        }
      }, 300); // Cập nhật mỗi 300ms

      // Cập nhật: đang gửi request
      updateProgress?.({
        current: Math.floor(totalEntities * 0.1),
        percentage: 10,
        message: 'Đang gửi dữ liệu tới Facebook Ads...',
      });

      try {
        // Gọi API mới
        const response = await axiosInstance.post(
          "/api/ads-wizard/publish-flexible",
          payload,
          {
            timeout: 120000, // 120 giây = 2 phút (đủ cho tạo nhiều ads)
          }
        );

        // Dừng giả lập progress
        clearInterval(progressInterval);

        // Lấy data từ response (có thể success true hoặc false)
        const resultData = response.data.data || response.data;
        const { totalSuccess, totalErrors, errors } = resultData;

        console.log("🔍 API Response:", { 
          success: response.data.success, 
          totalSuccess, 
          totalErrors,
          errorsCount: errors?.length,
          firstError: errors?.[0]
        });

        // Cập nhật trạng thái cuối cùng dựa vào kết quả
        if (totalErrors === 0) {
            updateProgress?.({
              status: 'success',
              current: totalEntities,
              percentage: 100,
              message: 'Hoàn thành!',
              successCount: totalSuccess,
              errorCount: 0,
            });
            
            toast.success(
              `Tạo thành công ${totalSuccess} quảng cáo trong ${campaignsList.length} chiến dịch!`
            );
          } else if (totalSuccess > 0) {
            updateProgress?.({
              status: 'partial',
              current: totalEntities,
              percentage: 100,
              message: `Hoàn thành với ${totalErrors} lỗi`,
              successCount: totalSuccess,
              errorCount: totalErrors,
              errors: errors,
            });
            
            toast.warning(
              `Tạo thành công ${totalSuccess}/${
                totalSuccess + totalErrors
              } quảng cáo. Có ${totalErrors} lỗi.`
            );
            console.warn("Một số quảng cáo tạo thất bại:", errors);
          } else {
            // Tất cả đều thất bại - hiển thị error_user_msg từ Facebook
            const firstError = errors?.[0];
            const fbErrorMsg = firstError?.error_user_msg || firstError?.error || 'Tạo quảng cáo thất bại';
            
            console.log("🔍 All ads failed!");
            console.log("🔍 Errors array:", errors);
            console.log("🔍 First error:", firstError);
            console.log("🔍 FB Error Message:", fbErrorMsg);
            
            updateProgress?.({
              status: 'error',
              percentage: 100,
              message: fbErrorMsg,
              errorCount: totalErrors,
              errors: errors,
            });
            
            toast.error("Tạo quảng cáo thất bại", {
              description: fbErrorMsg,
            });
            
            // Đóng wizard sau khi hiển thị lỗi (KHÔNG gọi onSuccess)
            setTimeout(() => {
              setLoading(false);
              onClose?.();
            }, 1500);
            return; // Dừng execution
          }

          setSuccess(true);
          setTimeout(() => {
            setLoading(false);
            onSuccess?.(resultData);
            onClose?.();
          }, 1200);
      } catch (apiError) {
        clearInterval(progressInterval);
        throw apiError;
      }
    } catch (err) {
      console.error("❌ Lỗi khi xử lý quảng cáo:", err);

      const data = err?.response?.data || {};
      const fbMsg = data.error_user_msg || data.message || null;
      setError(fbMsg || null);

      // Cập nhật progress về trạng thái lỗi
      updateProgress?.({
        status: 'error',
        percentage: 100,
        message: fbMsg || 'Có lỗi xảy ra khi tạo quảng cáo',
      });

      // Hiển thị toast với lỗi từ Facebook
      if (fbMsg) {
        toast.error("Tạo quảng cáo thất bại", {
          description: fbMsg,
        });
      } else {
        toast.error("Tạo quảng cáo thất bại", {
          description: "Có lỗi xảy ra khi tạo quảng cáo",
        });
      }

      // Đóng wizard sau khi hiển thị lỗi
      setTimeout(() => {
        setLoading(false);
        onClose?.();
      }, 1500);
    }
  };

  /**
   * 🎯 Publish từng bước riêng biệt (cho các trường hợp đặc biệt)
   */
  const handleStepByStepPublish = async ({
    campaignsList,
    selectedAccountId,
    onSuccess,
    onClose,
    updateProgress,
  }) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log("🎯 Using Step-by-Step API for all campaigns");

      let totalSuccessCount = 0;
      const results = {
        campaigns: [],
        adsets: [],
        ads: [],
      };

      // Đếm tổng số entities
      const totalEntities = campaignsList.reduce((sum, camp) => {
        const adsetsCount = camp.adsets?.length || 0;
        const adsCount = camp.adsets?.reduce((s, adset) => s + (adset.ads?.length || 0), 0) || 0;
        return sum + 1 + adsetsCount + adsCount;
      }, 0);

      let currentStep = 0;

      // Bắt đầu
      updateProgress?.({
        status: 'loading',
        current: 0,
        total: totalEntities,
        message: 'Khởi tạo...',
      });

      // Xử lý từng campaign
      for (
        let campaignIndex = 0;
        campaignIndex < campaignsList.length;
        campaignIndex++
      ) {
        const campaign = campaignsList[campaignIndex];

        // ✅ Bước 1: Tạo Campaign
        const campaignPayload = {
          ad_account_id: selectedAccountId,
          campaign: buildCampaignPayload(campaign, selectedAccountId),
          dry_run: false,
        };

        updateProgress?.({
          current: currentStep,
          message: `Đang tạo campaign: ${campaign.name}...`,
        });

        const campaignResponse = await axiosInstance.post(
          "/api/ads-wizard/publish-campaign",
          campaignPayload
        );
        const campaignResult = campaignResponse.data.data;
        results.campaigns.push(campaignResult);
        currentStep++;

        updateProgress?.({
          current: currentStep,
          message: `✅ Đã tạo campaign: ${campaign.name}`,
        });

        // ✅ Bước 2: Tạo AdSets cho Campaign này
        for (
          let adsetIndex = 0;
          adsetIndex < campaign.adsets.length;
          adsetIndex++
        ) {
          const adset = campaign.adsets[adsetIndex];

          const adsetPayload = {
            ad_account_id: selectedAccountId,
            campaignId: campaignResult.campaignId,
            adset: buildAdsetPayload(adset, campaign),
            dry_run: false,
          };

          updateProgress?.({
            current: currentStep,
            message: `Đang tạo adset: ${adset.name}...`,
          });

          const adsetResponse = await axiosInstance.post(
            "/api/ads-wizard/publish-adset",
            adsetPayload
          );
          const adsetResult = adsetResponse.data.data;
          results.adsets.push(adsetResult);
          currentStep++;

          updateProgress?.({
            current: currentStep,
            message: `✅ Đã tạo adset: ${adset.name}`,
          });

          // ✅ Bước 3: Tạo Ads cho AdSet này
          for (let adIndex = 0; adIndex < adset.ads.length; adIndex++) {
            const ad = adset.ads[adIndex];

            const adPayload = {
              ad_account_id: selectedAccountId,
              adsetId: adsetResult.adsetId,
              creative: buildCreativePayload(ad, campaign, adset),
              ad: buildAdPayload(ad),
              dry_run: false,
            };

            updateProgress?.({
              current: currentStep,
              message: `Đang tạo ad: ${ad.name}...`,
            });

            const adResponse = await axiosInstance.post(
              "/api/ads-wizard/publish-ad",
              adPayload
            );
            const adResult = adResponse.data.data;
            results.ads.push(adResult);
            totalSuccessCount++;
            currentStep++;

            updateProgress?.({
              current: currentStep,
              message: `✅ Đã tạo ad: ${ad.name}`,
            });
          }
        }
      }

      // Hoàn thành
      updateProgress?.({
        status: 'success',
        current: totalEntities,
        message: 'Hoàn thành!',
        successCount: totalSuccessCount,
      });

      toast.success(
        `Tạo thành công ${totalSuccessCount} quảng cáo trong ${campaignsList.length} chiến dịch!`
      );
      setSuccess(true);

      setTimeout(() => {
        setLoading(false);
        onSuccess?.(results);
        onClose?.();
      }, 1200);
    } catch (err) {
      console.error("❌ Lỗi khi xử lý quảng cáo:", err);

      const data = err?.response?.data || {};
      const fbMsg = data.error_user_msg || data.message || null;
      setError(fbMsg || null);

      // Cập nhật progress về lỗi
      updateProgress?.({
        status: 'error',
        percentage: 100,
        message: fbMsg || 'Có lỗi xảy ra khi tạo quảng cáo',
      });

      // Hiển thị toast với lỗi từ Facebook
      if (fbMsg) {
        toast.error("Tạo quảng cáo thất bại", {
          description: fbMsg,
        });
      } else {
        toast.error("Tạo quảng cáo thất bại", {
          description: "Có lỗi xảy ra khi tạo quảng cáo",
        });
      }

      // Đóng wizard sau khi hiển thị lỗi
      setTimeout(() => {
        setLoading(false);
        onClose?.();
      }, 1500);
    }
  };

  /**
   * 🔄 Update toàn bộ cấu trúc linh hoạt (cascade update)
   * Hỗ trợ update matching entities, tạo mới nếu chưa có
   */
  const handleFlexibleUpdate = async ({
    campaignsList,
    selectedAccountId,
    onSuccess,
    onClose,
    updateProgress,
  }) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log("🔄 Using Flexible Update API for all campaigns");

      // Đếm tổng số entities để tính %
      const totalEntities = campaignsList.reduce((sum, camp) => {
        const adsetsCount = camp.adsets?.length || 0;
        const adsCount = camp.adsets?.reduce((s, adset) => s + (adset.ads?.length || 0), 0) || 0;
        return sum + 1 + adsetsCount + adsCount;
      }, 0);

      // Bắt đầu - set trạng thái loading
      updateProgress?.({
        status: 'loading',
        current: 0,
        total: totalEntities,
        percentage: 0,
        message: 'Đang chuẩn bị dữ liệu cập nhật...',
      });

      // Log campaign structure BEFORE building payload
      console.log(
        "📊 Campaign Structure BEFORE update:",
        campaignsList.map((campaign) => ({
          name: campaign.name,
          _id: campaign._id,
          external_id: campaign.external_id,
          adsets: campaign.adsets?.map((adset) => ({
            name: adset.name,
            _id: adset._id,
            external_id: adset.external_id,
            ads_count: adset.ads?.length || 0,
            ads: adset.ads?.map((ad) => ({
              name: ad.name,
              _id: ad._id,
              external_id: ad.external_id,
              adset_id: ad.adset_id,
              match: ad.adset_id === adset._id ? "✅" : "❌",
            })),
          })),
        }))
      );

      // Chuẩn bị dữ liệu cho API
      const payload = {
        ad_account_id: selectedAccountId,
        campaignsList: campaignsList.map((campaign) => ({
          _id: campaign._id, // MongoDB _id để update
          external_id: campaign.external_id, // Facebook ID để update
          draftId: campaign.draftId,
          ...buildCampaignPayload(campaign, selectedAccountId),
          adsets: (campaign.adsets || []).map((adset) => {
            console.log(
              `🔍 Processing adset for update: ${adset.name}, _id: ${adset._id}, external_id: ${adset.external_id}`
            );

            const filteredAds = (adset.ads || []).filter((ad) => {
              const match = ad.adset_id === adset._id;
              console.log(
                `  Ad: ${ad.name}, adset_id: ${ad.adset_id}, match: ${match}`
              );
              return match;
            });

            console.log(`  ✅ Filtered ads count: ${filteredAds.length}`);

            return {
              _id: adset._id,
              external_id: adset.external_id,
              draftId: adset.draftId,
              ...buildAdsetPayload(adset, campaign),
              ads: filteredAds.map((ad) => ({
                _id: ad._id,
                external_id: ad.external_id,
                draftId: ad.draftId,
                ...buildAdPayload(ad),
                creative: buildCreativePayload(ad, campaign, adset),
              })),
            };
          }),
        })),
      };

      // Giả lập progress trong khi chờ BE xử lý
      let simulatedProgress = 10;
      const progressInterval = setInterval(() => {
        if (simulatedProgress < 90) {
          simulatedProgress += 1;
          updateProgress?.({
            current: Math.floor((totalEntities * simulatedProgress) / 100),
            percentage: simulatedProgress,
            message: `Đang cập nhật... ${simulatedProgress}%`,
          });
        }
      }, 100);

      // Cập nhật: đang gửi request
      updateProgress?.({
        current: Math.floor(totalEntities * 0.1),
        percentage: 10,
        message: 'Đang gửi yêu cầu cập nhật tới Facebook Ads...',
      });

      try {
        // Gọi API update
        const response = await axiosInstance.put(
          "/api/ads-wizard/update-flexible",
          payload,
          {
            timeout: 120000, // 120 giây = 2 phút
          }
        );

        // Dừng giả lập progress
        clearInterval(progressInterval);

        // Lấy data từ response (có thể success true hoặc false)
        const resultData = response.data.data || response.data;
        const { totalUpdated, totalCreated, totalErrors, errors, details } = resultData;

        console.log("🔍 API Update Response:", { 
          success: response.data.success, 
          totalUpdated, 
          totalCreated,
          totalErrors,
          errorsCount: errors?.length,
          firstError: errors?.[0]
        });

        // Cập nhật trạng thái cuối cùng dựa vào kết quả
        if (totalErrors === 0) {
            updateProgress?.({
              status: 'success',
              current: totalEntities,
              percentage: 100,
              message: 'Cập nhật hoàn tất!',
              successCount: totalUpdated + totalCreated,
              errorCount: 0,
            });

          toast.success(
            `Cập nhật thành công ${details.updated.campaigns.length + details.updated.adsets.length + details.updated.ads.length} entities, tạo mới ${details.created.campaigns.length + details.created.adsets.length + details.created.ads.length} entities!`
          );
          } else if ((totalUpdated + totalCreated) > 0) {
            updateProgress?.({
              status: 'partial',
              current: totalEntities,
              percentage: 100,
              message: `Hoàn thành với ${totalErrors} lỗi`,
              successCount: totalUpdated + totalCreated,
              errorCount: totalErrors,
              errors: errors,
            });

            toast.warning(
              `Cập nhật ${totalUpdated} entities, tạo mới ${totalCreated} entities. Có ${totalErrors} lỗi.`
            );
            console.warn("Một số cập nhật thất bại:", errors);
          } else {
            // Tất cả đều thất bại - hiển thị error_user_msg từ Facebook
            const firstError = errors?.[0];
            const fbErrorMsg = firstError?.error_user_msg || firstError?.error || 'Cập nhật thất bại';
            
            console.log("🔍 All updates failed. First error:", fbErrorMsg);
            
            updateProgress?.({
              status: 'error',
              percentage: 100,
              message: fbErrorMsg,
              errorCount: totalErrors,
              errors: errors,
            });
            
            toast.error("Cập nhật thất bại", {
              description: fbErrorMsg,
            });
            
            // Đóng wizard sau khi hiển thị lỗi (KHÔNG gọi onSuccess)
            setTimeout(() => {
              setLoading(false);
              onClose?.();
            }, 1500);
            return; // Dừng execution
          }

          setSuccess(true);
          setTimeout(() => {
            setLoading(false);
            onSuccess?.(resultData);
            onClose?.();
          }, 1200);
      } catch (apiError) {
        clearInterval(progressInterval);
        throw apiError;
      }
    } catch (err) {
      console.error("❌ Lỗi khi cập nhật quảng cáo:", err);

      const data = err?.response?.data || {};
      const fbMsg = data.error_user_msg || data.message || null;
      setError(fbMsg || null);

      // Cập nhật progress về trạng thái lỗi
      updateProgress?.({
        status: 'error',
        percentage: 100,
        message: fbMsg || 'Có lỗi xảy ra khi cập nhật quảng cáo',
      });

      // Hiển thị toast với lỗi từ Facebook
      if (fbMsg) {
        toast.error("Cập nhật thất bại", {
          description: fbMsg,
        });
      } else {
        toast.error("Cập nhật thất bại", {
          description: "Có lỗi xảy ra khi cập nhật quảng cáo",
        });
      }

      // Đóng wizard sau khi hiển thị lỗi
      setTimeout(() => {
        setLoading(false);
        onClose?.();
      }, 1500);
    }
  };

  return {
    loading,
    error,
    success,
    handleFlexiblePublish, // API mới - nhanh hơn
    handleFlexibleUpdate, // API update - cascade update
    handleStepByStepPublish, // API từng bước - chi tiết hơn
  };
}

// ========================================
// 🛠️ HELPER FUNCTIONS FOR PAYLOAD BUILDING
// ========================================

/**
 * Xây dựng payload cho Campaign
 */
function buildCampaignPayload(campaign) {
  const fbObjective =
    FB_OBJECTIVE_MAP[campaign.objective] || "OUTCOME_ENGAGEMENT";

  return {
    name: campaign.name,
    objective: fbObjective,
    status: campaign.status,
    special_ad_categories: ["NONE"],
    page_id: campaign.facebookPageId,
    page_name: campaign.facebookPage,
    daily_budget: campaign.daily_budget,
    lifetime_budget: campaign.lifetime_budget,
    start_time: campaign.start_time,
    stop_time: campaign.stop_time,
  };
}

/**
 * Xây dựng payload cho AdSet
 */
function buildAdsetPayload(adset, campaign) {
  const fbObjective =
    FB_OBJECTIVE_MAP[campaign.objective] || "OUTCOME_ENGAGEMENT";
  const adsetDefaults = FB_ADSET_DEFAULTS_BY_OBJECTIVE[fbObjective] || {
    optimization_goal: "REACH",
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITH_BID_CAP",
    bid_amount: 1000,
  };

  return {
    _id: adset._id,
    name: adset.name,
    daily_budget: adset.budgetAmount,
    status: "PAUSED",
    ...adsetDefaults,
    targeting: {
      age_min: adset.targeting.ageMin || 18,
      age_max: adset.targeting.ageMax || 65,
      geo_locations: { countries: ["VN"] },
      targeting_automation: {
        advantage_audience: 0,
      },
    },
    start_time: adset.start_time
      ? new Date(adset.start_time).toISOString()
      : new Date().toISOString(),
    end_time: adset.end_time
      ? new Date(adset.end_time).toISOString()
      : null,
    optimization_goal: adset.optimization_goal,
    conversion_event: adset.conversion_event,
    billing_event: adset.billing_event,
    bid_strategy: adset.bid_strategy,
    bid_amount: adset.bid_amount,
    ...(adset.promoted_object && { promoted_object: adset.promoted_object }),
    ...(adset.pixel_id && { pixel_id: adset.pixel_id }),
    ...(adset.destination_type && { destination_type: adset.destination_type }),
  };
}

/**
 * Xây dựng payload cho Creative
 */
function buildCreativePayload(ad, campaign, adset) {
  // Ưu tiên page_id từ sources khác nhau:
  // 1. adset.facebookPageId (từ ENGAGEMENT/LEADS/AWARENESS/SALES page selector)
  // 2. adset.promoted_object.page_id (từ TRAFFIC MESSAGING hoặc SALES)
  // 3. campaign.facebookPageId (fallback từ campaign, nếu có)
  let pageId = adset?.facebookPageId || 
               adset?.promoted_object?.page_id || 
               campaign?.facebookPageId;
  
  if (!pageId) {
    console.warn(
      "⚠️ WARNING: Creative payload thiếu page_id! " +
      "Đảm bảo rằng user đã chọn Facebook Page (AdsetStep) hoặc điền Messaging Page ID."
    );
  }
  
  return {
    name: ad.name,
    object_story_spec: {
      page_id: pageId,
      link_data: {
        message: ad.primaryText,
        link: ad.destinationUrl || "https://fchat.vn",
        caption: "fchat.vn",
        name: ad.headline,
        description: ad.description,
        call_to_action: {
          type: "MESSAGE_PAGE",
          value: { link: ad.destinationUrl || "https://fchat.vn" },
        },
        ...(ad.mediaUrl && { picture: ad.mediaUrl }),
      },
    },
  };
}

/**
 * Xây dựng payload cho Ad
 */
function buildAdPayload(ad) {
  return {
    adset_id: ad.adset_id,
    name: ad.name,
    status: "PAUSED",
  };
}