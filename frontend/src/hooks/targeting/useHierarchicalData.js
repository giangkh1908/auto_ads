import { useState, useEffect } from "react";
import axiosInstance from "../../utils/api/axios";
import {
  isExcludedStatus,
  buildHierarchicalStructure,
  extractIds,
  calculateExpandedItems,
} from "../../utils/business-logic/autoRuleUtils";

/**
 * Custom hook for fetching and managing hierarchical data (campaigns, adsets, ads)
 * @param {string} accountId - Account ID
 * @param {boolean} isOpen - Whether popup is open
 * @param {Object} editingRule - Rule being edited (null for new rule)
 * @returns {Object} - Hierarchical data and loading state
 */
export const useHierarchicalData = (accountId, isOpen, editingRule) => {
  const [hierarchicalData, setHierarchicalData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState(new Set());

  useEffect(() => {
    const fetchHierarchicalData = async () => {
      if (!accountId || !isOpen) {
        setHierarchicalData([]);
        setExpandedCampaigns(new Set());
        setExpandedAdsets(new Set());
        return;
      }

      try {
        setLoadingData(true);

        // Fetch all data in parallel for better performance
        const [campaignsRes, adsetsRes, adsRes] = await Promise.all([
          axiosInstance.get("/api/campaigns", {
            params: {
              account_id: accountId,
              fetch_all: true,
            },
          }),
          axiosInstance.get("/api/adsets", {
            params: {
              account_id: accountId,
              fetch_all: true,
            },
          }),
          axiosInstance.get("/api/ads", {
            params: {
              account_id: accountId,
              fetch_all: true,
            },
          }),
        ]);

        const campaignsData = campaignsRes.data?.items || [];
        const adsetsData = adsetsRes.data?.items || [];
        const adsData = adsRes.data?.items || [];

        // Filter by status - using filter for better performance than map+filter
        const filteredCampaigns = campaignsData.filter(
          (campaign) => !isExcludedStatus(campaign.status)
        );
        const filteredAdsets = adsetsData.filter(
          (adset) => !isExcludedStatus(adset.status)
        );
        const filteredAds = adsData.filter(
          (ad) => !isExcludedStatus(ad.status)
        );

        // Build hierarchical structure using optimized Map-based algorithm
        const hierarchical = buildHierarchicalStructure(
          filteredCampaigns,
          filteredAdsets,
          filteredAds
        );

        setHierarchicalData(hierarchical);

        // If editing, auto-expand selected campaigns/adsets
        // Use optimized Set-based calculation
        if (editingRule) {
          const selectedCampaignIds = extractIds(
            editingRule.apply_to_ids?.campaign_ids || []
          );
          const selectedAdsetIds = extractIds(
            editingRule.apply_to_ids?.adset_ids || []
          );
          const selectedAdIds = extractIds(
            editingRule.apply_to_ids?.ad_ids || []
          );

          // Calculate expanded items using optimized algorithm
          const { campaignsToExpand, adsetsToExpand } = calculateExpandedItems(
            hierarchical,
            selectedCampaignIds,
            selectedAdsetIds,
            selectedAdIds
          );

          setExpandedCampaigns(campaignsToExpand);
          setExpandedAdsets(adsetsToExpand);
        } else {
          // Reset expanded state when creating new rule
          setExpandedCampaigns(new Set());
          setExpandedAdsets(new Set());
        }
      } catch (error) {
        console.error("Error fetching hierarchical data:", error);
        setHierarchicalData([]);
        setExpandedCampaigns(new Set());
        setExpandedAdsets(new Set());
      } finally {
        setLoadingData(false);
      }
    };

    fetchHierarchicalData();
  }, [accountId, isOpen, editingRule]);

  return {
    hierarchicalData,
    loadingData,
    expandedCampaigns,
    expandedAdsets,
    setExpandedCampaigns,
    setExpandedAdsets,
  };
};

