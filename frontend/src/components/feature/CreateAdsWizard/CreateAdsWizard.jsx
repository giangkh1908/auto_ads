import { useEffect, useRef, useState } from "react";
import Control from "../CreateAdsWizard/Control/Control.jsx";
import FooterWizard from "../CreateAdsWizard/FooterWizard/FooterWizard.jsx";
import TargetStep from "../CreateAdsWizard/TargetStep/TargetStep.jsx";
import CreateChild from "../CreateAdsWizard/CreateChild/CreateChild.jsx";
import CampaignStep from "../CreateAdsWizard/CampaignStep/CampaignStep.jsx";
import AdsetStep from "../CreateAdsWizard/AdsetStep/AdsetStep.jsx";
import AdStep from "../CreateAdsWizard/AdStep/AdStep.jsx";
import Creative from "./Creative/Creative.jsx";
import ProgressPopup from "../../common/ProgressPopup/Progress.jsx";
import ConfirmationPopup from "../../common/ConfirmationPopup/ConfirmationPopup.jsx";
import "./CreateAdsWizard.css";

// Import custom hooks
import {
  useWizardState,
  useWizardData,
} from "../../../hooks/useWizardState.js";
import { useFacebookPages } from "../../../hooks/useFacebookPages.js";
import { useEditMode } from "../../../hooks/useEditMode.js";
import { useFlexibleWizardPublish } from "../../../hooks/useWizardPublish.js";
import { useProgressState } from "../../../hooks/useProgressState.js";
import { useToast } from "../../../hooks/useToast.js";
import { useMyPackage } from "../../../hooks/useMyPackage.js";

// Import utils and constants
import { getInitialWizardStep } from "../../../utils/wizardUtils.js";
import {
  WIZARD_STEPS,
  EDITING_ITEM_TYPES,
  TAB_TYPES,
} from "../../../constants/wizardConstants.js";
import { saveDraft } from "../../../services/adsWizardService.js";
import { FB_OBJECTIVE_MAP, ADSET_CONFIG_BY_OBJECTIVE, INITIAL_DATA } from "../../../constants/wizardConstants.js";
import axiosInstance from "../../../utils/axios.js";
import { convertCountryCodesToNames, convertLocaleIdToLanguageCode } from "../../../utils/locationUtils.js";

function CreateAdsWizard({
  onClose,
  onSuccess = null,
  onError = null, // ✅ Callback khi publish thất bại (để refresh data)
  onDraftSaved = null, // ✅ Callback cho draft (chỉ fetch từ DB, không sync Facebook)
  mode = "create",
  editingItem = null,
  selectedAccountId = null,
  selectedCampaign: _selectedCampaign = null, // eslint-disable-line no-unused-vars
  setDatasets: _setDatasets = null, // eslint-disable-line no-unused-vars
}) {
  // Normalize backend outcome objective to UI key (AWARENESS, TRAFFIC, ...)
  const toUiObjective = (obj) => {
    if (!obj) return obj;
    if (ADSET_CONFIG_BY_OBJECTIVE[obj]) return obj; // already UI key
    const entry = Object.entries(FB_OBJECTIVE_MAP).find(([ui, fb]) => fb === obj);
    return entry ? entry[0] : obj;
  };
  const contentRef = useRef(null);

  // Refs for step validation
  const campaignRef = useRef(null);
  const adsetRef = useRef(null);
  const adRef = useRef(null);

  // Ref to track previous indices (prevent unnecessary re-loads)
  const prevIndicesRef = useRef({ campaign: -1, adset: -1, ad: -1 });

  // Custom hooks
  const {
    wizardStep,
    setWizardStep,
    activeTab,
    setActiveTab,
    loading,
    setLoading,
    success,
    completedSteps,
    setCompletedSteps,
  } = useWizardState();

  const {
    campaignsList,
    setCampaignsList,
    selectedCampaignIndex,
    setSelectedCampaignIndex,
    campaign,
    setCampaign,
    selectedAdsetIndex,
    setSelectedAdsetIndex,
    adsetsList,
    setAdsetsList,
    adset,
    setAdset,
    selectedAdIndex,
    setSelectedAdIndex,
    adsList,
    setAdsList,
    ad,
    setAd,
  } = useWizardData();

  const facebookPages = useFacebookPages();
  const toast = useToast();
  const { hasFeature } = useMyPackage();
  const contentAiEnabled = hasFeature("content_ai");

  // Sử dụng logic publish mới (linh hoạt)
  const {
    handleFlexiblePublish,
    handleFlexibleUpdate,
    loading: _publishLoading,
  } = useFlexibleWizardPublish();

  // Progress state management
  const { progressState, openProgress, updateProgress, closeProgress } =
    useProgressState();

  // State cho Save Draft Popup
  const [showSaveDraftPopup, setShowSaveDraftPopup] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // Giữ logic cũ để tương thích
  //const { handleSmartPublish } = useWizardPublish();

  // Edit mode logic - Load FULL HIERARCHY
  useEditMode({
    mode,
    editingItem,
    selectedAccountId,
    setCampaign,
    setCampaignsList, // Pass setCampaignsList để load full hierarchy
    setAdset,
    setAd,
    setLoading,
    openProgress, // Pass progress callbacks
    updateProgress,
  });

  // Lock background scroll while wizard is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Scroll to top when wizard step changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, [wizardStep]);

  // Set initial wizard step based on editingItem
  useEffect(() => {
    if (mode === "edit" && editingItem) {
      const initialStep = getInitialWizardStep(mode, editingItem);
      setWizardStep(initialStep);
    }
  }, [mode, editingItem, setWizardStep]);

  // ==============================
  // 🔄 SYNC: Load từ campaignsList khi click item khác
  // ==============================
  useEffect(() => {
    if (campaignsList.length === 0) return;

    const prev = prevIndicesRef.current;
    const indicesChanged =
      prev.campaign !== selectedCampaignIndex ||
      prev.adset !== selectedAdsetIndex ||
      prev.ad !== selectedAdIndex;

    // Chỉ load khi user click item khác trong Control
    if (!indicesChanged) return;

    const selectedCampaign = campaignsList[selectedCampaignIndex];
    const selectedAdset = selectedCampaign?.adsets?.[selectedAdsetIndex];
    const selectedAd = selectedAdset?.ads?.[selectedAdIndex];

    if (selectedCampaign) {
      setCampaign(selectedCampaign);
    }
    if (selectedAdset) {
      setAdset(selectedAdset);
    }
    if (selectedAd) {
      setAd(selectedAd);
    }

    prevIndicesRef.current = {
      campaign: selectedCampaignIndex,
      adset: selectedAdsetIndex,
      ad: selectedAdIndex,
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedCampaignIndex,
    selectedAdsetIndex,
    selectedAdIndex,
    campaignsList.length,
    campaignsList[selectedCampaignIndex]?.adsets?.length,
    campaignsList[selectedCampaignIndex]?.adsets?.[selectedAdsetIndex]?.ads
      ?.length,
  ]);

  // ==============================
  // 📤 SUBMIT: Sync states → campaignsList trước khi gửi
  // ==============================
  const handlePublishClick = () => {
    console.log("🚀 [SUBMIT] Preparing payload...");

    // ✅ Sync current states vào campaignsList trước khi submit
    const finalCampaignsList = campaignsList.map((camp, cIdx) => {
      if (cIdx === selectedCampaignIndex) {
        return {
          ...camp,
          ...campaign,
          // Preserve structure fields
          adsets: camp.adsets?.map((as, aIdx) => {
            if (aIdx === selectedAdsetIndex) {
              return {
                ...as,
                ...adset,
                // Preserve structure fields
                ads: as.ads?.map((a, adIdx) => {
                  if (adIdx === selectedAdIndex) {
                    return {
                      ...a,
                      ...ad,
                      // Ensure adset_id
                      adset_id: ad.adset_id || a.adset_id || as._id,
                    };
                  }
                  return a;
                }),
              };
            }
            return as;
          }),
        };
      }
      return camp;
    });

    console.log("📦 Final payload:", {
      campaigns: finalCampaignsList.length,
      mode,
      hasIds: finalCampaignsList[0]?._id ? "✅" : "❌",
      status: finalCampaignsList[0]?.status, // Log status
    });

    // Đếm tổng số entities để hiển thị trong progress
    const totalEntities = finalCampaignsList.reduce((sum, camp) => {
      const adsetsCount = camp.adsets?.length || 0;
      const adsCount =
        camp.adsets?.reduce((s, adset) => s + (adset.ads?.length || 0), 0) || 0;
      return sum + 1 + adsetsCount + adsCount;
    }, 0);

    // ✅ Check xem có item nào có status DRAFT hoặc FAILED (chưa publish) không
    // FAILED items: 
    // - Không có external_id → treat như CREATE (DRAFT)
    // - Có external_id → treat như UPDATE (đã publish nhưng thất bại)
    const hasDraftStatus = finalCampaignsList.some(
      (camp) => {
        const campNeedsCreate = 
          camp.status === "DRAFT" || 
          (camp.status === "FAILED" && !camp.external_id);
        
        const hasAdsetNeedsCreate = camp.adsets?.some(
          (adset) => {
            const adsetNeedsCreate = 
              adset.status === "DRAFT" || 
              (adset.status === "FAILED" && !adset.external_id);
            
            const hasAdNeedsCreate = adset.ads?.some(
              (ad) => ad.status === "DRAFT" || (ad.status === "FAILED" && !ad.external_id)
            );
            
            return adsetNeedsCreate || hasAdNeedsCreate;
          }
        );
        
        return campNeedsCreate || hasAdsetNeedsCreate;
      }
    );

    // ✅ Quyết định action dựa trên status, không chỉ mode
    // CREATE: mode === "create" HOẶC có items DRAFT/FAILED (không có external_id)
    // UPDATE: mode === "update" VÀ tất cả items đã publish (có external_id hoặc FAILED có external_id)
    const shouldPublish = mode === "create" || hasDraftStatus;

    // ✅ Mở progress popup
    openProgress({
      type: shouldPublish ? "create" : "update",
      title: shouldPublish
        ? "Đang đăng chiến dịch quảng cáo"
        : "Đang cập nhật chiến dịch quảng cáo",
      total: totalEntities,
    });

    // ✅ Check status để gọi đúng function
    if (shouldPublish) {
      console.log(
        "➕ Calling handleFlexiblePublish (CREATE: DRAFT/FAILED without external_id → ACTIVE)"
      );
      handleFlexiblePublish({
        campaignsList: finalCampaignsList,
        selectedAccountId,
        onSuccess,
        onError, // ✅ Truyền callback để refresh data khi thất bại
        onClose,
        updateProgress,
      });
    } else {
      console.log("🔄 Calling handleFlexibleUpdate (UPDATE: existing ACTIVE or FAILED with external_id)");
      handleFlexibleUpdate({
        campaignsList: finalCampaignsList,
        selectedAccountId,
        onSuccess,
        onError, // ✅ Truyền callback để refresh data khi thất bại
        onClose,
        updateProgress,
      });
    }
  };

  // ==============================
  // 💾 SAVE DRAFT: Logic lưu nháp
  // ==============================

  // Khi người dùng click "Đóng" (X hoặc nút Hủy)
  const handleCloseWizard = () => {
    // ✅ Kiểm tra campaign hiện tại đã được publish chưa?
    const isPublished = campaign?.external_id;

    // ✅ Chỉ hiển thị popup khi wizardStep > 0 VÀ chưa publish
    if (wizardStep > 0 && !isPublished) {
      // Hiển thị popup xác nhận lưu nháp
      setShowSaveDraftPopup(true);
    } else {
      // Step 0 (TARGET) hoặc đã publish → đóng trực tiếp
      onClose();
    }
  };

  // Lưu nháp
  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);

      // Sync dữ liệu hiện tại
      const finalCampaignsList = campaignsList.map((camp, cIdx) => {
        if (cIdx === selectedCampaignIndex) {
          return {
            ...camp,
            ...campaign,
            adsets: camp.adsets?.map((as, aIdx) => {
              if (aIdx === selectedAdsetIndex) {
                return {
                  ...as,
                  ...adset,
                  ads: as.ads?.map((a, adIdx) => {
                    if (adIdx === selectedAdIndex) {
                      return { ...a, ...ad };
                    }
                    return a;
                  }),
                };
              }
              return as;
            }),
          };
        }
        return camp;
      });

      // Gọi API lưu draft
      await saveDraft({
        ad_account_id: selectedAccountId,
        campaigns: finalCampaignsList,
      });

      toast.success("Đã lưu nháp thành công!");
      setShowSaveDraftPopup(false);
      
      // ✅ GỌI onDraftSaved() ĐỂ CHỈ FETCH LẠI TỪ DB (KHÔNG SYNC FACEBOOK)
      if (onDraftSaved) {
        onDraftSaved();
      }
      
      onClose();
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error(
        "Lỗi khi lưu nháp: " + (error.response?.data?.message || error.message)
      );
    } finally {
      setSavingDraft(false);
    }
  };

  // ==============================
  // 🎯 HANDLE CREATECHILD SAVE: Chuyển từ CreateChild sang Wizard
  // ==============================
  const handleCreateChildSave = async (data) => {
    try {
      setLoading(true);
      
      const { campaignId, adsetMode, adset: adsetName, adsetId, ad: adName } = data;

      if (!campaignId) {
        toast.error("Vui lòng chọn campaign");
        return;
      }

      // 1. Fetch campaign details
      const campaignRes = await axiosInstance.get("/api/campaigns/database", {
        params: { campaign_id: campaignId },
      });
      const campaignData = campaignRes.data.data;
      
      if (!campaignData) {
        toast.error("Không tìm thấy campaign");
        return;
      }

      // 2. Fetch adset details nếu selectExisting
      let adsetData = null;
      if (adsetMode === "selectExisting" && adsetId) {
        const adsetRes = await axiosInstance.get("/api/adsets/database", {
          params: { adset_id: adsetId },
        });
        adsetData = adsetRes.data.data;
        
        if (!adsetData) {
          toast.error("Không tìm thấy adset");
          return;
        }
      }

      // 3. Map campaign data
      const mappedCampaign = {
        id: campaignData._id,
        _id: campaignData._id,
        external_id: campaignData.external_id,
        name: campaignData.name || "Chiến dịch mới",
        objective: campaignData.objective || "",
        status: campaignData.status || "PAUSED",
        budgetType: campaignData.daily_budget ? "CAMPAIGN" : "ADSET",
        facebookPage: campaignData.page_name || null,
        facebookPageId: campaignData.page_id || null,
        facebookPageAvatar: campaignData.page_id
          ? `https://graph.facebook.com/${campaignData.page_id}/picture?type=square`
          : null,
        daily_budget: campaignData.daily_budget,
        lifetime_budget: campaignData.lifetime_budget,
        start_time: campaignData.start_time,
        stop_time: campaignData.stop_time,
        createdAt: campaignData.created_at || new Date().toISOString(),
      };

      // 4. Map adset data (mới hoặc từ fetch)
      let mappedAdset;
      if (adsetMode === "createNew") {
        // Tạo adset mới
        const firstAdsetId = `temp_adset_${Date.now()}`;
        mappedAdset = {
          ...INITIAL_DATA.adset,
          _id: firstAdsetId,
          name: adsetName || "Nhóm quảng cáo mới",
          // Copy targeting từ campaign nếu có
          targeting: {
            ...INITIAL_DATA.adset.targeting,
            // Có thể thêm logic copy từ campaign nếu cần
          },
        };
      } else {
        // Map từ adset đã fetch
        mappedAdset = {
          id: adsetData._id,
          _id: adsetData._id,
          external_id: adsetData.external_id,
          name: adsetData.name || "Nhóm quảng cáo mới",
          status: adsetData.status || "PAUSED",
          budgetType: adsetData.daily_budget ? "daily" : "lifetime",
          budgetAmount: adsetData.daily_budget || adsetData.lifetime_budget,
          daily_budget: adsetData.daily_budget,
          lifetime_budget: adsetData.lifetime_budget,
          start_time: adsetData.start_time,
          end_time: adsetData.end_time,
          schedule: {
            start: adsetData.start_time
              ? new Date(adsetData.start_time).toISOString().split("T")[0]
              : "",
            end: adsetData.end_time
              ? new Date(adsetData.end_time).toISOString().split("T")[0]
              : "",
          },
          targeting: {
            // Map geo_locations.countries từ DB (country codes) sang locations (country names) cho FE
            locations: adsetData.targeting?.geo_locations?.countries
              ? convertCountryCodesToNames(adsetData.targeting.geo_locations.countries)
              : ["Viet Nam"],
            ageMin: adsetData.targeting?.age_min || 18,
            ageMax: adsetData.targeting?.age_max || 65,
            // Map gender và language từ DB
            gender: adsetData.targeting?.genders?.[0] === 1 
              ? "male" 
              : adsetData.targeting?.genders?.[0] === 2 
              ? "female" 
              : adsetData.targeting?.gender || "all",
            language: adsetData.targeting?.locales?.[0] 
              ? (convertLocaleIdToLanguageCode(adsetData.targeting.locales[0]) || adsetData.targeting.locales[0])
              : adsetData.targeting?.language || "vi",
            publisher_platforms: adsetData.targeting?.publisher_platforms || ["facebook"],
            facebook_positions: adsetData.targeting?.facebook_positions || ["feed", "video_feeds", "marketplace", "search"],
            // Preserve other targeting fields
            geo_locations: adsetData.targeting?.geo_locations,
            age_min: adsetData.targeting?.age_min,
            age_max: adsetData.targeting?.age_max,
            ...(adsetData.targeting || {}),
          },
          placement: "AUTOMATIC",
          optimization_goal: adsetData.optimization_goal || "REACH",
          billing_event: adsetData.billing_event || "IMPRESSIONS",
          bid_strategy: adsetData.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
          bid_amount: adsetData.bid_amount,
          traffic_destination: adsetData.traffic_destination || adsetData.destination_type || null,
          promoted_object: {
            page_id: adsetData.page_id || campaignData.page_id || null,
            pixel_id: adsetData.targeting?.promoted_object?.pixel_id || null,
            custom_event_type: adsetData.targeting?.promoted_object?.custom_event_type || null,
          },
        };
      }

      // 5. Tạo ad mới (luôn luôn)
      const firstAdsetId = mappedAdset._id || `temp_adset_${Date.now()}`;
      const mappedAd = {
        ...INITIAL_DATA.ad,
        adset_id: firstAdsetId,
        name: adName || "Quảng cáo mới",
        page_id: campaignData.page_id || null,
      };

      // 6. Khởi tạo campaignsList
      const newCampaignsList = [{
        ...mappedCampaign,
        adsets: [{
          ...mappedAdset,
          ads: [mappedAd],
        }],
      }];

      setCampaignsList(newCampaignsList);
      setSelectedCampaignIndex(0);
      setSelectedAdsetIndex(0);
      setSelectedAdIndex(0);

      // 7. Set wizardStep phù hợp
      let initialStep;
      if (adsetMode === "createNew") {
        initialStep = WIZARD_STEPS.ADSET; // Bắt đầu từ adset step
      } else {
        initialStep = WIZARD_STEPS.AD; // Bắt đầu từ ad step (vì ad luôn mới)
      }

      // Nếu campaign không có objective, bắt đầu từ campaign step
      if (!campaignData.objective) {
        initialStep = WIZARD_STEPS.CAMPAIGN;
      }

      setWizardStep(initialStep);
      setActiveTab(TAB_TYPES.CAMPAIGN);

      // 8. Sync state
      setCampaign(mappedCampaign);
      setAdset(mappedAdset);
      setAd(mappedAd);

      toast.success("Đã tải thông tin thành công");
    } catch (error) {
      console.error("Error handling CreateChild save:", error);
      toast.error(
        error?.response?.data?.message || "Lỗi khi tải thông tin. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  };

  // Không lưu nháp, thoát luôn
  const handleDiscardDraft = () => {
    setShowSaveDraftPopup(false);
    onClose();
  };

  // Hủy popup (giữ lại ở wizard)
  const handleCancelSaveDraft = () => {
    setShowSaveDraftPopup(false);
  };

  // Fallback cho logic cũ (nếu cần)
  // const handleLegacyPublishClick = () => {
  //   handleSmartPublish({
  //     campaignsList,
  //     selectedAccountId,
  //     editingItem,
  //     mode,
  //     onSuccess,
  //     onClose,
  //   });
  // };

  // Get title for modal header
  const getModalTitle = () => {
    if (mode === "edit") {
      const typeMap = {
        [EDITING_ITEM_TYPES.CAMPAIGN]: "chiến dịch",
        [EDITING_ITEM_TYPES.ADSET]: "nhóm quảng cáo",
        [EDITING_ITEM_TYPES.AD]: "quảng cáo",
      };
      return `Chỉnh sửa ${typeMap[editingItem?.type] || "quảng cáo"}`;
    }
    return "Tạo chiến dịch";
  };

  return (
    <div className="ads-modal-overlay" role="dialog" aria-modal="true">
      <div
        className={`ads-modal ${
          activeTab === TAB_TYPES.CHILD && wizardStep === WIZARD_STEPS.TARGET
            ? "child-tab"
            : "campaign-tab"
        }`}
      >
        <div className="ads-modal-header">
          {wizardStep === WIZARD_STEPS.TARGET && (
            <div className="ads-modal-tabs">
              <button
                className={`tab-button-campaign ${
                  activeTab === TAB_TYPES.CAMPAIGN ? "active" : "inactive"
                }`}
                onClick={() => setActiveTab(TAB_TYPES.CAMPAIGN)}
              >
                {getModalTitle()}
              </button>
              <button
                className={`tab-button-campaign ${
                  activeTab === TAB_TYPES.CHILD ? "active" : "inactive"
                }`}
                onClick={() => setActiveTab(TAB_TYPES.CHILD)}
              >
                Nhóm quảng cáo hoặc quảng cáo mới
              </button>
            </div>
          )}
          {wizardStep > WIZARD_STEPS.TARGET && (
            <div className="ads-modal-title">{getModalTitle()}</div>
          )}
        </div>

        <div className="ads-modal-body">
          {activeTab === TAB_TYPES.CAMPAIGN ||
          wizardStep > WIZARD_STEPS.TARGET ? (
            <>
              {/* Unified Left Panel - Campaign Hierarchy (hidden for step 0) */}
              {wizardStep > WIZARD_STEPS.TARGET && (
                <Control
                  wizardStep={wizardStep}
                  setWizardStep={setWizardStep}
                  campaignsList={campaignsList}
                  setCampaignsList={setCampaignsList}
                  selectedCampaignIndex={selectedCampaignIndex}
                  setSelectedCampaignIndex={setSelectedCampaignIndex}
                  selectedAdsetIndex={selectedAdsetIndex}
                  setSelectedAdsetIndex={setSelectedAdsetIndex}
                  selectedAdIndex={selectedAdIndex}
                  setSelectedAdIndex={setSelectedAdIndex}
                />
              )}

              <div className="wizard-content" ref={contentRef}>
                {wizardStep === WIZARD_STEPS.TARGET && (
                  <TargetStep campaign={campaign} setCampaign={setCampaign} />
                )}

                {/* Campaign Details Panel */}
                {wizardStep === WIZARD_STEPS.CAMPAIGN && (
              <CampaignStep
                ref={campaignRef}
                campaign={campaign}
                setCampaign={setCampaign}
                campaignsList={campaignsList}
                setCampaignsList={setCampaignsList}
                selectedCampaignIndex={selectedCampaignIndex}
                setSelectedCampaignIndex={setSelectedCampaignIndex}
              />
            )}

                {/* Adset Details Panel */}
                {wizardStep === WIZARD_STEPS.ADSET && (
              <AdsetStep
                ref={adsetRef}
                adset={adset}
                setAdset={setAdset}
                mode={mode}
                objective={toUiObjective(campaign.objective)}
                adsetsList={adsetsList}
                setAdsetsList={setAdsetsList}
                facebookPages={facebookPages}
                campaign={campaign}
              />
            )}

                {/* Ad Details Panel */}
                {wizardStep === WIZARD_STEPS.AD && (
              <AdStep
                ref={adRef}
                ad={ad}
                setAd={setAd}
                adset={adset}
                mode={mode}
                campaign={campaign}
                adsList={adsList}
                setAdsList={setAdsList}
                contentAiEnabled={contentAiEnabled}
              />
            )}

                {/* Creative Preview Panel */}
                {wizardStep === WIZARD_STEPS.CREATIVE && (
                  <Creative ad={ad} campaign={campaign} adset={adset} />
                )}
              </div>
            </>
          ) : (
            /* CreateChild Mode - Full Width */
            <div className="create-child-full-mode">
              <CreateChild
                onClose={() => setActiveTab(TAB_TYPES.CAMPAIGN)}
                onSave={handleCreateChildSave}
                isFullMode={true}
                selectedAccountId={selectedAccountId}
              />
            </div>
          )}
        </div>

        {/* Wizard Footer - Show in campaign mode or when wizardStep > 0 */}
        {(activeTab === TAB_TYPES.CAMPAIGN ||
          wizardStep > WIZARD_STEPS.TARGET) && (
          <FooterWizard
            wizardStep={wizardStep}
            setWizardStep={setWizardStep}
            completedSteps={completedSteps}
            setCompletedSteps={setCompletedSteps}
            campaign={campaign}
            adset={adset}
            ad={ad}
            campaignRef={campaignRef}
            adsetRef={adsetRef}
            adRef={adRef}
            loading={loading}
            success={success}
            mode={mode}
            onClose={handleCloseWizard}
            handlePublish={handlePublishClick}
          />
        )}
      </div>

      {/* Progress Popup */}
      <ProgressPopup
        isOpen={progressState.isOpen}
        type={progressState.type}
        title={progressState.title}
        progress={progressState.progress}
        onClose={closeProgress}
        cancellable={false}
      />

      {/* Save Draft Popup */}
      <ConfirmationPopup
        isOpen={showSaveDraftPopup}
        type="save-draft"
        title="Lưu nháp trước khi thoát?"
        message="Bạn có muốn lưu nháp chiến dịch hiện tại không? Bạn có thể tiếp tục chỉnh sửa sau."
        confirmText="Lưu nháp"
        cancelText="Hủy"
        discardText="Không lưu"
        onConfirm={handleSaveDraft}
        onClose={handleCancelSaveDraft}
        onDiscard={handleDiscardDraft}
        isLoading={savingDraft}
      />
    </div>
  );
}

export default CreateAdsWizard;
