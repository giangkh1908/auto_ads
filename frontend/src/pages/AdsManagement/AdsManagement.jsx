import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ROUTES } from "../../constants/app.constants";
import "./AdsManagement.css";
import CreateAdsWizard from "../../components/feature/CreateAdsWizard/CreateAdsWizard";
import ConfirmationPopup from "../../components/common/ConfirmationPopup/ConfirmationPopup";
import ProgressPopup from "../../components/common/ProgressPopup/Progress";
import { handleSelectAll, handleSelectItem } from "../../utils/selectionUtils";
import {
  deleteCampaign,
  deleteAdSet,
  deleteAd,
  archiveCampaign,
  archiveAdSet,
  archiveAd,
} from "../../services/adService";
// import { getAdPerformance, refreshAdPerformance } from "../../services/adPerformanceService";
import { toggleEntityStatus } from "../../services/toggleStatusService";
import { useToast } from "../../hooks/useToast";
import { useProgressState } from "../../hooks/useProgressState";
import { useAdsSelection } from "../../hooks/useAdsSelection";
import { useAdsAccount } from "./hooks/useAdsAccount";
import { useAdsDataFetching } from "./hooks/useAdsDataFetching";
import { useAdsSync } from "./hooks/useAdsSync";
import { useAdsTableState } from "./hooks/useAdsTableState";
import { invalidateCache } from "./services/adsCacheService";
import AdsToolbar from "./components/AdsToolbar";
import AdsTabs from "./components/AdsTabs";
import AdsTable from "./components/AdsTable";
import AdsBreadcrumb from "./components/AdsBreadcrumb";

function AdsManagement() {
  const { t } = useTranslation(['ads']);
  const navigate = useNavigate();
  const toast = useToast();
  const { progressState, openProgress, updateProgress, closeProgress } = useProgressState();

  // Wizard state
  const [activeTab, setActiveTab] = useState("campaigns");
  const [showWizard, setShowWizard] = useState(false);
  const [wizardMode, setWizardMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);

  // Account management
  const {
    adAccounts,
    selectedAccountId,
    loadingAccounts,
    initialized,
    handleAccountChange: handleAccountChangeBase,
  } = useAdsAccount();

  // Selection management
  const {
    checkAll,
    hasSelectedItems,
    selectedCampaign,
    selectedAdset,
    setCheckAll,
    setHasSelectedItems,
    setSelectedCampaign,
    setSelectedAdset,
    resetSelection,
    selectCampaign,
    selectAdset,
  } = useAdsSelection();

  // Data state
  const [datasets, setDatasets] = useState({
    campaigns: [],
    adsets: [],
    ads: [],
  });

  // Cache state
  const [cache, setCache] = useState({
    lastSync: null,
    lastFetch: {},
    loadedAccounts: new Set() // Track accounts đã load đầy đủ data
  });

  // Refs
  const abortControllerRef = useRef(null);
  const prevActiveTabRef = useRef(activeTab);

  // Sync hook
  const { syncData } = useAdsSync(cache, setCache, activeTab);

  // Data fetching hook
  const {
    fetchCampaignsForAccount,
    fetchAdsetsForCampaign,
    fetchAdsForAdset,
    fetchAllAdsetsForAccount,
    fetchAllAdsForAccount,
  } = useAdsDataFetching(datasets, setDatasets, cache, setCache);

  // Table state hook
  const {
    pagination,
    rows,
    searchTerm,
    setSearchTerm,
    dateRange,
    setDateRange,
    handlePageChange,
    handleItemsPerPageChange,
  } = useAdsTableState(datasets, activeTab, selectedCampaign, selectedAdset);

  // Action states
  const [refreshing, setRefreshing] = useState(false);
  const [togglingItems, setTogglingItems] = useState(new Set());
  const [confirmationPopup, setConfirmationPopup] = useState({
    isOpen: false,
    type: "delete",
    title: "",
    message: "",
    onConfirm: null,
    isLoading: false,
  });

  // Helper function
  const getEntityName = (key) => {
    return t(`entity_names.${key}`, { defaultValue: key });
  };

  const getEntityKey = () => {
    return activeTab === "campaigns" ? "campaigns" : activeTab === "adsets" ? "adsets" : "ads";
  };

  const getEntityType = () => {
    return activeTab === "campaigns" ? "campaign" : activeTab === "adsets" ? "adset" : "ad";
  };

  // Handle account change
  const handleAccountChange = (accountId) => {
    handleAccountChangeBase(accountId);
    resetSelection();
    setActiveTab("campaigns");
    prevActiveTabRef.current = "campaigns";
    if (!accountId) {
      setDatasets({ campaigns: [], adsets: [], ads: [] });
      setCache({ lastSync: null, lastFetch: {} });
    }
  };

  // Sync data when account changes
  useEffect(() => {
    if (selectedAccountId && initialized) {
      syncData(selectedAccountId);
    }
  }, [selectedAccountId, initialized, syncData]);

  // Cleanup AbortController
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Load data when tab or account changes
  useEffect(() => {
    if (selectedAccountId && initialized) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const isTabChanged = prevActiveTabRef.current !== activeTab;
      if (isTabChanged) {
        prevActiveTabRef.current = activeTab;
      }

      const fetchData = async () => {
        try {
    if (activeTab === "campaigns") {
            await fetchCampaignsForAccount(selectedAccountId);
    } else if (activeTab === "adsets") {
      if (selectedCampaign) {
              await fetchAdsetsForCampaign(selectedCampaign.id, selectedAccountId);
            } else {
              await fetchAllAdsetsForAccount(selectedAccountId);
            }
    } else if (activeTab === "ads") {
      if (selectedAdset) {
              await fetchAdsForAdset(selectedAdset.id, selectedAccountId);
            } else {
              await fetchAllAdsForAccount(selectedAccountId);
            }
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error("Error fetching data:", error);
          }
        }
      };

      fetchData();

      return () => {
        if (abortControllerRef.current === abortController) {
          abortController.abort();
        }
      };
    }
  }, [
    selectedAccountId,
    initialized,
    activeTab,
    selectedCampaign,
    selectedAdset,
    fetchCampaignsForAccount,
    fetchAdsetsForCampaign,
    fetchAllAdsetsForAccount,
    fetchAdsForAdset,
    fetchAllAdsForAccount,
  ]);

  // Toggle row
  const toggleRow = async (id) => {
    const key = getEntityKey();
    const entityType = getEntityType();
    const row = datasets[key].find((r) => r.id === id);

    if (!row) {
      toast.error(t('toasts.item_not_found'));
      return;
    }

    if (!row.external_id) {
      toast.warning(t('toasts.cannot_sync_facebook'), {
        description: t('toasts.no_external_id'),
      });
      return;
    }

    const newStatus = !row.enabled;
    const facebookStatus = newStatus ? "ACTIVE" : "PAUSED";
    const displayStatus = newStatus ? "Hoạt động" : "Tạm dừng";

    setTogglingItems((prev) => new Set(prev).add(id));

    let childAdsets = [];
    let childAds = [];

    if (entityType === "campaign" && !newStatus) {
      childAdsets = datasets.adsets.filter(
        (adset) => String(adset.campaignId) === String(row.id) && adset.external_id
      );
      const adsetIds = childAdsets.map((a) => String(a.id));
      childAds = datasets.ads.filter(
        (ad) => adsetIds.includes(String(ad.adsetId)) && ad.external_id
      );
    } else if (entityType === "adset" && !newStatus) {
      childAds = datasets.ads.filter(
        (ad) => String(ad.adsetId) === String(row.id) && ad.external_id
      );
    }

    const allTogglingIds = new Set([id]);
    childAdsets.forEach((adset) => allTogglingIds.add(adset.id));
    childAds.forEach((ad) => allTogglingIds.add(ad.id));
    setTogglingItems((prev) => new Set([...prev, ...allTogglingIds]));

    // Optimistic update
    setDatasets((prev) => {
      const updated = { ...prev };
      updated[key] = prev[key].map((r) =>
        r.id !== id ? r : { ...r, enabled: newStatus, status: displayStatus }
      );

      if (entityType === "campaign" && !newStatus && childAdsets.length > 0) {
        updated.adsets = prev.adsets.map((adset) => {
          if (childAdsets.some((ca) => ca.id === adset.id)) {
            return { ...adset, enabled: false, status: "Tạm dừng" };
          }
          return adset;
        });
      }

      if ((entityType === "campaign" || entityType === "adset") && !newStatus && childAds.length > 0) {
        updated.ads = prev.ads.map((ad) => {
          if (childAds.some((ca) => ca.id === ad.id)) {
            return { ...ad, enabled: false, status: "Tạm dừng" };
          }
          return ad;
        });
      }

      return updated;
    });

    try {
      await toggleEntityStatus(entityType, row.external_id, facebookStatus);

      let adsetSuccessCount = 0;
      let adsetErrorCount = 0;
      let adSuccessCount = 0;
      let adErrorCount = 0;

      if (entityType === "campaign" && !newStatus && childAdsets.length > 0) {
        const adsetResults = await Promise.allSettled(
          childAdsets.map((adset) =>
            toggleEntityStatus("adset", adset.external_id, "PAUSED")
          )
        );
        adsetResults.forEach((result) => {
          if (result.status === 'fulfilled') adsetSuccessCount++;
          else adsetErrorCount++;
        });
      }

      if ((entityType === "campaign" || entityType === "adset") && !newStatus && childAds.length > 0) {
        const adResults = await Promise.allSettled(
          childAds.map((ad) =>
            toggleEntityStatus("ad", ad.external_id, "PAUSED")
          )
        );
        adResults.forEach((result) => {
          if (result.status === 'fulfilled') adSuccessCount++;
          else adErrorCount++;
        });
      }

      const entityLabel = getEntityName(entityType);
      const action = newStatus ? t('toasts.toggle_on') : t('toasts.toggle_off');
      const totalChildCount = childAdsets.length + childAds.length;
      const totalSuccessCount = adsetSuccessCount + adSuccessCount;
      const totalErrorCount = adsetErrorCount + adErrorCount;

      if (totalChildCount > 0) {
        if (totalErrorCount === 0) {
          toast.success(
            `${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} ${t('toasts.toggle_success')} ${action}. ${totalSuccessCount} ${t('toasts.child_entities_updated') || 'entities con đã được đồng bộ trên Facebook'}.`
          );
        } else {
          toast.warning(
            `${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} ${t('toasts.toggle_success')} ${action}. ${totalSuccessCount}/${totalChildCount} entities con đã được đồng bộ trên Facebook. ${totalErrorCount} entities gặp lỗi.`
          );
        }
      } else {
        toast.success(
          `${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} ${t('toasts.toggle_success')} ${action} trên Facebook.`
        );
      }
    } catch (error) {
      // Revert UI
      setDatasets((prev) => {
        const updated = { ...prev };
        updated[key] = prev[key].map((r) =>
          r.id !== id ? r : { ...r, enabled: !newStatus, status: !newStatus ? "Hoạt động" : "Tạm dừng" }
        );

        if (entityType === "campaign" && !newStatus && childAdsets.length > 0) {
          updated.adsets = prev.adsets.map((adset) => {
            const originalAdset = childAdsets.find((ca) => ca.id === adset.id);
            return originalAdset ? { ...adset, enabled: originalAdset.enabled, status: originalAdset.status } : adset;
          });
        }

        if ((entityType === "campaign" || entityType === "adset") && !newStatus && childAds.length > 0) {
          updated.ads = prev.ads.map((ad) => {
            const originalAd = childAds.find((ca) => ca.id === ad.id);
            return originalAd ? { ...ad, enabled: originalAd.enabled, status: originalAd.status } : ad;
          });
        }

        return updated;
      });

      const action = newStatus ? t('toasts.toggle_on') : t('toasts.toggle_off');
      toast.error(`${t('toasts.toggle_error')} ${action} ${getEntityName(entityType)}`, {
        description: error.message,
      });
    } finally {
      setTogglingItems((prev) => {
        const newSet = new Set(prev);
        allTogglingIds.forEach((toggleId) => newSet.delete(toggleId));
        return newSet;
      });
    }
  };

  // Check All
  const handleCheckAll = (event) => {
    const isChecked = event.target.checked;
    setCheckAll(isChecked);
    setHasSelectedItems(isChecked);
    const key = getEntityKey();
    setDatasets((prev) => {
      const updatedItems = handleSelectAll(isChecked, prev[key]);
      return { ...prev, [key]: updatedItems };
    });
  };

  // Check Single
  const handleCheckItem = (id) => {
    const key = getEntityKey();
    setDatasets((prev) => {
      const { updatedItems, allChecked } = handleSelectItem(id, prev[key]);
      setCheckAll(allChecked);
      setHasSelectedItems(updatedItems.some((item) => item.isChecked));
      return { ...prev, [key]: updatedItems };
    });
  };

  // Edit item
  const handleUpdate = (id) => {
    const item = rows.find((row) => row.id === id);
    if (!item) return;

    const type = getEntityType();
    let campaign = null;
    let adset = null;

    if (type === "campaign") {
      campaign = item;
    } else if (type === "adset") {
      adset = item;
      campaign = datasets.campaigns.find((c) => c.id === item.campaignId) || null;
    } else if (type === "ad") {
      adset = datasets.adsets.find((a) => a.id === item.adsetId) || null;
      campaign = adset ? datasets.campaigns.find((c) => c.id === adset.campaignId) || null : null;
    }

    setEditingItem({
      type,
      data: { ...item, external_id: item.external_id },
    });
    setWizardMode("edit");
    setShowWizard(true);

    if (campaign) setSelectedCampaign(campaign);
    if (adset) setSelectedAdset(adset);
  };

  // Archive
  const handleArchive = (id) => {
    const key = getEntityKey();
    const idsToArchive = id
      ? [id]
      : datasets[key].filter((item) => item.isChecked).map((item) => item.id);

    if (idsToArchive.length === 0) {
      toast.warning(t('toasts.select_item_archive_warning'));
      return;
    }

    const entityName = getEntityName(key);
    setConfirmationPopup({
      isOpen: true,
      type: "archive",
      title: t('confirmations.archive_title', { count: idsToArchive.length, entity: entityName }),
      message: t('confirmations.archive_message', { count: idsToArchive.length, entity: entityName }),
      onConfirm: () => executeArchive(idsToArchive),
      isLoading: false,
    });
  };

  const executeArchive = async (idsToArchive) => {
    setConfirmationPopup((prev) => ({ ...prev, isOpen: false }));
    const key = getEntityKey();
    const entityName = getEntityName(key);

    openProgress({
      type: 'archive',
      title: t('progress.archiving', { entity: entityName }),
      total: idsToArchive.length,
    });

    try {
      const fbToken = localStorage.getItem("fb_access_token") || null;
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < idsToArchive.length; i++) {
        const archiveId = idsToArchive[i];
        try {
          updateProgress({
            current: i,
            message: t('progress.archiving_progress', { entity: entityName, current: i + 1, total: idsToArchive.length }),
          });

          if (key === "campaigns") {
            await archiveCampaign(archiveId, fbToken);
          } else if (key === "adsets") {
            await archiveAdSet(archiveId, fbToken);
          } else {
            await archiveAd(archiveId, fbToken);
          }

          successCount++;
          updateProgress({
            current: i + 1,
            message: t('progress.archived', { current: i + 1, total: idsToArchive.length, entity: entityName }),
          });
        } catch (itemError) {
          errorCount++;
          errors.push({
            id: archiveId,
            error: itemError?.response?.data?.message || itemError.message,
          });
        }
      }

      const processedIds = idsToArchive.slice(0, successCount);
      setDatasets((prev) => ({
        ...prev,
        [key]: prev[key].filter((item) => !processedIds.includes(item.id)),
      }));
      setCheckAll(false);
      setHasSelectedItems(false);

      if (successCount > 0 && selectedAccountId) {
        setCache(prev => invalidateCache(prev, selectedAccountId, key));
      }

      if (errorCount === 0) {
        updateProgress({
          status: 'success',
          current: idsToArchive.length,
          message: t('progress.completed'),
          successCount,
          errorCount: 0,
        });
        toast.success(t('toasts.archive_success', { count: successCount, entity: entityName }));
      } else if (successCount > 0) {
        updateProgress({
          status: 'partial',
          current: idsToArchive.length,
          message: t('progress.completed_with_errors', { errorCount }),
          successCount,
          errorCount,
          errors,
        });
        toast.warning(t('toasts.archive_partial', { successCount, total: idsToArchive.length, entity: entityName, errorCount }));
      } else {
        updateProgress({
          status: 'error',
          message: t('progress.archive_failed'),
          errorCount,
          errors,
        });
        toast.error(t('toasts.archive_failed'));
      }

      if (successCount > 0) {
        handleRefresh();
      }
    } catch (error) {
      updateProgress({
        status: 'error',
        message: error?.response?.data?.message || t('toasts.archive_failed'),
      });
      toast.error(error?.response?.data?.message || t('toasts.archive_failed'));
    }
  };

  // Delete
  const handleDelete = (id) => {
    const key = getEntityKey();
    const idsToDelete = id
      ? [id]
      : datasets[key].filter((item) => item.isChecked).map((item) => item.id);

    if (idsToDelete.length === 0) {
      toast.warning(t('toasts.select_item_warning'));
      return;
    }

    const entityName = getEntityName(key);
    setConfirmationPopup({
      isOpen: true,
      type: "delete",
      title: t('confirmations.delete_title', { count: idsToDelete.length, entity: entityName }),
      message: t('confirmations.delete_message', { count: idsToDelete.length, entity: entityName }),
      onConfirm: () => executeDelete(idsToDelete),
      isLoading: false,
    });
  };

  const executeDelete = async (idsToDelete) => {
    setConfirmationPopup((prev) => ({ ...prev, isOpen: false }));
    const key = getEntityKey();
    const entityName = getEntityName(key);

    openProgress({
      type: 'delete',
      title: t('progress.deleting', { entity: entityName }),
      total: idsToDelete.length,
    });

    try {
      const fbToken = localStorage.getItem("fb_access_token") || null;
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < idsToDelete.length; i++) {
        const delId = idsToDelete[i];
        try {
          updateProgress({
            current: i,
            message: t('progress.deleting_progress', { entity: entityName, current: i + 1, total: idsToDelete.length }),
          });

          if (key === "campaigns") {
            await deleteCampaign(delId, fbToken);
          } else if (key === "adsets") {
            await deleteAdSet(delId, fbToken);
          } else {
            await deleteAd(delId, fbToken);
          }

          successCount++;
          updateProgress({
            current: i + 1,
            message: t('progress.deleted', { current: i + 1, total: idsToDelete.length, entity: entityName }),
          });
        } catch (itemError) {
          errorCount++;
          errors.push({
            id: delId,
            error: itemError?.response?.data?.message || itemError.message,
          });
        }
      }

      const processedIds = idsToDelete.slice(0, successCount);
      setDatasets((prev) => ({
        ...prev,
        [key]: prev[key].filter((item) => !processedIds.includes(item.id)),
      }));
      setCheckAll(false);
      setHasSelectedItems(false);

      if (successCount > 0 && selectedAccountId) {
        setCache(prev => invalidateCache(prev, selectedAccountId, key));
      }

      if (errorCount === 0) {
        updateProgress({
          status: 'success',
          current: idsToDelete.length,
          message: t('progress.completed'),
          successCount,
          errorCount: 0,
        });
        toast.success(t('toasts.delete_success', { count: successCount, entity: entityName }));
      } else if (successCount > 0) {
        updateProgress({
          status: 'partial',
          current: idsToDelete.length,
          message: t('progress.completed_with_errors', { errorCount }),
          successCount,
          errorCount,
          errors,
        });
        toast.warning(t('toasts.delete_partial', { successCount, total: idsToDelete.length, entity: entityName, errorCount }));
      } else {
        updateProgress({
          status: 'error',
          message: t('progress.delete_failed'),
          errorCount,
          errors,
        });
        toast.error(t('toasts.delete_failed'));
      }

      if (successCount > 0) {
        handleRefresh();
      }
    } catch (error) {
      updateProgress({
        status: 'error',
        message: error?.response?.data?.message || t('toasts.delete_failed'),
      });
      toast.error(error?.response?.data?.message || t('toasts.delete_failed'));
    }
  };

  // Navigation
  const handleCampaignClick = (campaign) => {
    selectCampaign(campaign);
    setActiveTab("adsets");
  };

  const handleAdsetClick = (adset) => {
    selectAdset(adset);
    setActiveTab("ads");
  };

  // Refresh
  const handleRefresh = useCallback(async () => {
    if (!selectedAccountId) {
      toast.warning(t('toasts.select_account_warning'), {
        description: t('toasts.select_account_description'),
      });
      return;
    }

    setRefreshing(true);
    try {
      await syncData(selectedAccountId, true);
      
      if (activeTab === "campaigns") {
        await fetchCampaignsForAccount(selectedAccountId);
      } else if (activeTab === "adsets") {
        if (selectedCampaign) {
          await fetchAdsetsForCampaign(selectedCampaign.id, selectedAccountId);
        } else {
          await fetchAllAdsetsForAccount(selectedAccountId);
        }
      } else if (activeTab === "ads") {
        if (selectedAdset) {
          await fetchAdsForAdset(selectedAdset.id, selectedAccountId);
        } else {
          await fetchAllAdsForAccount(selectedAccountId);
        }
      }

      toast.success(t('toasts.refresh_success'));
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error(t('toasts.refresh_error'));
    } finally {
      setRefreshing(false);
    }
  }, [selectedAccountId, activeTab, selectedCampaign, selectedAdset, syncData, fetchCampaignsForAccount, fetchAdsetsForCampaign, fetchAllAdsetsForAccount, fetchAdsForAdset, fetchAllAdsForAccount, toast, t]);

  // Fetch only (no sync)
  const handleFetchOnly = useCallback(async () => {
    if (!selectedAccountId) return;

    try {
      if (activeTab === "campaigns") {
        await fetchCampaignsForAccount(selectedAccountId);
      } else if (activeTab === "adsets") {
        if (selectedCampaign) {
          await fetchAdsetsForCampaign(selectedCampaign.id, selectedAccountId);
        } else {
          await fetchAllAdsetsForAccount(selectedAccountId);
        }
      } else if (activeTab === "ads") {
        if (selectedAdset) {
          await fetchAdsForAdset(selectedAdset.id, selectedAccountId);
        } else {
          await fetchAllAdsForAccount(selectedAccountId);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [selectedAccountId, activeTab, selectedCampaign, selectedAdset, fetchCampaignsForAccount, fetchAdsetsForCampaign, fetchAllAdsetsForAccount, fetchAdsForAdset, fetchAllAdsForAccount]);

  // Tab change handler
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetSelection();
  };

  return (
    <div className="ads-management-layout">
      <div className="ads-management-content">
        <div className="ads-management-center">
          <div className="ads-card">
            <AdsToolbar
              adAccounts={adAccounts}
              selectedAccountId={selectedAccountId}
              loadingAccounts={loadingAccounts}
              onAccountChange={handleAccountChange}
              onCreateCampaign={() => {
                    if (!selectedAccountId) return;
                    setWizardMode("create");
                    setEditingItem(null);
                    resetSelection();
                    setShowWizard(true);
                  }}
              onCreateRule={() => {
                if (selectedAccountId) {
                    navigate(ROUTES.AUTOMATION_RULE);
                }
              }}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />

            <AdsBreadcrumb
              selectedCampaign={selectedCampaign}
              selectedAdset={selectedAdset}
              onReset={() => {
                    resetSelection();
                    setActiveTab("campaigns");
                  }}
              onCampaignClick={() => {
                        setSelectedAdset(null);
                        setActiveTab("adsets");
                      }}
              onAdsetClick={() => setActiveTab("ads")}
            />

            <AdsTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              hasSelectedItems={hasSelectedItems}
              onArchive={() => handleArchive()}
              onDelete={() => handleDelete()}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              selectedAccountId={selectedAccountId}
            />

            <AdsTable
              activeTab={activeTab}
              rows={rows}
              checkAll={checkAll}
              onCheckAll={handleCheckAll}
              onCheckItem={handleCheckItem}
              onToggleRow={toggleRow}
              togglingItems={togglingItems}
              onUpdate={handleUpdate}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onCampaignClick={handleCampaignClick}
              onAdsetClick={handleAdsetClick}
              pagination={pagination}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
              refreshing={refreshing}
            />
          </div>
        </div>
      </div>

      {showWizard && (
        <CreateAdsWizard
          onClose={() => {
            setShowWizard(false);
            setEditingItem(null);
            setWizardMode("create");
          }}
          onSuccess={() => {
            handleRefresh();
          }}
          onError={() => {
            handleFetchOnly();
          }}
          onDraftSaved={() => {
            handleFetchOnly();
          }}
          mode={wizardMode}
          editingItem={editingItem}
          selectedCampaign={selectedCampaign}
          selectedAdset={selectedAdset}
          datasets={datasets}
          setDatasets={setDatasets}
          selectedAccountId={selectedAccountId}
        />
      )}

      <ConfirmationPopup
        isOpen={confirmationPopup.isOpen}
        onClose={() =>
          setConfirmationPopup((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={confirmationPopup.onConfirm}
        title={confirmationPopup.title}
        message={confirmationPopup.message}
        type={confirmationPopup.type}
        isLoading={confirmationPopup.isLoading}
      />

      <ProgressPopup
        isOpen={progressState.isOpen}
        type={progressState.type}
        title={progressState.title}
        progress={progressState.progress}
        onClose={closeProgress}
      />

    </div>
  );
}

export default AdsManagement;
