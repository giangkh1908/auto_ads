import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Edit, Archive, Trash, RefreshCw, Search, Settings, Plus  } from "lucide-react";
import Pagination from "../../components/common/Pagination/Pagination";
import "./AdsManagement.css";
import CreateAdsWizard from "../../components/feature/CreateAdsWizard/CreateAdsWizard";
import ConfirmationPopup from "../../components/common/ConfirmationPopup/ConfirmationPopup";
import ProgressPopup from "../../components/common/ProgressPopup/Progress";
import DateRangePicker from "../../components/common/DateRangePicker/DateRangePicker";
import { handleSelectAll, handleSelectItem } from "../../utils/selectionUtils";
import { ROUTES } from "../../constants/app.constants";
import {
  deleteCampaign,
  deleteAdSet,
  deleteAd,
  archiveCampaign,
  archiveAdSet,
  archiveAd,
} from "../../services/adService";
import { getAdPerformance, refreshAdPerformance } from "../../services/adPerformanceService";
import { toggleEntityStatus } from "../../services/toggleStatusService";
import axiosInstance from "../../utils/axios";
import { useToast } from "../../hooks/useToast";
import { translateStatus, getStatusClass } from "../../utils/statusUtils";
import { useProgressState } from "../../hooks/useProgressState";
import { useTranslation } from "react-i18next";
import { translateObjective, translateOptimizationGoal, formatTargetingVN } from "../../utils/translationUtils";

function AdsManagement() {
  const { t } = useTranslation(['ads']);
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [showWizard, setShowWizard] = useState(false);
  const [wizardMode, setWizardMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedAdset, setSelectedAdset] = useState(null);

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({ from: null, to: null });

  // Account
  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Data - lưu TẤT CẢ data đã fetch từ BE (chưa phân trang ở FE)
  // Dùng cho việc sort và phân trang ở Frontend
  const [datasets, setDatasets] = useState({
    campaigns: [],
    adsets: [],
    ads: [],
  });

  // Cache để tránh gọi API trùng lặp
  const [cache, setCache] = useState({
    lastSync: null,
    lastFetch: {},
    loadedAccounts: new Set() // Track accounts đã load đầy đủ data
  });

  // Refs for optimization
  const prevActiveTabRef = useRef(activeTab);
  const activeTabRef = useRef(activeTab);
  const cacheRef = useRef(cache);
  const datasetsRef = useRef(datasets);
  const abortControllerRef = useRef(null);

  // Update refs when state changes
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  useEffect(() => {
    datasetsRef.current = datasets;
  }, [datasets]);

  // 🔹 Pagination state (phải khai báo trước getFilteredRows)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });

  const [checkAll, setCheckAll] = useState(false);
  const [hasSelectedItems, setHasSelectedItems] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingItems, setTogglingItems] = useState(new Set());
  // eslint-disable-next-line no-unused-vars
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Confirmation popup state
  const [confirmationPopup, setConfirmationPopup] = useState({
    isOpen: false,
    type: "delete", // 'delete' | 'archive'
    title: "",
    message: "",
    onConfirm: null,
    isLoading: false,
  });

  // Progress popup state
  const { progressState, openProgress, updateProgress, closeProgress } = useProgressState();

  // Helper function to get entity name
  const getEntityName = (key) => {
    return t(`entity_names.${key}`, { defaultValue: key });
  };

  // Helper function để sort theo created_at (newest first)
  const sortByCreatedAtDesc = (array) => {
    return [...array].sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
      return dateB - dateA; // Newest first
    });
  };

  // 🔹 Filter data for active tab, sort và phân trang ở FE
  // ✅ Backend trả về TẤT CẢ items (bao gồm cả DELETED), Frontend sẽ filter DELETED
  const getFilteredRows = () => {
    let result = [];
    
    if (activeTab === "campaigns") {
      // Filter DELETED ở Frontend và filter theo context nếu cần
      result = datasets.campaigns.filter(
        (campaign) => campaign.status !== "DELETED" && campaign.status !== "ARCHIVED"
      );
    } else if (activeTab === "adsets") {
      let filteredAdsets = datasets.adsets.filter(
        (adset) => adset.status !== "DELETED" && adset.status !== "ARCHIVED"
      );

      if (selectedCampaign) {
        filteredAdsets = filteredAdsets.filter(
          (a) => a.campaignId === selectedCampaign.id
        );
      }
      result = filteredAdsets;
    } else if (activeTab === "ads") {
      let filteredAds = datasets.ads.filter(
        (ad) => ad.status !== "DELETED" && ad.status !== "ARCHIVED"
      );

      if (selectedAdset) {
        filteredAds = filteredAds.filter((a) => String(a.adsetId) === String(selectedAdset.id));
      } else if (selectedCampaign) {
        // Filter ads thông qua adset relationship
        const campaignAdsets = datasets.adsets.filter(
          (adset) => adset.campaignId === selectedCampaign.id
        );
        const campaignAdsetIds = campaignAdsets.map((adset) => String(adset.id));
        
        // Filter ads thuộc các adsets này
        filteredAds = filteredAds.filter((ad) => 
          campaignAdsetIds.includes(String(ad.adsetId))
        );
      }
      result = filteredAds;
    }
    
    // Sort tất cả data trước khi phân trang
    const sortedResult = sortByCreatedAtDesc(result);
    
    // Cập nhật pagination info dựa trên sorted data
    const total = sortedResult.length;
    const totalPages = Math.ceil(total / pagination.limit) || 1;
    
    // Cập nhật pagination state (chỉ khi thay đổi)
    if (pagination.total !== total || pagination.totalPages !== totalPages) {
      setPagination(prev => ({
        ...prev,
        total,
        totalPages
      }));
    }
    
    // Phân trang ở Frontend sau khi sort
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return sortedResult.slice(startIndex, endIndex);
  };
  const rows = getFilteredRows();

  // 🔹 Toggle ON/OFF với đồng bộ Facebook API
  const toggleRow = async (id) => {
    const key =
      activeTab === "campaigns"
        ? "campaigns"
        : activeTab === "adsets"
        ? "adsets"
        : "ads";

    const entityType = activeTab.slice(0, -1); // "campaigns" -> "campaign", "adsets" -> "adset", "ads" -> "ad"
    const row = datasets[key].find((r) => r.id === id);

    if (!row) {
      toast.error(t('toasts.item_not_found'));
      return;
    }

    // Kiểm tra có external_id không (cần để gọi Facebook API)
    if (!row.external_id) {
      toast.warning(t('toasts.cannot_sync_facebook'), {
        description: t('toasts.no_external_id'),
      });
      return;
    }

    const newStatus = !row.enabled;
    const facebookStatus = newStatus ? "ACTIVE" : "PAUSED";
    const displayStatus = newStatus ? "Hoạt động" : "Tạm dừng";

    // Thêm vào loading state
    setTogglingItems((prev) => new Set(prev).add(id));

    // Tìm các entity con cần toggle (khi OFF)
    let childAdsets = [];
    let childAds = [];

    if (entityType === "campaign" && !newStatus) {
      // Khi OFF campaign: tìm tất cả adsets và ads thuộc campaign
      childAdsets = datasets.adsets.filter(
        (adset) => String(adset.campaignId) === String(row.id) && adset.external_id
      );
      const adsetIds = childAdsets.map((a) => String(a.id));
      childAds = datasets.ads.filter(
        (ad) => adsetIds.includes(String(ad.adsetId)) && ad.external_id
      );
    } else if (entityType === "adset" && !newStatus) {
      // Khi OFF adset: tìm tất cả ads thuộc adset
      childAds = datasets.ads.filter(
        (ad) => String(ad.adsetId) === String(row.id) && ad.external_id
      );
    }

    // Thêm tất cả child entities vào loading state
    const allTogglingIds = new Set([id]);
    childAdsets.forEach((adset) => allTogglingIds.add(adset.id));
    childAds.forEach((ad) => allTogglingIds.add(ad.id));
    setTogglingItems((prev) => new Set([...prev, ...allTogglingIds]));

    // Optimistic update - cập nhật UI trước
    setDatasets((prev) => {
      const updated = { ...prev };
      
      // Update chính entity
      updated[key] = prev[key].map((r) =>
        r.id !== id
          ? r
          : {
              ...r,
              enabled: newStatus,
              status: displayStatus,
            }
      );

      // Update child adsets (khi OFF campaign)
      if (entityType === "campaign" && !newStatus && childAdsets.length > 0) {
        updated.adsets = prev.adsets.map((adset) => {
          if (childAdsets.some((ca) => ca.id === adset.id)) {
            return {
              ...adset,
              enabled: false,
              status: "Tạm dừng",
            };
          }
          return adset;
        });
      }

      // Update child ads (khi OFF campaign hoặc adset)
      if ((entityType === "campaign" || entityType === "adset") && !newStatus && childAds.length > 0) {
        updated.ads = prev.ads.map((ad) => {
          if (childAds.some((ca) => ca.id === ad.id)) {
            return {
              ...ad,
              enabled: false,
              status: "Tạm dừng",
            };
          }
          return ad;
        });
      }

      return updated;
    });

    try {
      // Toggle chính entity trên Facebook
      await toggleEntityStatus(entityType, row.external_id, facebookStatus);
      console.log(`✅ ${entityType} ${row.external_id} đã được ${facebookStatus} trên Facebook`);

      let adsetSuccessCount = 0;
      let adsetErrorCount = 0;
      let adSuccessCount = 0;
      let adErrorCount = 0;

      // Toggle child adsets trên Facebook (khi OFF campaign)
      if (entityType === "campaign" && !newStatus && childAdsets.length > 0) {
        console.log(`🔄 Đang tắt ${childAdsets.length} adsets trên Facebook...`);
        const adsetResults = await Promise.allSettled(
          childAdsets.map((adset) =>
            toggleEntityStatus("adset", adset.external_id, "PAUSED")
          )
        );
        
        adsetResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            adsetSuccessCount++;
            console.log(`✅ Adset ${childAdsets[index].external_id} đã được PAUSED trên Facebook`);
          } else {
            adsetErrorCount++;
            console.error(`❌ Lỗi khi tắt adset ${childAdsets[index].external_id}:`, result.reason);
          }
        });
      }

      // Toggle child ads trên Facebook (khi OFF campaign hoặc adset)
      if ((entityType === "campaign" || entityType === "adset") && !newStatus && childAds.length > 0) {
        console.log(`🔄 Đang tắt ${childAds.length} ads trên Facebook...`);
        const adResults = await Promise.allSettled(
          childAds.map((ad) =>
            toggleEntityStatus("ad", ad.external_id, "PAUSED")
          )
        );
        
        adResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            adSuccessCount++;
            console.log(`✅ Ad ${childAds[index].external_id} đã được PAUSED trên Facebook`);
          } else {
            adErrorCount++;
            console.error(`❌ Lỗi khi tắt ad ${childAds[index].external_id}:`, result.reason);
          }
        });
      }

      const entityLabel = getEntityName(entityType);
      const action = newStatus ? t('toasts.toggle_on') : t('toasts.toggle_off');
      const totalChildCount = childAdsets.length + childAds.length;
      const totalSuccessCount = adsetSuccessCount + adSuccessCount;
      const totalErrorCount = adsetErrorCount + adErrorCount;

      // Thông báo kết quả
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
      // Revert UI nếu API call thất bại
      setDatasets((prev) => {
        const updated = { ...prev };
        
        // Revert chính entity
        updated[key] = prev[key].map((r) =>
          r.id !== id
            ? r
            : {
                ...r,
                enabled: !newStatus,
                status: !newStatus ? "Hoạt động" : "Tạm dừng",
              }
        );

        // Revert child adsets (nếu đã update)
        if (entityType === "campaign" && !newStatus && childAdsets.length > 0) {
          updated.adsets = prev.adsets.map((adset) => {
            const originalAdset = childAdsets.find((ca) => ca.id === adset.id);
            if (originalAdset) {
              return {
                ...adset,
                enabled: originalAdset.enabled,
                status: originalAdset.status,
              };
            }
            return adset;
          });
        }

        // Revert child ads (nếu đã update)
        if ((entityType === "campaign" || entityType === "adset") && !newStatus && childAds.length > 0) {
          updated.ads = prev.ads.map((ad) => {
            const originalAd = childAds.find((ca) => ca.id === ad.id);
            if (originalAd) {
              return {
                ...ad,
                enabled: originalAd.enabled,
                status: originalAd.status,
              };
            }
            return ad;
          });
        }

        return updated;
      });

      const action = newStatus ? t('toasts.toggle_on') : t('toasts.toggle_off');
      toast.error(`${t('toasts.toggle_error')} ${action} ${getEntityName(entityType)}`, {
        description: error.message,
      });
    } finally {
      // Xóa khỏi loading state
      setTogglingItems((prev) => {
        const newSet = new Set(prev);
        allTogglingIds.forEach((toggleId) => newSet.delete(toggleId));
        return newSet;
      });
    }
  };

  // 🔹 Check All
  const handleCheckAll = (event) => {
    const isChecked = event.target.checked;
    setCheckAll(isChecked);
    setHasSelectedItems(isChecked);
    setDatasets((prev) => {
      const key =
        activeTab === "campaigns"
          ? "campaigns"
          : activeTab === "adsets"
          ? "adsets"
          : "ads";
      const updatedItems = handleSelectAll(isChecked, prev[key]);
      return { ...prev, [key]: updatedItems };
    });
  };

  // 🔹 Check Single
  const handleCheckItem = (id) => {
    setDatasets((prev) => {
      const key =
        activeTab === "campaigns"
          ? "campaigns"
          : activeTab === "adsets"
          ? "adsets"
          : "ads";
      const { updatedItems, allChecked } = handleSelectItem(id, prev[key]);
      setCheckAll(allChecked);
      setHasSelectedItems(updatedItems.some((item) => item.isChecked));
      return { ...prev, [key]: updatedItems };
    });
  };

  // 🔹 Edit item
  const handleUpdate = (id) => {
    // 1️⃣ Lấy item được click
    const item = rows.find((row) => row.id === id);
    if (!item) return;

    // 2️⃣ Xác định loại (campaign / adset / ad)
    const type =
      activeTab === "campaigns"
        ? "campaign"
        : activeTab === "adsets"
        ? "adset"
        : "ad";

    // 3️⃣ Lấy campaign / adset tương ứng (để truyền vào Wizard)
    let campaign = null;
    let adset = null;

    if (type === "campaign") {
      campaign = item;
    } else if (type === "adset") {
      adset = item;
      campaign =
        datasets.campaigns.find((c) => c.id === item.campaignId) || null;
    } else if (type === "ad") {
      adset = datasets.adsets.find((a) => a.id === item.adsetId) || null;
      // Tìm campaign thông qua adset relationship
      campaign = adset 
        ? datasets.campaigns.find((c) => c.id === adset.campaignId) || null
        : null;
    }

    // 4️⃣ Lưu state để mở Wizard
    setEditingItem({
      type,
      data: { ...item, external_id: item.external_id },
    });
    setWizardMode("edit");
    setShowWizard(true);

    // 5️⃣ Cập nhật selection để Wizard hiểu context
    if (campaign) setSelectedCampaign(campaign);
    if (adset) setSelectedAdset(adset);
  };

  // 🔹 Archive (placeholder)
  const handleArchive = (id) => {
    const key =
      activeTab === "campaigns"
        ? "campaigns"
        : activeTab === "adsets"
        ? "adsets"
        : "ads";

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
    // Đóng confirmation popup
    setConfirmationPopup((prev) => ({
      ...prev,
      isOpen: false,
    }));

    const key =
      activeTab === "campaigns"
        ? "campaigns"
        : activeTab === "adsets"
        ? "adsets"
        : "ads";

    const entityName = getEntityName(key);

    // Mở progress popup
    openProgress({
      type: 'archive',
      title: t('progress.archiving', { entity: entityName }),
      total: idsToArchive.length,
    });

    try {
      // 🧩 Lấy token FB từ localStorage
      const fbToken = localStorage.getItem("fb_access_token") || null;

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // 🔹 Gọi đúng service cho từng loại và cập nhật progress
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
          console.error(`❌ Lỗi khi archive ${archiveId}:`, itemError);
        }
      }

      // 🔹 Cập nhật UI - xóa tất cả items đã được archive (chúng sẽ chuyển sang trang Archive)
      const processedIds = idsToArchive.slice(0, successCount);
      
      setDatasets((prev) => ({
        ...prev,
        [key]: prev[key].filter((item) => !processedIds.includes(item.id)),
      }));
      setCheckAll(false);
      setHasSelectedItems(false);

      // ✅ Invalidate cache sau khi archive thành công
      if (successCount > 0 && selectedAccountId) {
        setCache(prev => {
          const updatedCache = { ...prev.lastFetch };
          // Xóa cache của entity type tương ứng
          const cacheKey = `${selectedAccountId}_${key}`;
          delete updatedCache[cacheKey];
          // Nếu archive campaign, cũng invalidate adsets và ads
          if (key === "campaigns") {
            Object.keys(updatedCache).forEach(k => {
              if (k.includes("adsets") || k.includes("ads")) {
                delete updatedCache[k];
              }
            });
          } else if (key === "adsets") {
            Object.keys(updatedCache).forEach(k => {
              if (k.includes("ads")) {
                delete updatedCache[k];
              }
            });
          }
          return {
            ...prev,
            lastFetch: updatedCache
          };
        });
      }

      // Cập nhật trạng thái cuối cùng
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

      // Refresh data after archiving
      if (successCount > 0) {
        handleRefresh();
      }
    } catch (error) {
      console.error("❌ Lỗi khi archive:", error);
      
      updateProgress({
        status: 'error',
        message: error?.response?.data?.message || t('toasts.archive_failed'),
      });
      
      toast.error(
        error?.response?.data?.message || t('toasts.archive_failed')
      );
    }
  };

  // 🔹 Delete (main)
  const handleDelete = (id) => {
    const key =
      activeTab === "campaigns"
        ? "campaigns"
        : activeTab === "adsets"
        ? "adsets"
        : "ads";

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
    // Đóng confirmation popup
    setConfirmationPopup((prev) => ({
      ...prev,
      isOpen: false,
    }));

    const key =
      activeTab === "campaigns"
        ? "campaigns"
        : activeTab === "adsets"
        ? "adsets"
        : "ads";

    const entityName = getEntityName(key);

    // Mở progress popup
    openProgress({
      type: 'delete',
      title: t('progress.deleting', { entity: entityName }),
      total: idsToDelete.length,
    });

    try {
      // 🧩 Lấy token FB từ localStorage
      const fbToken = localStorage.getItem("fb_access_token") || null;

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // 🔹 Gọi đúng service cho từng loại và cập nhật progress
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
          console.error(`❌ Lỗi khi xóa ${delId}:`, itemError);
        }
      }

      // 🔹 Cập nhật UI - xóa tất cả items đã được xử lý (bao gồm cả success)
      const processedIds = idsToDelete.slice(0, successCount);
      
      setDatasets((prev) => ({
        ...prev,
        [key]: prev[key].filter((item) => !processedIds.includes(item.id)),
      }));
      setCheckAll(false);
      setHasSelectedItems(false);

      // ✅ Invalidate cache sau khi delete thành công
      if (successCount > 0 && selectedAccountId) {
        setCache(prev => {
          const updatedCache = { ...prev.lastFetch };
          // Xóa cache của entity type tương ứng
          const cacheKey = `${selectedAccountId}_${key}`;
          delete updatedCache[cacheKey];
          // Nếu delete campaign, cũng invalidate adsets và ads
          if (key === "campaigns") {
            Object.keys(updatedCache).forEach(k => {
              if (k.includes("adsets") || k.includes("ads")) {
                delete updatedCache[k];
              }
            });
          } else if (key === "adsets") {
            Object.keys(updatedCache).forEach(k => {
              if (k.includes("ads")) {
                delete updatedCache[k];
              }
            });
          }
          return {
            ...prev,
            lastFetch: updatedCache
          };
        });
      }

      // Cập nhật trạng thái cuối cùng
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

      // Refresh data after deletion
      if (successCount > 0) {
        handleRefresh();
      }
    } catch (error) {
      console.error("❌ Lỗi khi xóa:", error);
      
      updateProgress({
        status: 'error',
        message: error?.response?.data?.message || t('toasts.delete_failed'),
      });
      
      toast.error(
        error?.response?.data?.message || t('toasts.delete_failed')
      );
    }
  };

  // 🔹 Navigation
  const handleCampaignClick = (campaign) => {
    setSelectedCampaign(campaign);
    setSelectedAdset(null);
    setActiveTab("adsets");
    // ✅ useEffect sẽ tự động fetch adsets khi activeTab và selectedCampaign thay đổi
  };

  const handleAdsetClick = (adset) => {
    setSelectedAdset(adset);
    setActiveTab("ads");
    // ✅ useEffect sẽ tự động fetch ads khi activeTab và selectedAdset thay đổi
  };

  // 🔹 Reset selections
  const resetSelection = () => {
    setSelectedCampaign(null);
    setSelectedAdset(null);
    setCheckAll(false);
    setHasSelectedItems(false);
  };

  // 🔹 Sync data từ Facebook (chỉ gọi khi cần thiết)
  // ✅ Tối ưu: Sử dụng batch sync endpoint và lazy sync (chỉ sync entity cần thiết)
  // ✅ Sửa: Dùng ref để tránh dependency loop và re-render không cần thiết
  const syncData = useCallback(async (accountId, forceSync = false, syncTypes = null) => {
    if (!accountId) return;
    
    const now = Date.now();
    const CACHE_TTL = 120000; // 120 giây (tăng từ 30s để giảm sync calls)
    
    // ✅ Sử dụng ref để lấy activeTab hiện tại, tránh dependency
    const currentActiveTab = activeTabRef.current;
    const currentCache = cacheRef.current;
    
    // ✅ Nếu không chỉ định syncTypes, tự động xác định dựa trên activeTab
    if (!syncTypes) {
      if (currentActiveTab === "campaigns") {
        syncTypes = ['campaigns'];
      } else if (currentActiveTab === "adsets") {
        syncTypes = ['campaigns', 'adsets']; // Cần campaigns để map relationship
      } else if (currentActiveTab === "ads") {
        syncTypes = ['campaigns', 'adsets', 'ads']; // Cần cả 3 để map relationships
      } else {
        syncTypes = ['campaigns', 'adsets', 'ads'];
      }
    }
    
    // ✅ Kiểm tra cache cho từng entity type (dùng ref)
    const needsSync = syncTypes.filter(type => {
      if (forceSync) return true;
      const cacheKey = `${accountId}_${type}`;
      const lastSync = currentCache.lastFetch?.[cacheKey];
      return !lastSync || (now - lastSync) > CACHE_TTL;
    });
    
    if (needsSync.length === 0) {
      console.log("⏭️ Skip sync - all entities cached");
      return;
    }
    
    try {
      // ✅ Chỉ sync những entity cần thiết
      if (needsSync.length === 3) {
        // Sync tất cả → dùng batch endpoint (1 request thay vì 3)
        await axiosInstance.get(`/api/campaigns/sync-all?account_id=${accountId}`);
        console.log("✅ Batch sync completed");
      } else {
        // Sync từng phần riêng (khi chỉ cần 1-2 entities)
        const syncPromises = needsSync.map(type => {
          const endpointMap = {
            campaigns: 'campaigns',
            adsets: 'adsets',
            ads: 'ads'
          };
          return axiosInstance.get(`/api/${endpointMap[type]}/sync?account_id=${accountId}`);
        });
        await Promise.all(syncPromises);
        console.log(`✅ Synced ${needsSync.length} entities:`, needsSync);
      }
      
      // Cập nhật cache (dùng functional update để tránh stale closure)
      setCache(prev => {
        const updatedCache = { ...prev.lastFetch };
        needsSync.forEach(type => {
          updatedCache[`${accountId}_${type}`] = now;
        });
        return {
          ...prev,
          lastSync: now,
          lastFetch: updatedCache
        };
      });
    } catch (error) {
      console.error("Sync error:", error);
    }
  }, []); // ✅ Bỏ cache và activeTab khỏi dependencies, dùng ref thay thế

  // 🔹 Fetch campaigns (fetch tất cả để sort và phân trang ở FE)
  const fetchCampaignsForAccount = useCallback(async (accountId) => {
    if (!accountId) return;
    try {
      const response = await axiosInstance.get(`/api/campaigns`, {
        params: {
          account_id: accountId,
          fetch_all: true // Fetch tất cả để FE sort và phân trang
        }
      });
      if (response.data) {
        const { items } = response.data; // Không cần total, pages từ BE nữa (FE sẽ tính)

        // ✅ Backend trả về tất cả items (bao gồm cả DELETED), Frontend sẽ filter
        // Log để debug: thống kê items theo status
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned campaigns by status:`, statusCount);
        }
        
        const mapped = items.map((campaign) => ({
          ...campaign,
          id: campaign._id || campaign.id || campaign.external_id,
          external_id: campaign.external_id,
          isChecked: false,
          enabled: campaign.status === "ACTIVE",
          budget: campaign.daily_budget || campaign.lifetime_budget || 0,
          start_time: campaign.start_time,
          end_time: campaign.stop_time,
          objective: campaign.objective,
          buying_type: campaign.buying_type,
          created_by: campaign.created_by,
          impressions: 0,
          reach: 0,
          results: 0,
          quality: '-',
        }));

        setDatasets(prev => ({
          ...prev,
          campaigns: mapped,
        }));
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    }
  }, []); // BỎ pagination.page, pagination.limit khỏi dependencies

  // 🔹 Fetch AdSets for campaign (fetch tất cả để sort và phân trang ở FE)
  // ✅ Tối ưu: Kiểm tra cache trước khi fetch, merge thông minh
  const fetchAdsetsForCampaign = useCallback(async (campaignId, accountId) => {
    if (!campaignId || !accountId) return;
    
    // ✅ Kiểm tra cache: Sử dụng ref để tránh dependency loop
    const cacheKey = `adsets_${campaignId}_${accountId}`;
    const currentCache = cacheRef.current;
    const currentDatasets = datasetsRef.current;
    
    const lastFetch = currentCache.lastFetch?.[cacheKey];
    if (lastFetch && (Date.now() - lastFetch) < 120000) {
      const cachedAdsets = currentDatasets.adsets.filter(
        a => String(a.campaignId) === String(campaignId) && 
             a.status !== "DELETED" && 
             a.status !== "ARCHIVED"
      );
      if (cachedAdsets.length > 0) {
        console.log(`✅ Using ${cachedAdsets.length} cached adsets for campaign ${campaignId}`);
        return;
      }
    }
    
    try {
      const response = await axiosInstance.get(`/api/adsets`, {
        params: {
          campaign_id: campaignId,
          fetch_all: true // Fetch tất cả để FE sort và phân trang
        }
      });
      if (response.data) {
        const { items } = response.data;

        // ✅ Backend trả về tất cả items (bao gồm cả DELETED), Frontend sẽ filter
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned adsets by status:`, statusCount);
        }
        
        const mapped = items.map((adset) => ({
          ...adset,
          id: adset._id || adset.id || adset.external_id,
          external_id: adset.external_id,
          campaignId,
          isChecked: false,
          enabled: adset.status === "ACTIVE",
          budget: adset.daily_budget || adset.lifetime_budget || 0,
          start_time: adset.start_time,
          end_time: adset.end_time,
          targeting: adset.targeting || {},
          optimization_goal: adset.optimization_goal,
          bid_strategy: adset.bid_strategy,
          bid_amount: adset.bid_amount,
          created_by: adset.created_by,
          impressions: 0,
          reach: 0,
          results: 0,
          quality: '-',
        }));

        setDatasets((prev) => {
          const otherAdsets = prev.adsets.filter(
            a => String(a.campaignId) !== String(campaignId)
          );
          return {
            ...prev,
            adsets: [...otherAdsets, ...mapped]
          };
        });

        // ✅ Update cache
        setCache(prev => ({
          ...prev,
          lastFetch: {
            ...prev.lastFetch,
            [`adsets_${campaignId}_${accountId}`]: Date.now()
          }
        }));
      }
    } catch (error) {
      console.error("Error fetching adsets:", error);
    }
  }, []); // ✅ Loại bỏ datasets.adsets và cache khỏi dependencies để tránh infinite loop

  // 🔹 Fetch Ads for AdSet (fetch tất cả để sort và phân trang ở FE)
  // ✅ Tối ưu: Kiểm tra cache trước khi fetch, merge thông minh
  // ✅ Sửa: Thêm accountId parameter để validate và sync
  const fetchAdsForAdset = useCallback(async (adsetId, accountId = null) => {
    if (!adsetId) return;
    
    // ✅ Kiểm tra cache: Sử dụng ref để tránh dependency loop
    const cacheKey = `ads_${adsetId}`;
    const currentCache = cacheRef.current;
    const currentDatasets = datasetsRef.current;
    
    const lastFetch = currentCache.lastFetch?.[cacheKey];
    if (lastFetch && (Date.now() - lastFetch) < 120000) {
      const cachedAds = currentDatasets.ads.filter(
        a => String(a.adsetId) === String(adsetId) && 
             a.status !== "DELETED" && 
             a.status !== "ARCHIVED"
      );
      if (cachedAds.length > 0) {
        console.log(`✅ Using ${cachedAds.length} cached ads for adset ${adsetId}`);
        return;
      }
    }
    
    try {
      const response = await axiosInstance.get(`/api/ads`, {
        params: {
          adset_id: adsetId,
          ...(accountId && { account_id: accountId }), // Thêm accountId nếu có
          fetch_all: true // Fetch tất cả để FE sort và phân trang
        }
      });
      if (response.data) {
        const { items } = response.data; // Không cần total, pages từ BE nữa

        // ✅ Backend trả về tất cả items (bao gồm cả DELETED), Frontend sẽ filter
        // Log để debug: thống kê items theo status
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned ads by status:`, statusCount);
        }
        
        const mapped = items.map((ad) => ({
          ...ad,
          id: ad._id || ad.id || ad.external_id,
          external_id: ad.external_id,
          adsetId,
          isChecked: false,
          enabled: ad.status === "ACTIVE",
          budget: 0,
          created_by: ad.created_by,
          impressions: 0,
          reach: 0,
          results: 0,
          quality: '-',
          updated_at: ad.updated_at || ad.updatedAt,
        }));

        setDatasets((prev) => ({ ...prev, ads: mapped }));
      }
    } catch (error) {
      console.error("Error fetching ads:", error);
    }
  }, []); // ✅ Loại bỏ datasets.ads và cache khỏi dependencies để tránh infinite loop

  // 🔹 Fetch all Adsets & Ads by account (fetch tất cả để sort và phân trang ở FE)
  // ✅ Tối ưu: Thêm cache check và batch insights để giảm API calls
  const fetchAllAdsetsForAccount = useCallback(async (accountId) => {
    if (!accountId) return;
    
    // ✅ Kiểm tra cache: Sử dụng ref để tránh dependency loop
    const cacheKey = `adsets_all_${accountId}`;
    const currentCache = cacheRef.current;
    const currentDatasets = datasetsRef.current;
    
    const lastFetch = currentCache.lastFetch?.[cacheKey];
    if (lastFetch && (Date.now() - lastFetch) < 120000) {
      const cachedAdsets = currentDatasets.adsets.filter(
        a => a.status !== "DELETED" && a.status !== "ARCHIVED"
      );
      if (cachedAdsets.length > 0) {
        console.log(`✅ Using ${cachedAdsets.length} cached adsets for account ${accountId}`);
        return;
      }
    }
    
    try {
      const response = await axiosInstance.get(`/api/adsets`, {
        params: {
          account_id: accountId,
          fetch_all: true // Fetch tất cả để FE sort và phân trang
        }
      });
      if (response.data) {
        const { items } = response.data; // Không cần total, pages từ BE nữa

        // ✅ Backend trả về tất cả items (bao gồm cả DELETED), Frontend sẽ filter
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned adsets by status:`, statusCount);
        }
        
        const mapped = items.map((adset) => ({
          ...adset,
          id: adset._id || adset.id || adset.external_id,
          external_id: adset.external_id,
          campaignId: adset.campaign_id,
          isChecked: false,
          enabled: adset.status === "ACTIVE",
          budget: adset.daily_budget || adset.lifetime_budget || 0,
          start_time: adset.start_time,
          end_time: adset.end_time,
          targeting: adset.targeting || {},
          optimization_goal: adset.optimization_goal,
          bid_strategy: adset.bid_strategy,
          bid_amount: adset.bid_amount,
          created_by: adset.created_by,
          impressions: 0,
          reach: 0,
          results: 0,
          quality: '-',
        }));

        setDatasets((prev) => ({
          ...prev,
          adsets: mapped,
        }));

        // ✅ Update cache sau khi fetch thành công
        setCache(prev => ({
          ...prev,
          lastFetch: {
            ...prev.lastFetch,
            [cacheKey]: Date.now()
          }
        }));
      }
    } catch (error) {
      console.error("Error fetching adsets:", error);
    }
  }, []); // ✅ Loại bỏ datasets.adsets và cache khỏi dependencies để tránh infinite loop

  // 🔹 Fetch all Ads by account (fetch tất cả để sort và phân trang ở FE)
  // ✅ Tối ưu: Thêm cache check và batch insights để giảm API calls
  const fetchAllAdsForAccount = useCallback(async (accountId) => {
    if (!accountId) return;
    
    // ✅ Kiểm tra cache: Sử dụng ref để tránh dependency loop
    const cacheKey = `ads_all_${accountId}`;
    const currentCache = cacheRef.current;
    const currentDatasets = datasetsRef.current;
    
    const lastFetch = currentCache.lastFetch?.[cacheKey];
    if (lastFetch && (Date.now() - lastFetch) < 120000) {
      const cachedAds = currentDatasets.ads.filter(
        a => a.status !== "DELETED" && a.status !== "ARCHIVED"
      );
      if (cachedAds.length > 0) {
        console.log(`✅ Using ${cachedAds.length} cached ads for account ${accountId}`);
        return;
      }
    }
    
    try {
      const response = await axiosInstance.get(`/api/ads`, {
        params: {
          account_id: accountId,
          fetch_all: true // Fetch tất cả để FE sort và phân trang
        }
      });
      if (response.data) {
        const { items } = response.data; // Không cần total, pages từ BE nữa

        // ✅ Backend trả về tất cả items (bao gồm cả DELETED), Frontend sẽ filter
        // Log để debug: thống kê items theo status
        if (import.meta.env.DEV) {
          const statusCount = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`📊 Backend returned ads by status:`, statusCount);
        }
        
        const mapped = items.map((ad) => ({
          ...ad,
          id: ad._id || ad.id || ad.external_id,
          external_id: ad.external_id,
          adsetId: ad.adset_id || ad.set_id,
          isChecked: false,
          enabled: ad.status === "ACTIVE",
          budget: 0,
          created_by: ad.created_by,
          impressions: 0,
          reach: 0,
          results: 0,
          quality: '-',
          updated_at: ad.updated_at || ad.updatedAt,
        }));

        setDatasets((prev) => ({ ...prev, ads: mapped }));
      }
    } catch (error) {
      console.error("Error fetching ads:", error);
    }
  }, []); // ✅ Loại bỏ datasets.ads và cache khỏi dependencies để tránh infinite loop

  // 🔹 Fetch Ad Accounts (chỉ lấy ACTIVE accounts)
  useEffect(() => {
    const fetchAdAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const response = await axiosInstance.get("/api/ads-accounts", {
          params: { status: 'ACTIVE' } // Chỉ lấy accounts có status ACTIVE
        });
        if (response.data?.items) {
          setAdAccounts(response.data.items);
          setInitialized(true);
        }
      } catch (error) {
        console.error("Error fetching ad accounts:", error);
      } finally {
        setLoadingAccounts(false);
      }
    };
    if (!initialized) fetchAdAccounts();
  }, [initialized]);

  // 🔹 Sync data khi chọn account mới hoặc refresh
  useEffect(() => {
    if (selectedAccountId && initialized) {
      syncData(selectedAccountId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, initialized]);

  // 🔹 ✅ TỐI ƯU: CHỈ reset pagination khi chuyển tab, KHÔNG fetch lại data
  useEffect(() => {
    if (selectedAccountId && initialized) {
      // ✅ Hủy request cũ nếu có
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Tạo AbortController mới cho request này
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // ✅ Cập nhật prevActiveTabRef trước khi fetch để tránh timing issue
      const isTabChanged = prevActiveTabRef.current !== activeTab;
      if (isTabChanged) {
        setPagination(prev => ({ ...prev, page: 1 }));
        prevActiveTabRef.current = activeTab;
      }

      // ❌ XÓA: KHÔNG fetch data ở đây nữa
      // Data đã được load 1 lần duy nhất trong handleAccountChange
      // Chỉ cần filter và hiển thị từ datasets đã có
      
      // ✅ CHỈ fetch data drill-down khi user click vào campaign/adset cụ thể
      // (để đảm bảo có đủ child data cho context đó)
      if (activeTab === "adsets" && selectedCampaign) {
        const hasAdsetsForCampaign = datasets.adsets.some(
          a => String(a.campaignId) === String(selectedCampaign.id)
        );
        if (!hasAdsetsForCampaign) {
          fetchAdsetsForCampaign(selectedCampaign.id, selectedAccountId);
        }
      } else if (activeTab === "ads" && selectedAdset) {
        const hasAdsForAdset = datasets.ads.some(
          a => String(a.adsetId) === String(selectedAdset.id)
        );
        if (!hasAdsForAdset) {
          fetchAdsForAdset(selectedAdset.id);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedAccountId,
    initialized,
    activeTab,
    selectedCampaign?.id,
    selectedAdset?.id
  ]);

  // useEffect riêng để reset page khi limit thay đổi
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [pagination.limit]);

  // 🔹 Handle account change
  // ✅ SIÊU TỐI ƯU: Load TẤT CẢ data 1 lần duy nhất khi chọn account
  const handleAccountChange = async (e) => {
    const accountId = e.target.value;
    setSelectedAccountId(accountId);
    localStorage.setItem("selectedAdAccount", accountId);
    resetSelection();
    setActiveTab("campaigns");
    
    if (!accountId) {
      setDatasets({ campaigns: [], adsets: [], ads: [] });
      return;
    }

    // ✅ Kiểm tra cache: Nếu đã load account này rồi, KHÔNG FETCH LẠI
    if (cache.loadedAccounts.has(accountId)) {
      console.log(`✅ Using cached data for account ${accountId}`);
      return;
    }

    try {
      console.log(`🔄 Loading ALL data for account ${accountId} (one-time)...`);
      
      // 🔹 FETCH TẤT CẢ trong 1 lần (parallel)
      await Promise.all([
        fetchCampaignsForAccount(accountId),
        fetchAllAdsetsForAccount(accountId),
        fetchAllAdsForAccount(accountId),
      ]);

      // 🔹 Load insights từ DB (group by ad để giảm data transfer)
      await loadInsightsFromDB(accountId);

      // ✅ Đánh dấu account này đã load xong
      setCache(prev => ({
        ...prev,
        loadedAccounts: new Set([...prev.loadedAccounts, accountId])
      }));
      
      console.log(`✅ ALL data loaded for account ${accountId}`);
    } catch (error) {
      console.error("❌ Error loading account data:", error);
      toast.error("Không thể tải dữ liệu account");
    }
  };

  // 🔹 ✅ TỐI ƯU: Load insights từ DATABASE với groupBy=ad (giảm data transfer)
  const loadInsightsFromDB = useCallback(async (accountId) => {
    if (!accountId) return;
    
    try {
      setLoadingInsights(true);
      
      const selectedAccountData = adAccounts.find(acc => acc.external_id === accountId);
      
      // ✅ THÊM groupBy=ad để backend aggregate trước (giảm data transfer)
      const filterParams = {
        account_id: selectedAccountData?.external_id || accountId,
        groupBy: 'ad', // ✅ Group theo ad để giảm số lượng records
        dateFrom: null,
        dateTo: null
      };

      const response = await getAdPerformance(filterParams);
      
      if (!response?.data || response.data.length === 0) {
        console.log("No performance data found in database");
        return;
      }

      // ✅ Backend đã group theo ad rồi, chỉ cần map trực tiếp
      const grouped = response.grouped;
      console.log(`� Loaded ${response.data.length} ${grouped ? 'grouped' : 'raw'} performance records from DB`);

      const insightsMap = {
        byCampaign: {},
        byAdset: {},
        byAd: {}
      };

      // ✅ Nếu đã group, data đã được tổng hợp sẵn
      response.data.forEach(insight => {
        // Map vào byAd (đã được group)
        if (insight.ads_id) {
          insightsMap.byAd[insight.ads_id] = {
            impressions: insight.impressions || 0,
            reach: insight.reach || 0,
            results: insight.results || 0,
            spend: insight.spend || 0,
            clicks: insight.clicks || 0,
            cpc: insight.cpc,
            cpm: insight.cpm,
            ctr: insight.ctr,
          };
        }

        // Aggregate lên campaign và adset (roll-up)
        if (insight.campaign_id) {
          if (!insightsMap.byCampaign[insight.campaign_id]) {
            insightsMap.byCampaign[insight.campaign_id] = {
              impressions: 0,
              reach: 0,
              results: 0,
              spend: 0
            };
          }
          insightsMap.byCampaign[insight.campaign_id].impressions += insight.impressions || 0;
          insightsMap.byCampaign[insight.campaign_id].reach += insight.reach || 0;
          insightsMap.byCampaign[insight.campaign_id].results += insight.results || 0;
          insightsMap.byCampaign[insight.campaign_id].spend += insight.spend || 0;
        }

        if (insight.set_id) {
          if (!insightsMap.byAdset[insight.set_id]) {
            insightsMap.byAdset[insight.set_id] = {
              impressions: 0,
              reach: 0,
              results: 0,
              spend: 0
            };
          }
          insightsMap.byAdset[insight.set_id].impressions += insight.impressions || 0;
          insightsMap.byAdset[insight.set_id].reach += insight.reach || 0;
          insightsMap.byAdset[insight.set_id].results += insight.results || 0;
          insightsMap.byAdset[insight.set_id].spend += insight.spend || 0;
        }
      });

      setDatasets(prev => ({
        campaigns: prev.campaigns.map(campaign => {
          const insights = insightsMap.byCampaign[campaign._id || campaign.id];
          return insights ? {
            ...campaign,
            impressions: insights.impressions,
            reach: insights.reach,
            results: insights.results,
            quality: campaign.quality || '-'
          } : campaign;
        }),
        adsets: prev.adsets.map(adset => {
          const insights = insightsMap.byAdset[adset._id || adset.id];
          return insights ? {
            ...adset,
            impressions: insights.impressions,
            reach: insights.reach,
            results: insights.results,
            quality: adset.quality || '-'
          } : adset;
        }),
        ads: prev.ads.map(ad => {
          const insights = insightsMap.byAd[ad._id || ad.id];
          return insights ? {
            ...ad,
            impressions: insights.impressions,
            reach: insights.reach,
            results: insights.results,
            quality: ad.quality || '-'
          } : ad;
        })
      }));

      console.log("✅ Insights loaded from database successfully");
    } catch (error) {
      console.error("Error loading insights from DB:", error);
      toast.error("Error loading insights data from database");
    } finally {
      setLoadingInsights(false);
    }
  }, [adAccounts, toast]);

  // 🔹 ✅ TỐI ƯU: Handle refresh - Sync từ Facebook và reload TẤT CẢ
  const handleRefresh = useCallback(async () => {
    if (!selectedAccountId) {
      toast.warning(t('toasts.select_account_warning'), {
        description: t('toasts.select_account_description'),
      });
      return;
    }

    setRefreshing(true);

    try {
      // 🔹 BƯỚC 1: Force sync insights từ Facebook vào database
      toast.info(t('toasts.syncing_facebook'));
      const selectedAccountData = adAccounts.find(acc => acc.external_id === selectedAccountId || acc.id === selectedAccountId);
      await refreshAdPerformance(selectedAccountData?.external_id || selectedAccountId);
      
      // 🔹 BƯỚC 2: Force sync campaigns/adsets/ads structure từ Facebook
      await syncData(selectedAccountId, true, ['campaigns', 'adsets', 'ads']);
      
      // 🔹 BƯỚC 3: Re-fetch TẤT CẢ data (parallel)
      await Promise.all([
        fetchCampaignsForAccount(selectedAccountId),
        fetchAllAdsetsForAccount(selectedAccountId),
        fetchAllAdsForAccount(selectedAccountId),
      ]);

      // 🔹 BƯỚC 4: Load insights từ database (grouped)
      await loadInsightsFromDB(selectedAccountId);

      // ✅ Reset cache để lần sau không skip
      setCache(prev => ({
        ...prev,
        loadedAccounts: new Set([...prev.loadedAccounts].filter(id => id !== selectedAccountId)),
        lastFetch: {}
      }));

      console.log("✅ Data refreshed successfully from Facebook");
      toast.success(t('toasts.refresh_success'));
    } catch (error) {
      console.error("❌ Error refreshing data:", error);
      
      if (error.response?.status === 429 || error.response?.data?.rateLimitReached) {
        toast.error("Đã đạt giới hạn API của Facebook. Vui lòng thử lại sau 5-10 phút.", {
          duration: 6000,
        });
      } else {
        toast.error(t('toasts.refresh_error'));
      }
    } finally {
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  // ✅ Chỉ fetch từ DB, không sync Facebook (dùng cho draft)
  const handleFetchOnly = useCallback(async () => {
    if (!selectedAccountId) {
      return;
    }

    try {
      // Chỉ fetch data cho tab hiện tại (KHÔNG sync Facebook)
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

      console.log("✅ Data fetched successfully");
    } catch (error) {
      console.error("❌ Error fetching data:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, activeTab, selectedCampaign?.id, selectedAdset?.id]);

  // 🔹 ❌ XÓA: Không cần load insights riêng nữa
  // Insights đã được load trong handleAccountChange
  // useEffect này gây ra duplicate API calls

  return (
    <div className="ads-management-layout">
      <div className="ads-management-content">
        <div className="ads-management-center">
          <div className="ads-card">
            <div className="ads-toolbar">
              <div className="account-select">
                <select
                  value={selectedAccountId}
                  onChange={handleAccountChange}
                  disabled={loadingAccounts}
                >
                  <option value="">{t('management.select_account')}</option>
                  {loadingAccounts ? (
                    <option disabled>{t('management.loading_accounts')}</option>
                  ) : adAccounts.length === 0 ? (
                    <option disabled>{t('management.no_accounts')}</option>
                  ) : (
                    adAccounts.map((account) => (
                      <option key={account._id} value={account.external_id}>
                        {account.name || t('management.account')} ({account.external_id})
                      </option>
                    ))
                  )}
                </select>

                <button
                  className={`btn-create-ads ${!selectedAccountId ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!selectedAccountId) return;
                    setWizardMode("create");
                    setEditingItem(null);
                    resetSelection();
                    setShowWizard(true);
                  }}
                  disabled={!selectedAccountId}
                >
                  <Plus size={13} /> {t('management.create_campaign')}
                </button>
                <button
                  className={`btn-create-rule ${!selectedAccountId ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!selectedAccountId) return;
                    navigate(ROUTES.AUTOMATION_RULE);
                  }}
                  disabled={!selectedAccountId}
                >
                  <Settings size={13} /> {t('management.create_rule')}
                </button>
              </div>

              <div>
                <div className="search-input-wrapper">
                  <Search className="search-icon" size={16} />
                  <input
                    type="text"
                    className="search-input-ads"
                    placeholder={t('management.search')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Lọc theo thời gian"
                />
              </div>
            </div>

            {/* Breadcrumb */}
            {(selectedCampaign || selectedAdset) && (
              <div className="breadcrumb-nav">
                <button
                  className="breadcrumb-item"
                  onClick={() => {
                    resetSelection();
                    setActiveTab("campaigns");
                  }}
                >
                  {t('management.all_campaigns')}
                </button>
                {selectedCampaign && (
                  <>
                    <span className="breadcrumb-separator">›</span>
                    <button
                      className="breadcrumb-item"
                      onClick={() => {
                        setSelectedAdset(null);
                        setActiveTab("adsets");
                      }}
                    >
                      {selectedCampaign.name}
                    </button>
                  </>
                )}
                {selectedAdset && (
                  <>
                    <span className="breadcrumb-separator">›</span>
                    <button
                      className="breadcrumb-item active"
                      onClick={() => setActiveTab("ads")}
                    >
                      {selectedAdset.name}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="ads-tabs">
              <button
                className={`tab ${activeTab === "campaigns" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("campaigns");
                  resetSelection();
                }}
              >
                <span className="tab-icon">▦</span> {t('management.campaigns_tab')}
              </button>
              <button
                className={`tab ${activeTab === "adsets" ? "active" : ""}`}
                onClick={() => {
                  resetSelection();
                  setActiveTab("adsets");
                  // ✅ useEffect sẽ tự động fetch adsets khi activeTab thay đổi
                }}
              >
                <span className="tab-icon">▣</span> {t('management.adsets_tab')}
              </button>
              <button
                className={`tab ${activeTab === "ads" ? "active" : ""}`}
                onClick={() => {
                  resetSelection();
                  setActiveTab("ads");
                  // ✅ useEffect sẽ tự động fetch ads khi activeTab thay đổi
                }}
              >
                <span className="tab-icon">▥</span> {t('management.ads_tab')}
              </button>

              {hasSelectedItems && (
                <div className="icon-beside-tab">
                  <button
                    className="ads-action-btn ads-archive-btn"
                    onClick={() => handleArchive()}
                    title="Lưu trữ"
                  >
                    <Archive size={15} />
                  </button>
                  <button
                    className="ads-action-btn ads-delete-btn"
                    onClick={() => handleDelete()}
                    title="Xóa"
                  >
                    <Trash size={15} />
                  </button>
                </div>
              )}
              <button
                className="btn-refresh-ads"
                onClick={handleRefresh}
                disabled={refreshing || !selectedAccountId}
                title={t('management.refresh')}
              >
                <RefreshCw size={16} className={refreshing ? "spinning" : ""} />
                {refreshing ? t('management.refreshing') : t('management.refresh')}
              </button>
            </div>

            {/* Table */}
            <div className="ads-table-wrapper">
              <table className="ads-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={checkAll}
                        onChange={handleCheckAll}
                      />
                    </th>
                    <th>{t('management.toggle_on_off')}</th>
                    <th>{t('management.name')}</th>
                    <th>{t('management.status')}</th>
                    <th>{t('management.budget')}</th>
                    {activeTab === "adsets" && <th>{t('management.runtime')}</th>}
                    {activeTab === "adsets" && <th>{t('management.targeting')}</th>}
                    {activeTab === "campaigns" && <th>{t('management.objective')}</th>}
                    <th>{t('management.impressions')}</th>
                    <th>{t('management.reach')}</th>
                    <th>{t('management.results')}</th>
                    <th>{t('management.quality')}</th>
                    <th>{t('management.creator')}</th>
                    <th>{t('management.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === "ads" || activeTab === "adsets" || activeTab === "campaigns") && rows.length === 0 && (
                    <tr>
                      <td colSpan={activeTab === "adsets" ? 13 : activeTab === "campaigns" ? 12 : 11} style={{ textAlign: 'center', padding: '16px', color: '#6b7280' }}>
                        {t('management.no_data')}
                      </td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.isChecked}
                          onChange={() => handleCheckItem(row.id)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`switch ${row.enabled ? "on" : "off"} ${
                            togglingItems.has(row.id) ? "loading" : ""
                          }`}
                          aria-pressed={row.enabled}
                          onClick={() => toggleRow(row.id)}
                          disabled={togglingItems.has(row.id)}
                        />
                      </td>
                      <td>
                        <span
                          className={`name-text ${
                            activeTab === "ads" 
                              ? "ad-name" 
                              : "clickable"
                          }`}
                          onClick={() => {
                            if (activeTab === "campaigns")
                              handleCampaignClick(row);
                            else if (activeTab === "adsets")
                              handleAdsetClick(row);
                            // Ad không có onClick vì là bước cuối
                          }}
                        >
                          {row.name}
                        </span>
                      </td>
                      <td className={getStatusClass(row.status)}>
                        {translateStatus(row.status)}
                      </td>
                      <td className="text-center">{row.budget || "0"}</td>
                      {activeTab === "adsets" && (
                        <td className="text-center">
                          {row.start_time && row.end_time ? (
                            <div style={{ fontSize: '12px' }}>
                              <div>{new Date(row.start_time).toLocaleDateString('vi-VN')}</div>
                              <div>{t('management.to')}</div>
                              <div>{new Date(row.end_time).toLocaleDateString('vi-VN')}</div>
                            </div>
                          ) : row.start_time ? (
                            <div style={{ fontSize: '12px' }}>
                              <div>{t('management.from')}: {new Date(row.start_time).toLocaleDateString('vi-VN')}</div>
                              <div>{t('management.no_limit')}</div>
                            </div>
                          ) : (
                            t('labels.not_set')
                          )}
                        </td>
                      )}
                      {activeTab === "adsets" && (
                        <td className="text-center">
                          <div style={{ fontSize: '12px', textAlign: 'left' }}>
                            {row.targeting && Object.keys(row.targeting).length > 0 ? (
                              formatTargetingVN(row.targeting).map((line, idx) => (
                                <div key={idx}>{line}</div>
                              ))
                            ) : (
                              t('labels.not_set')
                            )}
                            {row.optimization_goal && (
                              <div>{t('management.goal_label')}: {translateOptimizationGoal(row.optimization_goal)}</div>
                            )}
                          </div>
                        </td>
                      )}
                      {activeTab === "campaigns" && (
                        <td className="text-center">
                          <div style={{ fontSize: '12px' }}>
                            {row.objective ? translateObjective(row.objective) : t('labels.not_set')}
                          </div>
                        </td>
                      )}
                      <td className="text-center">{row.impressions || "0"}</td>
                      <td className="text-center">{row.reach || "0"}</td>
                      <td className="text-center">{row.results || "0"}</td>
                      <td className="text-center">{row.quality || "0"}</td>
                      <td className="text-center">
                        {row.created_by?.full_name || row.created_by?.email || t('labels.not_set')}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="ads-action-btn ads-update-btn"
                            onClick={() => handleUpdate(row.id)}
                            title={t('management.update')}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="ads-action-btn ads-archive-btn"
                            onClick={() => handleArchive(row.id)}
                            title={t('management.archive')}
                          >
                            <Archive size={14} />
                          </button>
                          <button
                            className="ads-action-btn ads-delete-btn"
                            onClick={() => handleDelete(row.id)}
                            title={t('management.delete')}
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* Pagination */}
            {rows.length > 0 && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                itemsPerPage={pagination.limit}
                totalItems={pagination.total}
                startIndex={(pagination.page - 1) * pagination.limit}
                endIndex={Math.min(pagination.page * pagination.limit, pagination.total)}
                onPageChange={(page) => {
                  setPagination(prev => ({ ...prev, page }));
                }}
                onItemsPerPageChange={(limit) => {
                  setPagination(prev => ({ ...prev, page: 1, limit }));
                }}
                disabled={refreshing}
              />
            )}
          </div>
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
            // Refresh data after successful create/update (sync Facebook)
            handleRefresh();
          }}
          onError={() => {
            // ✅ Refresh data sau khi publish thất bại để hiển thị items FAILED
            handleFetchOnly();
          }}
          onDraftSaved={() => {
            // ✅ CHỈ FETCH LẠI TỪ DB (KHÔNG SYNC FACEBOOK)
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

      {/* Progress Popup */}
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