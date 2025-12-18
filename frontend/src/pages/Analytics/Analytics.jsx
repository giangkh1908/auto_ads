import { useState, useEffect } from "react";
import { Search, RefreshCw, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import ChatAIWidget from "../../components/feature/ChatAI/ChatAIWidget";
import axiosInstance from "../../utils/api/axios";
import "./Analytics.css";
import { useMyPackage } from "../../hooks/shop/useMyPackage";
import { toast } from "sonner";
import LoadingOverlay from "../../components/common/LoadingOverlay/LoadingOverlay";
import Pagination from "../../components/common/Pagination/Pagination";
import { useDebounce } from "../../hooks/common/useDebounce";
import DateRangePicker from "../../components/common/DateRangePicker/DateRangePicker";


// Breakdown options (always available)
const BREAKDOWN_OPTIONS = [
  { key: 'campaign_name', labelKey: 'breakdownOptions.campaign_name', default: true },
  { key: 'adset_name', labelKey: 'breakdownOptions.adset_name', default: true },
  { key: 'name', labelKey: 'breakdownOptions.name', default: true },
  { key: 'page_name', labelKey: 'breakdownOptions.page_name', default: true },
  { key: 'ad_text', labelKey: 'breakdownOptions.ad_text', default: false },
  { key: 'age_range', labelKey: 'breakdownOptions.age_range', default: false },
  { key: 'campaign_objective', labelKey: 'breakdownOptions.campaign_objective', default: false },
  { key: 'date', labelKey: 'breakdownOptions.date', default: false },
];

// Data columns by objective (metrics only, no breakdown columns)
const DATA_COLUMNS_BY_OBJECTIVE = {
  OUTCOME_AWARENESS: [
    { key: 'reach', labelKey: 'dataColumns.reach', format: 'number' },
    { key: 'cpm', labelKey: 'dataColumns.cpm', format: 'currency' },
    { key: 'spend', labelKey: 'dataColumns.spend', format: 'currency' },
    { key: 'frequency', labelKey: 'dataColumns.frequency', format: 'number' },
    { key: 'impressions', labelKey: 'dataColumns.impressions', format: 'number' },
    { key: 'cost_per_result', labelKey: 'dataColumns.cost_per_result', format: 'currency' },
  ],

  OUTCOME_APP_PROMOTION: [
    { key: 'mobile_app_install', labelKey: 'dataColumns.mobile_app_install', format: 'number' },
    { key: 'cost_per_mobile_app_install', labelKey: 'dataColumns.cost_per_mobile_app_install', format: 'currency' },
    { key: 'spend', labelKey: 'dataColumns.spend', format: 'currency' },
    { key: 'link_clicks', labelKey: 'dataColumns.link_clicks', format: 'number' },
    { key: 'ctr', labelKey: 'dataColumns.ctr', format: 'percent' },
    { key: 'impressions', labelKey: 'dataColumns.impressions', format: 'number' },
  ],

  OUTCOME_ENGAGEMENT: [
    { key: 'post_engagement', labelKey: 'dataColumns.post_engagement', format: 'number' },
    { key: 'cost_per_inline_post_engagement', labelKey: 'dataColumns.cost_per_inline_post_engagement', format: 'currency' },
    { key: 'spend', labelKey: 'dataColumns.spend', format: 'currency' },
    { key: 'impressions', labelKey: 'dataColumns.impressions', format: 'number' },
    { key: 'quality_ranking', labelKey: 'dataColumns.quality_ranking', format: 'text' },
  ],

  OUTCOME_TRAFFIC: [
    { key: 'link_clicks', labelKey: 'dataColumns.link_clicks', format: 'number' },
    { key: 'cpc', labelKey: 'dataColumns.cpc', format: 'currency' },
    { key: 'spend', labelKey: 'dataColumns.spend', format: 'currency' },
    { key: 'ctr', labelKey: 'dataColumns.ctr', format: 'percent' },
    { key: 'cpm', labelKey: 'dataColumns.cpm', format: 'currency' },
    { key: 'impressions', labelKey: 'dataColumns.impressions', format: 'number' },
  ],

  OUTCOME_LEADS: [
    { key: 'leads', labelKey: 'dataColumns.leads', format: 'number' },
    { key: 'conversions', labelKey: 'dataColumns.conversions', format: 'number' },
    { key: 'cost_per_lead', labelKey: 'dataColumns.cost_per_lead', format: 'currency' },
    { key: 'spend', labelKey: 'dataColumns.spend', format: 'currency' },
    { key: 'link_clicks', labelKey: 'dataColumns.link_clicks', format: 'number' },
    { key: 'conversion_rate', labelKey: 'dataColumns.conversion_rate', format: 'percent' },
    { key: 'quality_ranking', labelKey: 'dataColumns.quality_ranking', format: 'text' },
  ],

  OUTCOME_SALES: [
    { key: 'website_purchases', labelKey: 'dataColumns.website_purchases', format: 'number' },
    { key: 'cost_per_conversion', labelKey: 'dataColumns.cost_per_conversion', format: 'currency' },
    { key: 'website_purchase_roas', labelKey: 'dataColumns.website_purchase_roas', format: 'number' },
    { key: 'cost_per_action', labelKey: 'dataColumns.cost_per_action', format: 'currency' },
    { key: 'spend', labelKey: 'dataColumns.spend', format: 'currency' },
    { key: 'ctr', labelKey: 'dataColumns.ctr', format: 'percent' },
  ],
};

function Analytics() {
  const { t } = useTranslation('analytics');
  // State definitions
  const [selectedAccount, setSelectedAccount] = useState("");
  const [adAccounts, setAdAccounts] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [selectedObjective, setSelectedObjective] = useState("ALL");

  // Debounce search query (500ms) để tránh gọi API quá nhiều khi user gõ
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20, // Default 20 items per page
    total: 0,
    totalPages: 1
  });
  const [dataDate, setDataDate] = useState(null);

  // Breakdown selections
  const [selectedBreakdowns, setSelectedBreakdowns] = useState(
    BREAKDOWN_OPTIONS.filter(opt => opt.default).map(opt => opt.key)
  );

  // Settings tab state
  const [activeSettingsTab, setActiveSettingsTab] = useState('Breakdown');

  // Data columns selections - get all unique columns from all objectives
  const getAllDataColumns = () => {
    const allColumns = new Map();
    Object.values(DATA_COLUMNS_BY_OBJECTIVE).forEach(cols => {
      cols.forEach(col => {
        if (!allColumns.has(col.key)) {
          allColumns.set(col.key, col);
        }
      });
    });
    return Array.from(allColumns.values());
  };

  const ALL_DATA_COLUMNS = getAllDataColumns();

  // Get default data columns based on selected objective
  const getDefaultDataColumns = () => {
    if (selectedObjective === "ALL") return [];
    let objectiveKey = selectedObjective;

    // Map legacy objectives
    if (selectedObjective === "OUTCOME_TRAFFIC" || selectedObjective === "LINK_CLICKS") {
      objectiveKey = "OUTCOME_TRAFFIC";
    } else if (selectedObjective === "OUTCOME_AWARENESS" || selectedObjective === "BRAND_AWARENESS" || selectedObjective === "REACH") {
      objectiveKey = "OUTCOME_AWARENESS";
    } else if (selectedObjective === "OUTCOME_ENGAGEMENT" || selectedObjective === "POST_ENGAGEMENT" || selectedObjective === "PAGE_LIKES" || selectedObjective === "EVENT_RESPONSES") {
      objectiveKey = "OUTCOME_ENGAGEMENT";
    } else if (selectedObjective === "OUTCOME_LEADS" || selectedObjective === "LEAD_GENERATION" || selectedObjective === "MESSAGES") {
      objectiveKey = "OUTCOME_LEADS";
    } else if (selectedObjective === "OUTCOME_SALES" || selectedObjective === "CONVERSIONS" || selectedObjective === "CATALOG_SALES" || selectedObjective === "STORE_VISITS") {
      objectiveKey = "OUTCOME_SALES";
    } else if (selectedObjective === "OUTCOME_APP_PROMOTION" || selectedObjective === "APP_INSTALLS") {
      objectiveKey = "OUTCOME_APP_PROMOTION";
    }

    const defaultCols = DATA_COLUMNS_BY_OBJECTIVE[objectiveKey] || [];
    return defaultCols.map(col => col.key);
  };

  const [selectedDataColumns, setSelectedDataColumns] = useState([]);

  // Update selected data columns when objective changes
  useEffect(() => {
    if (selectedObjective !== "ALL") {
      const defaultCols = getDefaultDataColumns();
      setSelectedDataColumns(defaultCols);
    } else {
      setSelectedDataColumns([]);
    }
  }, [selectedObjective]);

  // Chat AI Logic
  const { hasFeature, loading: entitlementsLoading } = useMyPackage();
  const canUseAnalyticsChatAI = hasFeature("analytics_chat_ai");

  // Get selected account info
  const selectedAccountInfo = adAccounts.find(acc => acc.external_id === selectedAccount);

  // Fetch ad accounts on mount
  useEffect(() => {
    fetchAdAccounts();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (selectedAccount) {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [selectedAccount, selectedObjective, debouncedSearchQuery, dateRange]);

  // Fetch ads when account, filters, or pagination changes
  useEffect(() => {
    if (selectedAccount) {
      fetchAds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount, selectedObjective, debouncedSearchQuery, dateRange, pagination.page, pagination.limit]);

  const fetchAdAccounts = async () => {
    try {
      const response = await axiosInstance.get("/api/ads-accounts", {
        params: { status: "ACTIVE" }
      });
      const accounts = response.data?.items || [];
      setAdAccounts(accounts);

      // Đọc từ cache localStorage
      const savedAccountId = localStorage.getItem('selectedAdAccount');

      if (savedAccountId && accounts.length > 0) {
        // Kiểm tra account đã lưu có tồn tại không
        const existingAccount = accounts.find(acc => acc.external_id === savedAccountId);
        if (existingAccount) {
          setSelectedAccount(savedAccountId);
        }
        // Nếu không có cache hoặc account không hợp lệ -> không chọn gì
      }
    } catch (error) {
      console.error("Error fetching ad accounts:", error);
    }
  };

  const fetchAds = async () => {
    if (!selectedAccount) return;

    setLoading(true);
    try {
      const response = await axiosInstance.get("/api/analytics/snapshots", {
        params: {
          account_id: selectedAccount,
          objective: selectedObjective !== 'ALL' ? selectedObjective : undefined,
          search: debouncedSearchQuery || undefined,
          date_range: dateRange || undefined,
          page: pagination.page,
          limit: pagination.limit,
        }
      });

      const snapshotsData = response.data?.items || [];
      const responseTotal = response.data?.total || 0;
      const responseDataDate = response.data?.dataDate;
      const responsePage = response.data?.page || pagination.page;
      const responseLimit = response.data?.limit || pagination.limit;

      // Process data
      const processedAds = snapshotsData.map(snapshot => ({
        id: snapshot._id,
        name: snapshot.ad_name,
        status: snapshot.ad_status,
        campaign_name: snapshot.campaign_name,
        campaign_objective: snapshot.campaign_objective,
        adset_name: snapshot.adset_name,
        page_name: snapshot.page_name || 'N/A',
        ad_text: 'N/A',
        age_range: snapshot.age_range || 'N/A',
        date: responseDataDate ? new Date(responseDataDate).toLocaleDateString('vi-VN') : 'N/A',
        spend: snapshot.spend,
        impressions: snapshot.impressions,
        clicks: snapshot.clicks,
        reach: snapshot.reach,
        frequency: snapshot.frequency,
        cpm: snapshot.cpm,
        cpc: snapshot.cpc,
        ctr: snapshot.ctr,
        cost_per_result: snapshot.cost_per_result,
        link_clicks: snapshot.link_clicks,
        link_cpc: snapshot.link_cpc,
        link_ctr: snapshot.link_ctr,
        post_engagement: snapshot.post_engagement,
        cost_per_inline_post_engagement: snapshot.cost_per_inline_post_engagement,
        quality_ranking: snapshot.quality_ranking,
        leads: snapshot.leads,
        cost_per_lead: snapshot.cost_per_lead,
        conversions: snapshot.conversions,
        conversion_rate: snapshot.conversion_rate,
        website_purchases: snapshot.website_purchases,
        cost_per_conversion: snapshot.cost_per_conversion,
        website_purchase_roas: snapshot.website_purchase_roas,
        cost_per_action: snapshot.cost_per_action,
        mobile_app_install: snapshot.mobile_app_install,
        cost_per_mobile_app_install: snapshot.cost_per_mobile_app_install,
      }));

      setAds(processedAds);

      // Update pagination
      const totalPages = Math.ceil(responseTotal / responseLimit) || 1;
      setPagination(prev => ({
        ...prev,
        total: responseTotal,
        totalPages,
        page: responsePage,
        limit: responseLimit
      }));

      setDataDate(responseDataDate);
    } catch (error) {
      console.error("Error fetching analytics snapshots:", error);
    } finally {
      setLoading(false);
    }
  };

  // Sync analytics snapshots from Facebook
  const syncAnalytics = async () => {
    if (!selectedAccount) {
      toast.warning(t('toast.selectAccountWarning'));
      return;
    }

    if (syncing) {
      return;
    }

    setSyncing(true);
    try {
      const response = await axiosInstance.post("/api/analytics/snapshots/sync", {
        account_id: selectedAccount,
      });

      if (response.data) {
        const { rateLimitReached, retryAfter } = response.data;

        if (rateLimitReached) {
          toast.warning(t('toast.syncWarning', { message: response.data.message, retryAfter }));
        } else {
          toast.success(t('toast.syncSuccess'));
          setTimeout(() => {
            fetchAds();
          }, 5000);
        }
      }
    } catch (error) {
      console.error("Error syncing analytics:", error);
      const errorResponse = error.response?.data;

      if (errorResponse?.rateLimitReached) {
        toast.warning(t('toast.syncWarning', { message: errorResponse.message, retryAfter: errorResponse.retryAfter || 60 }));
      } else {
        toast.error(t('toast.syncError', { message: errorResponse?.message || error.message }));
      }
    } finally {
      setSyncing(false);
    }
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleItemsPerPageChange = (newLimit) => {
    setPagination(prev => ({ ...prev, page: 1, limit: newLimit }));
  };

  // Filter ads - Backend already filters by hasData and objective
  // Only need client-side search filter for immediate response
  const filteredAds = ads;

  // Calculate highlighters
  const highlighters = (() => {
    if (selectedObjective === "ALL") return new Set();

    const groups = {}; // Key: campaign_name + adset_name

    // Group ads
    filteredAds.forEach(ad => {
      const key = `${ad.campaign_name}|${ad.adset_name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ad);
    });

    const highlights = new Set();

    // Determine metric to highlight based on objective
    let metricKey = "";
    // Map legacy objectives to current keys if needed, similar to getDefaultDataColumns
    let objectiveKey = selectedObjective;
    if (selectedObjective === "OUTCOME_TRAFFIC" || selectedObjective === "LINK_CLICKS") {
      metricKey = "link_clicks";
    } else if (selectedObjective === "OUTCOME_AWARENESS" || selectedObjective === "BRAND_AWARENESS" || selectedObjective === "REACH") {
      metricKey = "reach";
    } else if (selectedObjective === "OUTCOME_ENGAGEMENT" || selectedObjective === "POST_ENGAGEMENT" || selectedObjective === "PAGE_LIKES" || selectedObjective === "EVENT_RESPONSES") {
      metricKey = "post_engagement";
    } else if (selectedObjective === "OUTCOME_LEADS" || selectedObjective === "LEAD_GENERATION" || selectedObjective === "MESSAGES") {
      metricKey = "leads"; // Fallback to conversions if leads is 0? Let's stick to primary for now.
    } else if (selectedObjective === "OUTCOME_SALES" || selectedObjective === "CONVERSIONS" || selectedObjective === "CATALOG_SALES" || selectedObjective === "STORE_VISITS") {
      metricKey = "website_purchases";
    } else if (selectedObjective === "OUTCOME_APP_PROMOTION" || selectedObjective === "APP_INSTALLS") {
      metricKey = "mobile_app_install";
    }

    if (!metricKey) return highlights;

    // Find winner in each group
    Object.values(groups).forEach(group => {
      if (group.length < 1) return;

      let maxVal = -1;
      let winners = [];

      group.forEach(ad => {
        const val = Number(ad[metricKey]) || 0;
        if (val > maxVal) {
          maxVal = val;
          winners = [ad.id];
        } else if (val === maxVal && val > 0) {
          winners.push(ad.id);
        }
      });

      if (maxVal > 0) {
        winners.forEach(id => highlights.add(`${id}-${metricKey}`));
      }
    });

    return highlights;
  })();

  // Hardcoded 6 objectives (not from data)
  const AVAILABLE_OBJECTIVES = [
    { value: 'OUTCOME_AWARENESS', labelKey: 'objectives.OUTCOME_AWARENESS' },
    { value: 'OUTCOME_TRAFFIC', labelKey: 'objectives.OUTCOME_TRAFFIC' },
    { value: 'OUTCOME_ENGAGEMENT', labelKey: 'objectives.OUTCOME_ENGAGEMENT' },
    { value: 'OUTCOME_LEADS', labelKey: 'objectives.OUTCOME_LEADS' },
    { value: 'OUTCOME_SALES', labelKey: 'objectives.OUTCOME_SALES' },
    { value: 'OUTCOME_APP_PROMOTION', labelKey: 'objectives.OUTCOME_APP_PROMOTION' },
  ];

  // Get columns to display
  const getColumns = () => {
    const breakdownCols = BREAKDOWN_OPTIONS
      .filter(opt => selectedBreakdowns.includes(opt.key))
      .map(opt => ({ key: opt.key, label: t(opt.labelKey), fixed: true }));

    // Filter data columns based on user selection
    const dataCols = ALL_DATA_COLUMNS
      .filter(col => selectedDataColumns.includes(col.key))
      .map(col => ({ key: col.key, label: t(col.labelKey), format: col.format }));

    return [...breakdownCols, ...dataCols];
  };

  const columns = getColumns();

  // Toggle breakdown
  const toggleBreakdown = (key) => {
    setSelectedBreakdowns(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  // Toggle data column
  const toggleDataColumn = (key) => {
    setSelectedDataColumns(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  // Format value
  const formatValue = (value, format) => {
    if (value === null || value === undefined) return '-';

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency: 'VND'
        }).format(value);
      case 'number':
        return new Intl.NumberFormat('vi-VN').format(value);
      case 'percent':
        return `${Number(value).toFixed(2)}%`;
      case 'text':
      default:
        return value;
    }
  };

  return (
    <div className="analytics-container">
      <LoadingOverlay isLoading={loading || syncing} message={syncing ? t('syncing_data') : t('loadingData')} />
      {!entitlementsLoading && !canUseAnalyticsChatAI && (
        <div className="analytics-entitlement-alert">
          {t('entitlementAlert')}
        </div>
      )}

      <div className="analytics-header">
        <h1 className="analytics-title">{t('title')}</h1>

        <div className="analytics-controls">
          {/* Account Selector */}
          <select
            className="analytics-select"
            value={selectedAccount}
            onChange={(e) => {
              const newAccountId = e.target.value;
              setSelectedAccount(newAccountId);
              if (newAccountId) {
                localStorage.setItem('selectedAdAccount', newAccountId);
              }
            }}
          >
            <option value="">{t('selectAccount')}</option>
            {adAccounts.map(account => (
              <option key={account._id || account.id} value={account.external_id}>
                {account.name}
              </option>
            ))}
          </select>

          {/* Objective Filter */}
          <select
            className="analytics-select"
            value={selectedObjective}
            onChange={(e) => setSelectedObjective(e.target.value)}
          >
            <option value="ALL">{t('selectObjective')}</option>
            {AVAILABLE_OBJECTIVES.map(obj => (
              <option key={obj.value} value={obj.value}>
                {t(obj.labelKey)}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="analytics-search">
            <Search size={16} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Date Range Picker */}
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder={t('dateRangePlaceholder')}
          />

          {/* Sync Button */}
          <button
            className="analytics-refresh-btn"
            onClick={syncAnalytics}
            disabled={syncing || !selectedAccount}
            title="Sync dữ liệu từ Facebook"
          >
            <RefreshCw size={16} className={syncing ? "spinning" : ""} />
            {syncing ? ` ${t('syncing')}` : ` ${t('syncButton')}`}
          </button>
        </div>
      </div>

      <div className="analytics-main">
        <div className="analytics-table-section">
          {loading ? (
            <div className="analytics-loading">
              <RefreshCw size={32} className="spinning" />
              <p>{t('loadingData')}</p>
            </div>
          ) : !selectedAccount ? (
            <div className="analytics-empty-state">
              <p>{t('emptyStates.selectAccount')}</p>
            </div>
          ) : selectedObjective === "ALL" ? (
            <div className="analytics-empty-state">
              <p>{t('emptyStates.selectObjective')}</p>
            </div>
          ) : (
            <>
              {/* Data info bar */}
              <div className="analytics-info-bar">
                <span>
                  {t('infoBar.showing', { count: ads.length, total: pagination.total })}
                </span>
                {dataDate && <span>{t('infoBar.updated', { date: new Date(dataDate).toLocaleDateString('vi-VN') })}</span>}
              </div>

              <div className="analytics-table-container">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      {columns.map(col => (
                        <th key={col.key} className={col.fixed ? 'analytics-breakdown-column' : ''}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAds.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} className="analytics-empty-table">
                          {t('emptyStates.noData')}
                        </td>
                      </tr>
                    ) : (
                      filteredAds.map(ad => (
                        <tr key={ad.id}>
                          {columns.map(col => {
                            const isHighlighted = highlighters.has(`${ad.id}-${col.key}`);
                            return (
                              <td key={col.key} className={`${col.fixed ? 'analytics-breakdown-column' : ''} ${isHighlighted ? 'analytics-highlight-cell' : ''}`}>
                                {isHighlighted && <span> </span>}
                                {formatValue(ad[col.key], col.format)}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {pagination.total > 0 && (
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    itemsPerPage={pagination.limit}
                    totalItems={pagination.total}
                    startIndex={(pagination.page - 1) * pagination.limit + 1}
                    endIndex={Math.min(pagination.page * pagination.limit, pagination.total)}
                    onPageChange={handlePageChange}
                    onItemsPerPageChange={handleItemsPerPageChange}
                    disabled={loading || syncing}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Settings Panel */}
        <div className="analytics-settings">
          <div className="analytics-settings-header">
            <Settings size={18} />
            <span>{t('settings.title')}</span>
          </div>

          <div className="analytics-settings-tabs">
            <button
              className={`analytics-settings-tab ${activeSettingsTab === 'Breakdown' ? 'analytics-active' : ''}`}
              onClick={() => setActiveSettingsTab('Breakdown')}
            >
              {t('settings.breakdown')}
            </button>
            <button
              className={`analytics-settings-tab ${activeSettingsTab === 'Data' ? 'analytics-active' : ''}`}
              onClick={() => setActiveSettingsTab('Data')}
            >
              {t('settings.data')}
            </button>
          </div>

          <div className="analytics-settings-content">
            {activeSettingsTab === 'Breakdown' && (
              <div className="analytics-breakdown-options">
                {BREAKDOWN_OPTIONS.map(option => (
                  <label key={option.key} className="analytics-checkbox-label">
                    <input
                      type="checkbox"
                      className="analytics-checkbox-input"
                      checked={selectedBreakdowns.includes(option.key)}
                      onChange={() => toggleBreakdown(option.key)}
                    />
                    <span className="analytics-checkbox-text">{t(option.labelKey)}</span>
                  </label>
                ))}
              </div>
            )}

            {activeSettingsTab === 'Data' && (
              <div className="analytics-breakdown-options">
                {selectedObjective === "ALL" ? (
                  <div className="analytics-empty-state" style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
                    {t('emptyStates.selectObjective')}
                  </div>
                ) : (
                  ALL_DATA_COLUMNS.map(column => (
                    <label key={column.key} className="analytics-checkbox-label">
                      <input
                        type="checkbox"
                        className="analytics-checkbox-input"
                        checked={selectedDataColumns.includes(column.key)}
                        onChange={() => toggleDataColumn(column.key)}
                      />
                      <span className="analytics-checkbox-text">{t(column.labelKey)}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat AI Widget */}
      {canUseAnalyticsChatAI && (
        <ChatAIWidget
          accountId={selectedAccount}
          accountName={selectedAccountInfo?.name}
        />
      )}
    </div>
  );
}

export default Analytics;
