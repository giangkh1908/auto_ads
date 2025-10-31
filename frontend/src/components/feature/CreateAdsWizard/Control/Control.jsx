import { useState, useEffect } from "react";
import {
  Folder,
  Grid,
  FileText,
  Eye,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Calendar,
  DollarSign,
  MoreVertical,
} from "lucide-react";
import "./Control.css";
import { INITIAL_DATA } from "../../../../constants/wizardConstants.js";

function Control({
  wizardStep,
  setWizardStep,
  campaignsList = [],
  setCampaignsList,
  selectedCampaignIndex,
  setSelectedCampaignIndex,
  selectedAdsetIndex,
  setSelectedAdsetIndex,
  selectedAdIndex,
  setSelectedAdIndex,
}) {
  const [expandedItems, setExpandedItems] = useState({
    campaigns: {},
    adsets: {},
  });

  // Auto-expand campaigns and adsets by default
  useEffect(() => {
    const newExpandedItems = {
      campaigns: {},
      adsets: {},
    };

    // Auto-expand all campaigns
    campaignsList.forEach((_, campaignIndex) => {
      newExpandedItems.campaigns[campaignIndex] = true;
    });

    // Auto-expand all adsets
    campaignsList.forEach((campaign, campaignIndex) => {
      (campaign.adsets || []).forEach((_, adsetIndex) => {
        newExpandedItems.adsets[`${campaignIndex}-${adsetIndex}`] = true;
      });
    });

    setExpandedItems(newExpandedItems);
  }, [campaignsList]);

  const [openDropdowns, setOpenDropdowns] = useState({});

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside dropdown menu
      if (!event.target.closest(".dropdown-menu")) {
        setOpenDropdowns({});
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Function to handle step click
  const handleStepClick = (targetStep, campaignIndex, adsetIndex, adIndex) => {
    if (campaignIndex !== undefined) setSelectedCampaignIndex?.(campaignIndex);
    if (adsetIndex !== undefined) setSelectedAdsetIndex?.(adsetIndex);
    if (adIndex !== undefined) setSelectedAdIndex?.(adIndex);
    setWizardStep(targetStep);
  };

  // Toggle expand/collapse
  const toggleExpanded = (type, index) => {
    setExpandedItems((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [index]: !prev[type][index],
      },
    }));
  };

  // Toggle dropdown - only one can be open at a time
  const toggleDropdown = (dropdownId) => {
    setOpenDropdowns((prev) => {
      // Close all other dropdowns first
      const newState = {};
      // Only open the clicked dropdown if it wasn't already open
      if (!prev[dropdownId]) {
        newState[dropdownId] = true;
      }
      return newState;
    });
  };

  // Add new campaign
  // Fix hàm addCampaign
  const addCampaign = () => {
    // ✅ Generate ID cho adset đầu tiên
    const firstAdsetId = `temp_adset_${Date.now()}`;

    // ✅ Lấy campaign hiện tại làm template
    const currentCampaign =
      campaignsList[selectedCampaignIndex] || INITIAL_DATA.campaign;

    const newCampaign = {
      ...INITIAL_DATA.campaign,
      // ✅ Copy các thông tin quan trọng từ campaign hiện tại
      facebookPageId: currentCampaign.facebookPageId,
      facebookPage: currentCampaign.facebookPage,
      facebookPageAvatar: currentCampaign.facebookPageAvatar,
      objective: currentCampaign.objective,
      budgetType: currentCampaign.budgetType,
      id: Date.now(),
      name: `Chiến dịch ${campaignsList.length + 1}`,
      createdAt: new Date().toISOString(),
      adsets: [
        {
          ...INITIAL_DATA.adset,
          id: Date.now() + 1,
          _id: firstAdsetId, // ✅ Set _id cho adset
          name: "Nhóm quảng cáo mới",
          ads: [
            {
              ...INITIAL_DATA.ad,
              id: Date.now() + 2,
              name: "Quảng cáo mới",
              adset_id: firstAdsetId, // ✅ Set adset_id cho ad
            },
          ],
        },
      ],
    };

    setCampaignsList((prev) => [...prev, newCampaign]);
  };

  // Delete campaign
  const deleteCampaign = (campaignIndex) => {
    if (campaignsList.length <= 1) return;

    setCampaignsList((prev) =>
      prev.filter((_, index) => index !== campaignIndex)
    );

    if (selectedCampaignIndex >= campaignIndex) {
      setSelectedCampaignIndex(Math.max(0, selectedCampaignIndex - 1));
    }
  };

  // Add new adset
  const addAdset = (campaignIndex) => {
    setCampaignsList((prev) => {
      // ✅ Deep clone để tránh mutation và shared references
      const next = JSON.parse(JSON.stringify(prev));

      // Lấy campaign hiện tại
      const currentCampaign = next[campaignIndex];
      if (!currentCampaign) return next;

      // ✅ Generate ID cho adset mới
      const newAdsetId = `temp_adset_${Date.now()}`;

      // ✅ Tạo adset mới với _id và ad có adset_id
      const newAdset = {
        ...INITIAL_DATA.adset,
        id: Date.now(),
        _id: newAdsetId,
        name: `Nhóm quảng cáo ${(currentCampaign.adsets || []).length + 1}`,
        ads: [
          {
            ...INITIAL_DATA.ad,
            id: Date.now() + 1,
            name: "Quảng cáo mới",
            adset_id: newAdsetId, // ✅ Link ad với adset
          },
        ],
      };

      // ✅ Thêm adset vào campaign
      currentCampaign.adsets = [...(currentCampaign.adsets || []), newAdset];

      return next;
    });
  };

  // Delete adset
  const deleteAdset = (campaignIndex, adsetIndex) => {
    const currentAdsets = campaignsList[campaignIndex]?.adsets || [];
    if (currentAdsets.length <= 1) return;

    setCampaignsList((prev) => {
      const next = [...prev];
      const currentCampaign = next[campaignIndex];
      if (currentCampaign) {
        next[campaignIndex] = {
          ...currentCampaign,
          adsets: currentCampaign.adsets.filter(
            (_, index) => index !== adsetIndex
          ),
        };
      }
      return next;
    });

    if (selectedAdsetIndex >= adsetIndex) {
      setSelectedAdsetIndex(Math.max(0, selectedAdsetIndex - 1));
    }
  };

  // Add new ad
  const addAd = (campaignIndex, adsetIndex) => {
    setCampaignsList((prev) => {
      // Deep clone để tránh mutation
      const next = JSON.parse(JSON.stringify(prev));

      // Lấy campaign và adset hiện tại
      const currentCampaign = next[campaignIndex];
      if (!currentCampaign) return next;

      const currentAdset = currentCampaign.adsets[adsetIndex];
      if (!currentAdset) return next;

      // ✅ Tạo ad mới với adset_id
      const newAd = {
        ...INITIAL_DATA.ad,
        id: Date.now(),
        name: `Quảng cáo ${(currentAdset.ads || []).length + 1}`,
        adset_id: currentAdset._id, // ✅ Set adset_id
      };

      // ✅ Thêm trực tiếp ad vào adset
      currentAdset.ads = [...(currentAdset.ads || []), newAd];

      return next;
    });
  };

  // Delete ad
  const deleteAd = (campaignIndex, adsetIndex, adIndex) => {
    const currentAds =
      campaignsList[campaignIndex]?.adsets?.[adsetIndex]?.ads || [];
    if (currentAds.length <= 1) return;

    setCampaignsList((prev) => {
      const next = [...prev];
      const currentCampaign = next[campaignIndex];
      if (currentCampaign && currentCampaign.adsets[adsetIndex]) {
        next[campaignIndex] = {
          ...currentCampaign,
          adsets: currentCampaign.adsets.map((adset, index) =>
            index === adsetIndex
              ? { ...adset, ads: adset.ads.filter((_, idx) => idx !== adIndex) }
              : adset
          ),
        };
      }
      return next;
    });

    if (selectedAdIndex >= adIndex) {
      setSelectedAdIndex(Math.max(0, selectedAdIndex - 1));
    }
  };

  return (
    <div className="wizard-sidebar">
      <div className="hierarchy-container">
        <div className="hierarchy-list">
          {/* Campaigns */}
          {campaignsList.map((campaign, campaignIndex) => {
            const isExpanded = expandedItems.campaigns[campaignIndex];
            const isSelected = selectedCampaignIndex === campaignIndex;
            const canDelete = campaignsList.length > 1;

            return (
              <div
                key={campaign.id || campaignIndex}
                className="hierarchy-group"
              >
                {/* Campaign Item */}
                <div
                  className={`hierarchy-item campaign-item ${
                    wizardStep === 1 && isSelected ? "current" : ""
                  } ${isSelected ? "selected" : ""}`}
                  onClick={() => handleStepClick(1, campaignIndex, 0, 0)}
                >
                  <div className="hierarchy-icon">
                    <button
                      className="expand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded("campaigns", campaignIndex);
                      }}
                      title={isExpanded ? "Thu gọn" : "Mở rộng"}
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </button>
                    <Folder size={16} />
                  </div>
                  <div className="hierarchy-content">
                    <div className="hierarchy-label">Chiến dịch</div>
                    <div className="hierarchy-name">{campaign.name}</div>
                  </div>
                  <div className="hierarchy-actions">
                    <div className="dropdown-menu">
                      <button
                        className="more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDropdown(`campaign-${campaignIndex}`);
                        }}
                        title="Thêm tùy chọn"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openDropdowns[`campaign-${campaignIndex}`] && (
                        <div className="dropdown-content">
                          <button
                            className="dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              addCampaign();
                              setOpenDropdowns({});
                            }}
                          >
                            <Plus size={14} />
                            Tạo chiến dịch
                          </button>
                          {canDelete && (
                            <button
                              className="dropdown-item delete-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCampaign(campaignIndex);
                                setOpenDropdowns({});
                              }}
                            >
                              <Trash2 size={14} />
                              Xóa
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="hierarchy-status">
                    {wizardStep === 1 && isSelected ? "●" : ""}
                  </div>
                </div>

                {/* Adsets */}
                {isExpanded &&
                  (campaign.adsets || []).map((adset, adsetIndex) => {
                    const isAdsetExpanded =
                      expandedItems.adsets[`${campaignIndex}-${adsetIndex}`];
                    const isAdsetSelected =
                      selectedCampaignIndex === campaignIndex &&
                      selectedAdsetIndex === adsetIndex;
                    const canDeleteAdset = (campaign.adsets || []).length > 1;

                    return (
                      <div
                        key={adset.id || adsetIndex}
                        className="hierarchy-group adset-group"
                      >
                        {/* Adset Item */}
                        <div
                          className={`hierarchy-item adset-item ${
                            wizardStep === 2 && isAdsetSelected ? "current" : ""
                          } ${isAdsetSelected ? "selected" : ""}`}
                          onClick={() =>
                            handleStepClick(2, campaignIndex, adsetIndex, 0)
                          }
                        >
                          <div className="hierarchy-icon">
                            <button
                              className="expand-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(
                                  "adsets",
                                  `${campaignIndex}-${adsetIndex}`
                                );
                              }}
                              title={isAdsetExpanded ? "Thu gọn" : "Mở rộng"}
                            >
                              {isAdsetExpanded ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </button>
                            <Grid size={16} />
                          </div>
                          <div className="hierarchy-content">
                            <div className="hierarchy-label">
                              Nhóm quảng cáo
                            </div>
                            <div className="hierarchy-name">{adset.name}</div>
                          </div>
                          <div className="hierarchy-actions">
                            <div className="dropdown-menu">
                              <button
                                className="more-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDropdown(
                                    `adset-${campaignIndex}-${adsetIndex}`
                                  );
                                }}
                                title="Thêm tùy chọn"
                              >
                                <MoreVertical size={16} />
                              </button>
                              {openDropdowns[
                                `adset-${campaignIndex}-${adsetIndex}`
                              ] && (
                                <div className="dropdown-content">
                                  <button
                                    className="dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addAdset(campaignIndex);
                                      setOpenDropdowns({});
                                    }}
                                  >
                                    <Plus size={14} />
                                    Tạo nhóm quảng cáo
                                  </button>
                                  {canDeleteAdset && (
                                    <button
                                      className="dropdown-item delete-item"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteAdset(campaignIndex, adsetIndex);
                                        setOpenDropdowns({});
                                      }}
                                    >
                                      <Trash2 size={14} />
                                      Xóa
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="hierarchy-status">
                            {wizardStep === 2 && isAdsetSelected ? "●" : ""}
                          </div>
                        </div>

                        {/* Ads */}
                        {isAdsetExpanded &&
                          (adset.ads || []).map((ad, adIndex) => {
                            const isAdSelected =
                              selectedCampaignIndex === campaignIndex &&
                              selectedAdsetIndex === adsetIndex &&
                              selectedAdIndex === adIndex;
                            const canDeleteAd = (adset.ads || []).length > 1;

                            return (
                              <div
                                key={ad.id || adIndex}
                                className="hierarchy-group ad-group"
                              >
                                {/* Ad Item */}
                                <div
                                  className={`hierarchy-item ad-item ${
                                    wizardStep === 3 && isAdSelected
                                      ? "current"
                                      : ""
                                  } ${isAdSelected ? "selected" : ""}`}
                                  onClick={() =>
                                    handleStepClick(
                                      3,
                                      campaignIndex,
                                      adsetIndex,
                                      adIndex
                                    )
                                  }
                                >
                                  <div className="hierarchy-icon">
                                    <FileText size={16} />
                                  </div>
                                  <div className="hierarchy-content">
                                    <div className="hierarchy-label">
                                      Quảng cáo
                                    </div>
                                    <div className="hierarchy-name">
                                      {ad.name}
                                    </div>
                                  </div>
                                  <div className="hierarchy-actions">
                                    <div className="dropdown-menu">
                                      <button
                                        className="more-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleDropdown(
                                            `ad-${campaignIndex}-${adsetIndex}-${adIndex}`
                                          );
                                        }}
                                        title="Thêm tùy chọn"
                                      >
                                        <MoreVertical size={16} />
                                      </button>
                                      {openDropdowns[
                                        `ad-${campaignIndex}-${adsetIndex}-${adIndex}`
                                      ] && (
                                        <div className="dropdown-content">
                                          <button
                                            className="dropdown-item"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              addAd(campaignIndex, adsetIndex);
                                              setOpenDropdowns({});
                                            }}
                                          >
                                            <Plus size={14} />
                                            Tạo quảng cáo
                                          </button>
                                          {canDeleteAd && (
                                            <button
                                              className="dropdown-item delete-item"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteAd(
                                                  campaignIndex,
                                                  adsetIndex,
                                                  adIndex
                                                );
                                                setOpenDropdowns({});
                                              }}
                                            >
                                              <Trash2 size={14} />
                                              Xóa
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="hierarchy-status">
                                    {wizardStep === 3 && isAdSelected
                                      ? "●"
                                      : ""}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
              </div>
            );
          })}

          {/* Creative Review */}
          {/* <div
            className={`hierarchy-item creative-item ${
              wizardStep === 4
                ? "current"
                : completedSteps[4]
                ? "completed"
                : ""
            } ${!canClickStep(4) ? "disabled" : ""}`}
            onClick={() => handleStepClick(4)}
          >
            <div className="hierarchy-icon">
              <Eye size={16} />
            </div>
            <div className="hierarchy-content">
              <div className="hierarchy-label">Xem trước</div>
              <div className="hierarchy-name">Creative Review</div>
            </div>
            <div className="hierarchy-status">
              {wizardStep === 4 ? "●" : completedSteps[4] ? "✓" : ""}
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
}

export default Control;
