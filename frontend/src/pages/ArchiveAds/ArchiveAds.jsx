import { useState, useEffect, useCallback, useRef } from "react";
import { Eye, Trash, RotateCcw, RefreshCw } from "lucide-react";
import Pagination from "../../components/common/Pagination/Pagination";
import DateRangePicker from "../../components/common/DateRangePicker/DateRangePicker";
import "./ArchiveAds.css";
import CreateAdsWizard from "../../components/feature/CreateAdsWizard/CreateAdsWizard";
import ConfirmationPopup from "../../components/common/ConfirmationPopup/ConfirmationPopup";
import ProgressPopup from "../../components/common/ProgressPopup/Progress";
import { handleSelectAll, handleSelectItem } from "../../utils/business-logic/selectionUtils";
import {
  deleteCampaign,
  deleteAdSet,
  deleteAd,
} from "../../services/ads/adService";
import axiosInstance from "../../utils/api/axios";
import { useToast } from "../../hooks/common/useToast";
import { translateStatus, getStatusClass } from "../../utils/formatters/statusUtils";
import { useProgressState } from "../../hooks/common/useProgressState";
import { useTranslation } from "react-i18next";
import { translateObjective, translateOptimizationGoal, formatTargetingVN } from "../../utils/formatters/translationUtils";
import LoadingOverlay from "../../components/common/LoadingOverlay/LoadingOverlay";

function ArchiveAds() {
  const { t } = useTranslation(['ads']);
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [showWizard, setShowWizard] = useState(false);
  const [wizardMode, setWizardMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedAdset, setSelectedAdset] = useState(null);

  // Account
  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Date range filter
  const [dateRange, setDateRange] = useState("");

  // Data - lưu TẤT CẢ data đã fetch từ BE (chưa phân trang ở FE)
  // Dùng cho việc sort và phân trang ở Frontend
  const [datasets, setDatasets] = useState({
    campaigns: [],
    adsets: [],
    ads: [],
  });

  // Track tab trước đó để tránh xung đột logic
  const prevActiveTabRef = useRef(activeTab);

  // 🔹 Pagination state (phải khai báo trước getFilteredRows)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });

  const [checkAll, setCheckAll] = useState(false);
  const [hasSelectedItems, setHasSelectedItems] = useState(false);

  // Confirmation popup state
  const [confirmationPopup, setConfirmationPopup] = useState({
    isOpen: false,
    type: "delete", // 'delete' | 'restore'
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
  // ✅ Chỉ hiển thị các items có status ARCHIVED
  const getFilteredRows = () => {
    let result = [];

    if (activeTab === "campaigns") {
      // Filter chỉ lấy ARCHIVED campaigns
      result = datasets.campaigns.filter(
        (campaign) => campaign.status === "ARCHIVED"
      );
    } else if (activeTab === "adsets") {
      let filteredAdsets = datasets.adsets.filter(
        (adset) => adset.status === "ARCHIVED"
      );

      if (selectedCampaign) {
        filteredAdsets = filteredAdsets.filter(
          (a) => a.campaignId === selectedCampaign.id
        );
      }
      result = filteredAdsets;
    } else if (activeTab === "ads") {
      let filteredAds = datasets.ads.filter(
        (ad) => ad.status === "ARCHIVED"
      );

      if (selectedAdset) {
        filteredAds = filteredAds.filter((a) => String(a.adsetId) === String(selectedAdset.id));
      } else if (selectedCampaign) {
        // Filter ads thông qua adset relationship
        const campaignAdsets = datasets.adsets.filter(
          (adset) => adset.campaignId === selectedCampaign.id && adset.status === "ARCHIVED"
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

  // 🔹 Restore (unarchive)
  // const handleRestore = (id) => {
  //   const key =
  //     activeTab === "campaigns"
  //       ? "campaigns"
  //       : activeTab === "adsets"
  //       ? "adsets"
  //       : "ads";

  //   const idsToRestore = id
  //     ? [id]
  //     : datasets[key].filter((item) => item.isChecked).map((item) => item.id);

  //   if (idsToRestore.length === 0) {
  //     toast.warning(t('toasts.select_item_archive_warning'));
  //     return;
  //   }

  //   const entityName = getEntityName(key);

  //   setConfirmationPopup({
  //     isOpen: true,
  //     type: "archive", // Dùng type archive nhưng với message khác
  //     title: `Khôi phục ${idsToRestore.length} ${entityName}`,
  //     message: `Bạn có chắc muốn khôi phục ${idsToRestore.length} ${entityName} từ kho lưu trữ?`,
  //     onConfirm: () => executeRestore(idsToRestore),
  //     isLoading: false,
  //   });
  // };

  // const executeRestore = async (idsToRestore) => {
  //   setConfirmationPopup((prev) => ({ ...prev, isLoading: true }));

  //   try {
  //     // TODO: Implement restore API calls
  //     console.log(`Khôi phục ${idsToRestore.length} items:`, idsToRestore);

  //     // Simulate API call
  //     await new Promise((resolve) => setTimeout(resolve, 1000));

  //     const entityName = getEntityName(activeTab);
  //     toast.success(`Đã khôi phục ${idsToRestore.length} ${entityName} thành công!`);

  //     // Refresh data
  //     handleRefresh();
  //   } catch (error) {
  //     console.error("❌ Lỗi khi khôi phục:", error);
  //     toast.error("Khôi phục thất bại, vui lòng thử lại!");
  //   } finally {
  //     setConfirmationPopup((prev) => ({
  //       ...prev,
  //       isLoading: false,
  //       isOpen: false,
  //     }));
  //   }
  // };

  // Delete (main)
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
      // Lấy token FB từ localStorage
      const fbToken = localStorage.getItem("fb_access_token") || null;

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Gọi đúng service cho từng loại và cập nhật progress
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

      // Cập nhật UI - xóa tất cả items đã được xử lý (bao gồm cả success)
      const processedIds = idsToDelete.slice(0, successCount);

      setDatasets((prev) => ({
        ...prev,
        [key]: prev[key].filter((item) => !processedIds.includes(item.id)),
      }));
      setCheckAll(false);
      setHasSelectedItems(false);

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

  // Navigation
  const handleCampaignClick = (campaign) => {
    setSelectedCampaign(campaign);
    setSelectedAdset(null);
    setActiveTab("adsets");
    fetchAdsetsForCampaign(
      campaign.id || campaign._id || campaign.external_id,
      selectedAccountId
    );
  };

  const handleAdsetClick = (adset) => {
    setSelectedAdset(adset);
    setActiveTab("ads");
    fetchAdsForAdset(adset.id || adset._id || adset.external_id);
  };

  // Reset selections
  const resetSelection = () => {
    setSelectedCampaign(null);
    setSelectedAdset(null);
    setCheckAll(false);
    setHasSelectedItems(false);
  };

  // Fetch campaigns (fetch tất cả để sort và phân trang ở FE - chỉ từ DB)
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
        const { items } = response.data;

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
          // Insights từ DB nếu có, mặc định là 0
          impressions: campaign.impressions || 0,
          reach: campaign.reach || 0,
          results: campaign.results || 0,
          quality: campaign.quality_ranking || '-',
        }));

        const merged = mapped;

        // Lưu TẤT CẢ data để sort và phân trang ở FE
        setDatasets(prev => ({
          ...prev,
          campaigns: merged,
        }));
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    }
  }, []);

  // Fetch AdSets for campaign (fetch tất cả để sort và phân trang ở FE)
  const fetchAdsetsForCampaign = useCallback(async (campaignId, accountId) => {
    if (!campaignId || !accountId) return;
    try {
      const response = await axiosInstance.get(`/api/adsets`, {
        params: {
          campaign_id: campaignId,
          fetch_all: true // Fetch tất cả để FE sort và phân trang
        }
      });
      if (response.data) {
        const { items } = response.data;

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
          // Insights từ DB nếu có, mặc định là 0
          impressions: adset.impressions || 0,
          reach: adset.reach || 0,
          results: adset.results || 0,
          quality: adset.quality_ranking || '-',
        }));

        const merged = mapped;

        // Lưu TẤT CẢ data để sort và phân trang ở FE
        setDatasets(prev => ({
          ...prev,
          adsets: merged,
        }));
      }
    } catch (error) {
      console.error("Error fetching adsets:", error);
    }
  }, []);

  // Fetch Ads for AdSet (fetch tất cả để sort và phân trang ở FE)
  const fetchAdsForAdset = useCallback(async (adsetId) => {
    if (!adsetId) return;
    try {
      const response = await axiosInstance.get(`/api/ads`, {
        params: {
          adset_id: adsetId,
          fetch_all: true // Fetch tất cả để FE sort và phân trang
        }
      });
      if (response.data) {
        const { items } = response.data;

        const mapped = items.map((ad) => ({
          ...ad,
          id: ad._id || ad.id || ad.external_id,
          external_id: ad.external_id,
          adsetId,
          isChecked: false,
          enabled: ad.status === "ACTIVE",
          budget: 0, // Ads don't have budget, it's inherited from adset
          created_by: ad.created_by,
          updated_at: ad.updated_at || ad.updatedAt,
          // Insights từ DB nếu có, mặc định là 0
          impressions: ad.impressions || 0,
          reach: ad.reach || 0,
          results: ad.results || 0,
          quality: ad.quality_ranking || '-',
        }));

        const merged = mapped;

        // Lưu TẤT CẢ data để sort và phân trang ở FE
        setDatasets(prev => ({ ...prev, ads: merged }));
      }
    } catch (error) {
      console.error("Error fetching ads:", error);
    }
  }, []);

  // Fetch all Adsets & Ads by account (fetch tất cả để sort và phân trang ở FE)
  const fetchAllAdsetsForAccount = useCallback(async (accountId) => {
    if (!accountId) return;
    try {
      const response = await axiosInstance.get(`/api/adsets`, {
        params: {
          account_id: accountId,
          fetch_all: true // Fetch tất cả để FE sort và phân trang
        }
      });
      if (response.data) {
        const { items } = response.data;

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
          // Insights từ DB nếu có, mặc định là 0
          impressions: adset.impressions || 0,
          reach: adset.reach || 0,
          results: adset.results || 0,
          quality: adset.quality_ranking || '-',
        }));

        const merged = mapped;

        // Lưu TẤT CẢ data để sort và phân trang ở FE
        setDatasets(prev => ({
          ...prev,
          adsets: merged,
        }));
      }
    } catch (error) {
      console.error("Error fetching adsets:", error);
    }
  }, []);

  const fetchAllAdsForAccount = useCallback(async (accountId) => {
    if (!accountId) return;
    try {
      const response = await axiosInstance.get(`/api/ads`, {
        params: {
          account_id: accountId,
          fetch_all: true // Fetch tất cả để FE sort và phân trang
        }
      });
      if (response.data) {
        const { items } = response.data;

        const mapped = items.map((ad) => ({
          ...ad,
          id: ad._id || ad.id || ad.external_id,
          external_id: ad.external_id,
          adsetId: ad.adset_id || ad.set_id,
          isChecked: false,
          enabled: ad.status === "ACTIVE",
          budget: 0, // Ads don't have budget, it's inherited from adset
          created_by: ad.created_by,
          updated_at: ad.updated_at || ad.updatedAt,
          // Insights từ DB nếu có, mặc định là 0
          impressions: ad.impressions || 0,
          reach: ad.reach || 0,
          results: ad.results || 0,
          quality: ad.quality_ranking || '-',
        }));

        const merged = mapped;

        // Lưu TẤT CẢ data để sort và phân trang ở FE
        setDatasets(prev => ({ ...prev, ads: merged }));
      }
    } catch (error) {
      console.error("Error fetching ads:", error);
    }
  }, []);

  // Fetch Ad Accounts (chỉ lấy ACTIVE accounts)
  useEffect(() => {
    const fetchAdAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const response = await axiosInstance.get("/api/ads-accounts", {
          params: { status: 'ACTIVE' } // Chỉ lấy accounts có status ACTIVE
        });
        if (response.data?.items) {
          const accounts = response.data.items;
          setAdAccounts(accounts);

          // Đọc từ cache localStorage
          const savedAccountId = localStorage.getItem('selectedAdAccount');

          if (savedAccountId && accounts.length > 0) {
            // Kiểm tra account đã lưu có tồn tại không
            const existingAccount = accounts.find(acc => acc.external_id === savedAccountId);
            if (existingAccount) {
              setSelectedAccountId(savedAccountId);
            }
            // Nếu không có cache hoặc account không hợp lệ -> không chọn gì
          }

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

  // 🔹 Load data khi chuyển tab hoặc account thay đổi (KHÔNG phụ thuộc vào pagination)
  useEffect(() => {
    if (selectedAccountId && initialized) {
      // Reset pagination về page 1 khi chuyển tab
      if (prevActiveTabRef.current !== activeTab) {
        setPagination(prev => ({ ...prev, page: 1 }));
        prevActiveTabRef.current = activeTab;
      }

      // Fetch data (fetch tất cả, không phân trang)
      if (activeTab === "campaigns") {
        fetchCampaignsForAccount(selectedAccountId);
      } else if (activeTab === "adsets") {
        if (selectedCampaign) {
          fetchAdsetsForCampaign(selectedCampaign.id, selectedAccountId);
        } else {
          fetchAllAdsetsForAccount(selectedAccountId);
        }
      } else if (activeTab === "ads") {
        if (selectedAdset) {
          fetchAdsForAdset(selectedAdset.id);
        } else {
          fetchAllAdsForAccount(selectedAccountId);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedAccountId,
    initialized,
    activeTab,
    selectedCampaign?.id,
    selectedAdset?.id,
    fetchCampaignsForAccount,
    fetchAdsetsForCampaign,
    fetchAllAdsetsForAccount,
    fetchAdsForAdset,
    fetchAllAdsForAccount
  ]);

  // useEffect riêng để reset page khi limit thay đổi
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [pagination.limit]);

  // 🔹 Handle account change
  const handleAccountChange = (e) => {
    const accountId = e.target.value;
    setSelectedAccountId(accountId);
    localStorage.setItem("selectedAdAccount", accountId);
    resetSelection();
    setActiveTab("campaigns");
    if (accountId) {
      fetchCampaignsForAccount(accountId);
      fetchAllAdsetsForAccount(accountId);
      fetchAllAdsForAccount(accountId);
    } else {
      // Clear datasets when deselecting
      setDatasets({ campaigns: [], adsets: [], ads: [] });
    }
  };

  // 🔹 Handle refresh data (chỉ fetch từ DB, không sync Facebook)
  const handleRefresh = useCallback(async () => {
    if (!selectedAccountId) {
      toast.warning(t('toasts.select_account_warning'), {
        description: t('toasts.select_account_description'),
      });
      return;
    }

    try {
      // Chỉ fetch data cho tab hiện tại từ DB (KHÔNG sync Facebook)
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
          await fetchAdsForAdset(selectedAdset.id);
        } else {
          await fetchAllAdsForAccount(selectedAccountId);
        }
      }

      console.log("✅ Data refreshed successfully");
      toast.success(t('toasts.refresh_success'));
    } catch (error) {
      console.error("❌ Error refreshing data:", error);
      toast.error(t('toasts.refresh_error'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, activeTab, selectedCampaign?.id, selectedAdset?.id, fetchCampaignsForAccount, fetchAdsetsForCampaign, fetchAllAdsetsForAccount, fetchAdsForAdset, fetchAllAdsForAccount, toast, t]);

  return (
    <div className="archive-ads-layout">
      <LoadingOverlay isLoading={loadingAccounts} message="Đang tải..." />
      <div className="archive-ads-content">
        <div className="archive-ads-center">
          <div className="archive-ads-card">
            <div className="archive-ads-toolbar">
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
              </div>

              <div className="filters">
                <DateRangePicker
                  value={dateRange}
                  onChange={(value) => setDateRange(value)}
                  placeholder={t('management.dateRangePlaceholder') || "dd/mm/yyyy - dd/mm/yyyy"}
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
            <div className="archive-ads-tabs">
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
                  if (selectedAccountId)
                    fetchAllAdsetsForAccount(selectedAccountId);
                }}
              >
                <span className="tab-icon">▣</span> {t('management.adsets_tab')}
              </button>
              <button
                className={`tab ${activeTab === "ads" ? "active" : ""}`}
                onClick={() => {
                  resetSelection();
                  setActiveTab("ads");
                  if (selectedAccountId)
                    fetchAllAdsForAccount(selectedAccountId);
                }}
              >
                <span className="tab-icon">▥</span> {t('management.ads_tab')}
              </button>

              {hasSelectedItems && (
                <div className="icon-beside-tab">
                  {/* <button
                    className="archive-ads-action-btn archive-ads-restore-btn"
                    onClick={() => handleRestore()}
                    title="Khôi phục"
                  >
                    <RotateCcw size={15} />
                  </button> */}
                  <button
                    className="archive-ads-action-btn archive-ads-delete-btn"
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
                disabled={!selectedAccountId}
                title={t('management.refresh')}
              >
                <RefreshCw size={16} />{t('management.refresh')}
              </button>
            </div>

            {/* Table */}
            <div className="archive-ads-table-wrapper">
              <table className="archive-ads-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={checkAll}
                        onChange={handleCheckAll}
                      />
                    </th>
                    <th>{t('management.name')}</th>
                    <th>{t('management.status')}</th>
                    <th>{t('management.budget')}</th>
                    {activeTab === "adsets" && <th>{t('management.runtime')}</th>}
                    {activeTab === "adsets" && <th>{t('management.targeting')}</th>}
                    {activeTab === "campaigns" && <th>{t('management.objective')}</th>}
                    <th>{t('management.impressions')}</th>
                    <th>{t('management.reach')}</th>
                    <th>{t('management.results')}</th>
                    {/* <th>{t('management.quality')}</th> */}
                    <th>{t('management.creator')}</th>
                    <th>{t('management.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === "ads" || activeTab === "adsets" || activeTab === "campaigns") && rows.length === 0 && (
                    <tr>
                      <td colSpan={activeTab === "adsets" ? 12 : activeTab === "campaigns" ? 11 : 10} style={{ textAlign: 'center', padding: '16px', color: '#6b7280' }}>
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
                        <span
                          className={`name-text ${activeTab === "ads"
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
                      {/* <td className="text-center">{row.quality || "0"}</td> */}
                      <td className="text-center">
                        {row.created_by?.full_name || row.created_by?.email || t('labels.not_set')}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="archive-ads-action-btn archive-ads-update-btn"
                            onClick={() => handleUpdate(row.id)}
                            title={t('management.view')}
                          >
                            <Eye size={14} />
                          </button>
                          {/* <button
                            className="archive-ads-action-btn archive-ads-restore-btn"
                            onClick={() => handleRestore(row.id)}
                            title="Khôi phục"
                          >
                            <RotateCcw size={14} />
                          </button> */}
                          <button
                            className="archive-ads-action-btn archive-ads-delete-btn"
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
            // Refresh data after successful create/update (chỉ từ DB)
            handleRefresh();
          }}
          onError={() => {
            // Refresh data sau khi publish thất bại (chỉ từ DB)
            handleRefresh();
          }}
          onDraftSaved={() => {
            // CHỈ FETCH LẠI TỪ DB
            handleRefresh();
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

export default ArchiveAds;

