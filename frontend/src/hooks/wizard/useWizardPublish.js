import { useState } from "react";
import { useToast } from "../common/useToast";
import {
  publishAdsWizard,
  updateAdsWizard,
} from "../../services/ads/adsWizardService";
import { buildPayload } from "../../utils/business-logic/wizardUtils";
import {
  FB_OBJECTIVE_MAP,
  FB_ADSET_DEFAULTS_BY_OBJECTIVE,
} from "../../constants/wizardConstants";
import { convertCountryNamesToCodes, convertLanguageCodeToLocaleId } from "../../utils/formatters/locationUtils";
import { convertCTAToFacebookType } from "../../utils/formatters/ctaUtils";
import axiosInstance from "../../utils/api/axios";

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
      // console.log("Using Sequential API for all campaigns");

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
      //console.error("Lỗi khi xử lý quảng cáo:", err);
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
 * NEW FLEXIBLE PUBLISH LOGIC
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
    onError, // Callback khi publish thất bại (để refresh data)
    onClose,
    updateProgress,
  }) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // console.log("Using Flexible API for all campaigns");

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
      // console.log(
      //   "Campaign Structure BEFORE building payload:",
      //   campaignsList.map((campaign) => ({
      //     name: campaign.name,
      //     adsets: campaign.adsets.map((adset) => ({
      //       name: adset.name,
      //       _id: adset._id,
      //       ads_count: adset.ads.length,
      //       ads: adset.ads.map((ad) => ({
      //         name: ad.name,
      //         adset_id: ad.adset_id,
      //         match: ad.adset_id === adset._id ? "✅" : "❌",
      //       })),
      //     })),
      //   }))
      // );

      // Chuẩn bị dữ liệu cho API
      const payload = {
        ad_account_id: selectedAccountId,
        campaignsList: campaignsList.map((campaign) => ({
          ...buildCampaignPayload(campaign, selectedAccountId),
          adsets: campaign.adsets.map((adset) => {
            // console.log(
            //   `🔍 Processing adset: ${adset.name}, _id: ${adset._id}`
            // );

            const filteredAds = adset.ads.filter((ad) => {
              const match = ad.adset_id === adset._id;
              // console.log(
              //   `  Ad: ${ad.name}, adset_id: ${ad.adset_id}, match: ${match}`
              // );
              return match;
            });

            // console.log(`  ✅ Filtered ads count: ${filteredAds.length}`);

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

        // console.log("🔍 API Response:", {
        //   success: response.data.success,
        //   totalSuccess,
        //   totalErrors,
        //   errorsCount: errors?.length,
        //   firstError: errors?.[0]
        // });

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
            `Tạo thành công ${totalSuccess}/${totalSuccess + totalErrors
            } quảng cáo. Có ${totalErrors} lỗi.`
          );
          //console.warn("Một số quảng cáo tạo thất bại:", errors);
        } else {
          // Tất cả đều thất bại - hiển thị error_user_msg từ Facebook
          const firstError = errors?.[0];
          const fbErrorMsg = firstError?.error_user_msg || firstError?.error || 'Tạo quảng cáo thất bại';

          // console.log("🔍 All ads failed!");
          // console.log("🔍 Errors array:", errors);
          // console.log("🔍 First error:", firstError);
          // console.log("🔍 FB Error Message:", fbErrorMsg);

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

          // ✅ Refresh data để hiển thị items FAILED
          onError?.();

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
      //console.error("❌ Lỗi khi xử lý quảng cáo:", err);

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

      // ✅ Refresh data để hiển thị items FAILED
      onError?.();

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
      // console.log("🎯 Using Step-by-Step API for all campaigns");

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

        // Bước 1: Tạo Campaign
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
          message: `Đã tạo campaign: ${campaign.name}`,
        });

        // Bước 2: Tạo AdSets cho Campaign này
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
            message: `Đã tạo adset: ${adset.name}`,
          });

          // Bước 3: Tạo Ads cho AdSet này
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
              message: `Đã tạo ad: ${ad.name}`,
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
      //console.error("❌ Lỗi khi xử lý quảng cáo:", err);

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
   * Update toàn bộ cấu trúc linh hoạt (cascade update)
   * Hỗ trợ update matching entities, tạo mới nếu chưa có
   */
  const handleFlexibleUpdate = async ({
    campaignsList,
    selectedAccountId,
    onSuccess,
    onError, // Callback khi update thất bại (để refresh data)
    onClose,
    updateProgress,
  }) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // console.log("Using Flexible Update API for all campaigns");

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
      // console.log(
      //   "📊 Campaign Structure BEFORE update:",
      //   campaignsList.map((campaign) => ({
      //     name: campaign.name,
      //     _id: campaign._id,
      //     external_id: campaign.external_id,
      //     adsets: campaign.adsets?.map((adset) => ({
      //       name: adset.name,
      //       _id: adset._id,
      //       external_id: adset.external_id,
      //       ads_count: adset.ads?.length || 0,
      //       ads: adset.ads?.map((ad) => ({
      //         name: ad.name,
      //         _id: ad._id,
      //         external_id: ad.external_id,
      //         adset_id: ad.adset_id,
      //         match: ad.adset_id === adset._id ? "✅" : "❌",
      //       })),
      //     })),
      //   }))
      // );

      // Chuẩn bị dữ liệu cho API
      const payload = {
        ad_account_id: selectedAccountId,
        campaignsList: campaignsList.map((campaign) => ({
          // CHỈ GỬI _id NẾU LÀ MongoDB ObjectId HỢP LỆ (không phải temp ID)
          ...(campaign._id && !isTempId(campaign._id) && isValidMongoId(campaign._id) && { _id: campaign._id }),
          ...(campaign.external_id && { external_id: campaign.external_id }),
          // buildCampaignPayload đã filter draftId (temp ID)
          ...buildCampaignPayload(campaign, selectedAccountId),
          adsets: (campaign.adsets || []).map((adset) => {
            // console.log(
            //   `🔍 Processing adset for update: ${adset.name}, _id: ${adset._id}, external_id: ${adset.external_id}`
            // );

            const filteredAds = (adset.ads || []).filter((ad) => {
              const match = ad.adset_id === adset._id;
              // console.log(
              //   `  Ad: ${ad.name}, adset_id: ${ad.adset_id}, match: ${match}`
              // );
              return match;
            });

            // console.log(`  ✅ Filtered ads count: ${filteredAds.length}`);

            return {
              // CHỈ GỬI external_id NẾU CÓ (buildAdsetPayload đã handle _id và draftId)
              ...(adset.external_id && { external_id: adset.external_id }),
              // buildAdsetPayload đã filter _id và draftId (temp ID)
              ...buildAdsetPayload(adset, campaign),
              ads: filteredAds.map((ad) => ({
                // CHỈ GỬI external_id NẾU CÓ (buildAdPayload đã handle _id và draftId)
                ...(ad.external_id && { external_id: ad.external_id }),
                // buildAdPayload đã filter _id và draftId (temp ID)
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

        // console.log("🔍 API Update Response:", {
        //   success: response.data.success,
        //   totalUpdated,
        //   totalCreated,
        //   totalErrors,
        //   errorsCount: errors?.length,
        //   firstError: errors?.[0]
        // });

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
          //console.warn("Một số cập nhật thất bại:", errors);
        } else {
          // Tất cả đều thất bại - hiển thị error_user_msg từ Facebook
          const firstError = errors?.[0];
          const fbErrorMsg = firstError?.error_user_msg || firstError?.error || 'Cập nhật thất bại';

          // console.log("🔍 All updates failed. First error:", fbErrorMsg);

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
      //console.error("❌ Lỗi khi cập nhật quảng cáo:", err);

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

      // Refresh data để hiển thị items FAILED
      onError?.();

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

// Helper function để check xem ID có phải temp ID không
function isTempId(id) {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith('temp_');
}

// Helper function để check xem ID có phải MongoDB ObjectId hợp lệ không
function isValidMongoId(id) {
  if (!id) return false;
  // MongoDB ObjectId là chuỗi 24 ký tự hex
  if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) return true;
  // Nếu là ObjectId object
  if (typeof id === 'object' && id.toString) return true;
  return false;
}

// Helper function để lấy draftId hợp lệ
// CHỈ SET draftId KHI:
// 1. Đã có external_id (đã publish) → có thể update draft
// 2. HOẶC _id là MongoDB ObjectId hợp lệ (đã lưu trong DB)
function getValidDraftId(entity) {
  if (!entity) return null;

  // Item đã publish → có thể có draftId để update
  const hasExternalId = entity.external_id != null && entity.external_id !== '';

  // Item đã lưu trong DB (có MongoDB ObjectId hợp lệ)
  const validId = entity._id && !isTempId(entity._id) && isValidMongoId(entity._id);
  const validIdAlt = entity.id && !isTempId(entity.id) && isValidMongoId(entity.id);

  // CHỈ SET draftId NẾU item đã publish HOẶC đã lưu trong DB
  if (hasExternalId || validId || validIdAlt) {
    return entity._id || entity.id || null;
  }

  // Item mới (temp ID) → không set draftId → backend sẽ tạo mới
  return null;
}

/**
 * Xây dựng payload cho Campaign
 */
function buildCampaignPayload(campaign) {
  const fbObjective =
    FB_OBJECTIVE_MAP[campaign.objective] || "OUTCOME_ENGAGEMENT";

  return {
    draftId: getValidDraftId(campaign), // FILTER TEMP ID
    name: campaign.name,
    objective: fbObjective,
    status: campaign.status,
    special_ad_categories: ["NONE"],
    // XÓA page_id và page_name từ campaign (đã di chuyển sang adset)
    // page_id: campaign.facebookPageId,
    // page_name: campaign.facebookPage,
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

  // Tách riêng optimization_goal và billing_event để không override giá trị từ adset
  // eslint-disable-next-line no-unused-vars
  const { optimization_goal, billing_event, ...restDefaults } = adsetDefaults;

  return {
    // CHỈ SET _id NẾU LÀ MongoDB ObjectId HỢP LỆ (không phải temp ID)
    ...(adset._id && !isTempId(adset._id) && isValidMongoId(adset._id) && { _id: adset._id }),
    draftId: getValidDraftId(adset), // FILTER TEMP ID
    name: adset.name,
    daily_budget: adset.budgetAmount,
    status: "PAUSED",
    ...restDefaults, // Chỉ spread các field khác, không bao gồm optimization_goal và billing_event
    targeting: {
      age_min: adset.targeting.ageMin || 18,
      age_max: adset.targeting.ageMax || 65,

      // NEW: Check if locations is object structure (new) or array (old)
      ...(adset.targeting?.locations &&
        typeof adset.targeting.locations === "object" &&
        !Array.isArray(adset.targeting.locations)
        ? {
          // New structure: Pass locations object to backend for transformation
          // DON'T set geo_locations here - let backend decide based on selected locations
          locations: adset.targeting.locations,
        }
        : {
          // Backward compatibility: old array format
          geo_locations: {
            countries: convertCountryNamesToCodes(
              Array.isArray(adset.targeting?.locations)
                ? adset.targeting.locations
                : ["Viet Nam"]
            ),
          },
        }),

      // THÊM: Gender và language
      ...(adset.targeting?.gender && adset.targeting.gender !== "all" && {
        genders:
          adset.targeting.gender === "male"
            ? [1]
            : adset.targeting.gender === "female"
              ? [2]
              : [],
      }),
      ...(adset.targeting?.language &&
        adset.targeting.language !== "all" &&
        (() => {
          const localeId = convertLanguageCodeToLocaleId(
            adset.targeting.language
          );
          return localeId ? { locales: [localeId] } : {};
        })()),

      // THÊM: Detailed targeting (interests, behaviors, demographics)
      ...(Array.isArray(adset.targeting?.detailed_targeting) &&
        adset.targeting.detailed_targeting.length > 0 && {
        detailed_targeting: adset.targeting.detailed_targeting,
      }),

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
    // ✅ Extract pixel_id từ promoted_object nếu có (cho LINK_CLICKS - WEBSITE)
    ...(adset.pixel_id || adset.promoted_object?.pixel_id
      ? { pixel_id: adset.pixel_id || adset.promoted_object.pixel_id }
      : {}),
    ...(adset.traffic_destination && { traffic_destination: adset.traffic_destination }),
    ...(adset.engagement_destination && { engagement_destination: adset.engagement_destination }),
    ...(adset.destination_type && { destination_type: adset.destination_type }),
    // ✅ THÊM page_id và page_name từ adset (đã di chuyển từ campaign)
    ...(adset.facebookPageId && { page_id: adset.facebookPageId }),
    ...(adset.facebookPage && { page_name: adset.facebookPage }),
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
      "Kiểm tra lại, có vẻ bạn chưa chọn Page nào! " +
      "Đảm bảo rằng bạn đã chọn Facebook Page (ở nhóm quảng cáo)."
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
          type: convertCTAToFacebookType(ad.cta),
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
    draftId: getValidDraftId(ad), // ✅ FILTER TEMP ID
    adset_id: ad.adset_id,
    name: ad.name,
    status: "PAUSED",
  };
}