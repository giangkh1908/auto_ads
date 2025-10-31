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

// Import utils and constants
import { getInitialWizardStep } from "../../../utils/wizardUtils.js";
import {
  WIZARD_STEPS,
  EDITING_ITEM_TYPES,
  TAB_TYPES,
} from "../../../constants/wizardConstants.js";
import { saveDraft } from "../../../services/adsWizardService.js";
import { FB_OBJECTIVE_MAP, ADSET_CONFIG_BY_OBJECTIVE } from "../../../constants/wizardConstants.js";

function CreateAdsWizard({
  onClose,
  onSuccess = null,
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

    // ✅ Check xem có item nào có status DRAFT không
    const hasDraftStatus = finalCampaignsList.some(
      (camp) =>
        camp.status === "DRAFT" ||
        camp.adsets?.some(
          (adset) =>
            adset.status === "DRAFT" ||
            adset.ads?.some((ad) => ad.status === "DRAFT")
        )
    );

    // ✅ Quyết định action dựa trên status, không chỉ mode
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
        "➕ Calling handleFlexiblePublish (CREATE or DRAFT → ACTIVE)"
      );
      handleFlexiblePublish({
        campaignsList: finalCampaignsList,
        selectedAccountId,
        onSuccess,
        onClose,
        updateProgress,
      });
    } else {
      console.log("🔄 Calling handleFlexibleUpdate (UPDATE existing ACTIVE)");
      handleFlexibleUpdate({
        campaignsList: finalCampaignsList,
        selectedAccountId,
        onSuccess,
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
                onSave={(data) => {
                  console.log("CreateChild data:", data);
                  // Handle save logic here
                  setActiveTab(TAB_TYPES.CAMPAIGN);
                }}
                isFullMode={true}
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
