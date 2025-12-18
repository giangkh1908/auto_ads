import { useState } from 'react';

/**
 * Custom hook để quản lý selection state
 * Xử lý: checkboxes, selected items, campaign/adset navigation
 */
export function useAdsSelection() {
  const [checkAll, setCheckAll] = useState(false);
  const [hasSelectedItems, setHasSelectedItems] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedAdset, setSelectedAdset] = useState(null);

  /**
   * Reset tất cả selections
   */
  const resetSelection = () => {
    setSelectedCampaign(null);
    setSelectedAdset(null);
    setCheckAll(false);
    setHasSelectedItems(false);
  };

  /**
   * Navigate đến campaign và reset adset
   */
  const selectCampaign = (campaign) => {
    setSelectedCampaign(campaign);
    setSelectedAdset(null);
    setCheckAll(false);
    setHasSelectedItems(false);
  };

  /**
   * Navigate đến adset
   */
  const selectAdset = (adset) => {
    setSelectedAdset(adset);
    setCheckAll(false);
    setHasSelectedItems(false);
  };

  return {
    // State
    checkAll,
    hasSelectedItems,
    selectedCampaign,
    selectedAdset,
    
    // Setters
    setCheckAll,
    setHasSelectedItems,
    setSelectedCampaign,
    setSelectedAdset,
    
    // Actions
    resetSelection,
    selectCampaign,
    selectAdset
  };
}

