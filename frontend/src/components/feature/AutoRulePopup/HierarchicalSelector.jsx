import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { buildApplyToText } from "../../../utils/autoRuleUtils";

/**
 * Hierarchical Selector Component for selecting campaigns, adsets, and ads
 */
const HierarchicalSelector = memo(({
  hierarchicalData,
  selectedCampaignIds = [],
  selectedAdsetIds = [],
  selectedAdIds = [],
  expandedCampaigns: externalExpandedCampaigns,
  expandedAdsets: externalExpandedAdsets,
  onExpandedCampaignsChange,
  onExpandedAdsetsChange,
  onSelectionChange,
  loading = false,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [internalExpandedCampaigns, setInternalExpandedCampaigns] = useState(
    new Set()
  );
  const [internalExpandedAdsets, setInternalExpandedAdsets] = useState(
    new Set()
  );
  const dropdownRef = useRef(null);

  // Use external state if provided, otherwise use internal state
  const expandedCampaigns =
    externalExpandedCampaigns !== undefined
      ? externalExpandedCampaigns
      : internalExpandedCampaigns;
  const expandedAdsets =
    externalExpandedAdsets !== undefined
      ? externalExpandedAdsets
      : internalExpandedAdsets;

  const setExpandedCampaigns =
    onExpandedCampaignsChange || setInternalExpandedCampaigns;
  const setExpandedAdsets = onExpandedAdsetsChange || setInternalExpandedAdsets;

  // Create lookup Maps for O(1) performance
  const hierarchicalDataMap = useMemo(() => {
    const map = new Map();
    hierarchicalData.forEach((campaign) => {
      map.set(campaign.id?.toString(), campaign);
    });
    return map;
  }, [hierarchicalData]);

  // Create Set lookups for selected IDs for O(1) performance
  const selectedCampaignIdsSet = useMemo(
    () => new Set(selectedCampaignIds.map((id) => id?.toString())),
    [selectedCampaignIds]
  );
  const selectedAdsetIdsSet = useMemo(
    () => new Set(selectedAdsetIds.map((id) => id?.toString())),
    [selectedAdsetIds]
  );
  const selectedAdIdsSet = useMemo(
    () => new Set(selectedAdIds.map((id) => id?.toString())),
    [selectedAdIds]
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const toggleCampaign = useCallback(
    (campaignId) => {
      setExpandedCampaigns((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(campaignId)) {
          newSet.delete(campaignId);
        } else {
          newSet.add(campaignId);
        }
        return newSet;
      });
    },
    [setExpandedCampaigns]
  );

  const toggleAdset = useCallback(
    (adsetId) => {
      setExpandedAdsets((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(adsetId)) {
          newSet.delete(adsetId);
        } else {
          newSet.add(adsetId);
        }
        return newSet;
      });
    },
    [setExpandedAdsets]
  );

  const handleCampaignSelect = useCallback(
    (campaignId, checked) => {
      // Use Map for O(1) lookup
      const campaign = hierarchicalDataMap.get(campaignId?.toString());
      if (!campaign) return;

      // Use Sets for faster operations
      const newCampaignIdsSet = new Set(selectedCampaignIds.map((id) => id?.toString()));
      const newAdsetIdsSet = new Set(selectedAdsetIds.map((id) => id?.toString()));
      const newAdIdsSet = new Set(selectedAdIds.map((id) => id?.toString()));

      if (checked) {
        // Chọn campaign và tự động chọn tất cả adsets và ads của campaign đó
        newCampaignIdsSet.add(campaignId?.toString());
        campaign.adsets?.forEach((adset) => {
          const adsetId = adset.id?.toString();
          if (adsetId) {
            newAdsetIdsSet.add(adsetId);
            // Tự động chọn tất cả ads trong adset
            adset.ads?.forEach((ad) => {
              const adId = ad.id?.toString();
              if (adId) {
                newAdIdsSet.add(adId);
              }
            });
          }
        });
      } else {
        // Bỏ chọn campaign và tự động bỏ chọn tất cả adsets và ads của campaign đó
        newCampaignIdsSet.delete(campaignId?.toString());
        campaign.adsets?.forEach((adset) => {
          const adsetId = adset.id?.toString();
          if (adsetId) {
            newAdsetIdsSet.delete(adsetId);
            // Tự động bỏ chọn tất cả ads trong adset
            adset.ads?.forEach((ad) => {
              const adId = ad.id?.toString();
              if (adId) {
                newAdIdsSet.delete(adId);
              }
            });
          }
        });
      }

      // Convert Sets back to arrays
      const newCampaignIds = Array.from(newCampaignIdsSet);
      const newAdsetIds = Array.from(newAdsetIdsSet);
      const newAdIds = Array.from(newAdIdsSet);

      const applyToText = buildApplyToText(
        newCampaignIds,
        newAdsetIds,
        newAdIds
      );
      onSelectionChange(newCampaignIds, newAdsetIds, newAdIds, applyToText);
    },
    [hierarchicalDataMap, selectedCampaignIds, selectedAdsetIds, selectedAdIds, onSelectionChange]
  );

  const handleAdsetSelect = useCallback(
    (adsetId, campaignId, checked) => {
      // Use Map for O(1) lookup
      const campaign = hierarchicalDataMap.get(campaignId?.toString());
      if (!campaign) return;

      // Create adset map for O(1) lookup
      const adsetMap = new Map();
      campaign.adsets?.forEach((a) => {
        adsetMap.set(a.id?.toString(), a);
      });
      const adset = adsetMap.get(adsetId?.toString());
      if (!adset) return;

      // Use Sets for faster operations
      const newAdsetIdsSet = new Set(selectedAdsetIds.map((id) => id?.toString()));
      const newAdIdsSet = new Set(selectedAdIds.map((id) => id?.toString()));

      if (checked) {
        // Chọn adset và tự động chọn tất cả ads của adset đó
        newAdsetIdsSet.add(adsetId?.toString());
        adset.ads?.forEach((ad) => {
          const adId = ad.id?.toString();
          if (adId) {
            newAdIdsSet.add(adId);
          }
        });
      } else {
        // Bỏ chọn adset và tự động bỏ chọn tất cả ads của adset đó
        newAdsetIdsSet.delete(adsetId?.toString());
        adset.ads?.forEach((ad) => {
          const adId = ad.id?.toString();
          if (adId) {
            newAdIdsSet.delete(adId);
          }
        });
      }

      // Convert Sets back to arrays
      const newAdsetIds = Array.from(newAdsetIdsSet);
      const newAdIds = Array.from(newAdIdsSet);

      const applyToText = buildApplyToText(
        selectedCampaignIds,
        newAdsetIds,
        newAdIds
      );
      onSelectionChange(selectedCampaignIds, newAdsetIds, newAdIds, applyToText);
    },
    [hierarchicalDataMap, selectedCampaignIds, selectedAdsetIds, selectedAdIds, onSelectionChange]
  );

  const handleAdSelect = useCallback(
    (adId, adsetId, campaignId, checked) => {
      // Use Sets for faster operations
      // Ad được chọn độc lập, không ảnh hưởng đến adset hoặc campaign
      const newAdIdsSet = new Set(selectedAdIds.map((id) => id?.toString()));

      if (checked) {
        // Chỉ chọn ad, không tự động chọn adset/campaign
        newAdIdsSet.add(adId?.toString());
      } else {
        // Chỉ bỏ chọn ad, không tự động bỏ chọn adset/campaign
        newAdIdsSet.delete(adId?.toString());
      }

      // Convert Set back to array, giữ nguyên campaigns và adsets
      const newAdIds = Array.from(newAdIdsSet);

      const applyToText = buildApplyToText(
        selectedCampaignIds,
        selectedAdsetIds,
        newAdIds
      );
      onSelectionChange(selectedCampaignIds, selectedAdsetIds, newAdIds, applyToText);
    },
    [selectedCampaignIds, selectedAdsetIds, selectedAdIds, onSelectionChange]
  );

  // Use Set lookup for O(1) performance instead of O(n) some()
  const isCampaignSelected = useCallback(
    (campaignId) => {
      return selectedCampaignIdsSet.has(campaignId?.toString());
    },
    [selectedCampaignIdsSet]
  );

  const isAdsetSelected = useCallback(
    (adsetId) => {
      return selectedAdsetIdsSet.has(adsetId?.toString());
    },
    [selectedAdsetIdsSet]
  );

  const isAdSelected = useCallback(
    (adId) => {
      return selectedAdIdsSet.has(adId?.toString());
    },
    [selectedAdIdsSet]
  );

  const displayText = useMemo(() => {
    return (
      buildApplyToText(selectedCampaignIds, selectedAdsetIds, selectedAdIds) ||
      "Chọn đối tượng"
    );
  }, [selectedCampaignIds, selectedAdsetIds, selectedAdIds]);

  if (loading) {
    return (
      <div className="hierarchical-selector-wrapper">
        <button
          type="button"
          className="hierarchical-selector-trigger"
          disabled
        >
          <span>Đang tải dữ liệu...</span>
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

  if (hierarchicalData.length === 0) {
    return (
      <div className="hierarchical-selector-wrapper">
        <button
          type="button"
          className="hierarchical-selector-trigger"
          disabled
        >
          <span>Không có chiến dịch nào. Vui lòng tạo chiến dịch trước.</span>
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="hierarchical-selector-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className="hierarchical-selector-trigger"
        onClick={toggleDropdown}
      >
        <span
          className={
            !displayText || displayText === "Chọn đối tượng"
              ? "hierarchical-selector-placeholder"
              : ""
          }
        >
          {displayText}
        </span>
        {isDropdownOpen ? (
          <ChevronUp size={16} />
        ) : (
          <ChevronDown size={16} />
        )}
      </button>
      {isDropdownOpen && (
        <div className="hierarchical-selector">
          <div className="hierarchical-selector-container">
            {hierarchicalData.map((campaign) => {
              const campaignId = campaign.id?.toString();
              const isExpanded = expandedCampaigns.has(campaignId);
              const campaignSelected = isCampaignSelected(campaignId);

              return (
                <div key={campaignId} className="hierarchical-item">
                  <div className="hierarchical-item-row">
                    <label className="hierarchical-checkbox-label">
                      <input
                        type="checkbox"
                        checked={campaignSelected}
                        onChange={(e) =>
                          handleCampaignSelect(campaignId, e.target.checked)
                        }
                        className="hierarchical-checkbox"
                      />
                      <span className="hierarchical-label-text campaign-label">
                        {campaign.name || "Chiến dịch không tên"}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="hierarchical-expand-btn"
                      onClick={() => toggleCampaign(campaignId)}
                      disabled={!campaign.adsets || campaign.adsets.length === 0}
                    >
                      {campaign.adsets && campaign.adsets.length > 0 ? (
                        isExpanded ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )
                      ) : (
                        <span style={{ width: 16, display: "inline-block" }} />
                      )}
                    </button>
                  </div>

                  {isExpanded &&
                    campaign.adsets &&
                    campaign.adsets.length > 0 && (
                      <div className="hierarchical-children">
                        {campaign.adsets.map((adset) => {
                          const adsetId = adset.id?.toString();
                          const isAdsetExpanded = expandedAdsets.has(adsetId);
                          const adsetSelected = isAdsetSelected(adsetId);

                          return (
                            <div
                              key={adsetId}
                              className="hierarchical-item adset-item"
                            >
                              <div className="hierarchical-item-row">
                                <label className="hierarchical-checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={adsetSelected}
                                    onChange={(e) =>
                                      handleAdsetSelect(
                                        adsetId,
                                        campaignId,
                                        e.target.checked
                                      )
                                    }
                                    className="hierarchical-checkbox"
                                  />
                                  <span className="hierarchical-label-text adset-label">
                                    {adset.name || "Nhóm quảng cáo không tên"}
                                  </span>
                                </label>
                                <button
                                  type="button"
                                  className="hierarchical-expand-btn"
                                  onClick={() => toggleAdset(adsetId)}
                                  disabled={
                                    !adset.ads || adset.ads.length === 0
                                  }
                                >
                                  {adset.ads && adset.ads.length > 0 ? (
                                    isAdsetExpanded ? (
                                      <ChevronDown size={14} />
                                    ) : (
                                      <ChevronRight size={14} />
                                    )
                                  ) : (
                                    <span
                                      style={{
                                        width: 14,
                                        display: "inline-block",
                                      }}
                                    />
                                  )}
                                </button>
                              </div>

                              {isAdsetExpanded &&
                                adset.ads &&
                                adset.ads.length > 0 && (
                                  <div className="hierarchical-children">
                                    {adset.ads.map((ad) => {
                                      const adId = ad.id?.toString();
                                      const adSelected = isAdSelected(adId);

                                      return (
                                        <div
                                          key={adId}
                                          className="hierarchical-item ad-item"
                                        >
                                          <div className="hierarchical-item-row">
                                            <label className="hierarchical-checkbox-label">
                                              <input
                                                type="checkbox"
                                                checked={adSelected}
                                                onChange={(e) =>
                                                  handleAdSelect(
                                                    adId,
                                                    adsetId,
                                                    campaignId,
                                                    e.target.checked
                                                  )
                                                }
                                                className="hierarchical-checkbox"
                                              />
                                              <span className="hierarchical-label-text ad-label">
                                                {ad.name || "Quảng cáo không tên"}
                                              </span>
                                            </label>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo to prevent unnecessary re-renders
  // Compare references first for performance, then arrays by content
  if (prevProps.hierarchicalData !== nextProps.hierarchicalData) return false;
  if (prevProps.loading !== nextProps.loading) return false;
  if (prevProps.expandedCampaigns !== nextProps.expandedCampaigns) return false;
  if (prevProps.expandedAdsets !== nextProps.expandedAdsets) return false;
  
  // Compare arrays by reference first (most common case)
  if (prevProps.selectedCampaignIds === nextProps.selectedCampaignIds &&
      prevProps.selectedAdsetIds === nextProps.selectedAdsetIds &&
      prevProps.selectedAdIds === nextProps.selectedAdIds) {
    return true;
  }
  
  // If references differ, compare by length and content (shallow comparison)
  // This prevents re-render if arrays have same content but different reference
  const sameCampaignIds = prevProps.selectedCampaignIds.length === nextProps.selectedCampaignIds.length &&
    prevProps.selectedCampaignIds.every((id, i) => id?.toString() === nextProps.selectedCampaignIds[i]?.toString());
  const sameAdsetIds = prevProps.selectedAdsetIds.length === nextProps.selectedAdsetIds.length &&
    prevProps.selectedAdsetIds.every((id, i) => id?.toString() === nextProps.selectedAdsetIds[i]?.toString());
  const sameAdIds = prevProps.selectedAdIds.length === nextProps.selectedAdIds.length &&
    prevProps.selectedAdIds.every((id, i) => id?.toString() === nextProps.selectedAdIds[i]?.toString());
  
  return sameCampaignIds && sameAdsetIds && sameAdIds;
});

HierarchicalSelector.displayName = "HierarchicalSelector";

export default HierarchicalSelector;

