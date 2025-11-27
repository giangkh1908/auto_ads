import { useState, useEffect } from "react";
import { Search, RefreshCw, Settings } from "lucide-react";
import ChatAIWidget from "../../components/feature/ChatAI/ChatAIWidget";
import axiosInstance from "../../utils/axios";
import "./Analytics.css";
import { useMyPackage } from "../../hooks/useMyPackage";

/**
 * Analytics Page - Ad Level Performance with Breakdown Panel
 * 
 * Features:
 * - Breakdown Panel: User can select which breakdown columns to show
 * - Dynamic Data Columns: Changes based on campaign objective
 * - 6 Campaign Objectives supported
 */

// Breakdown options (always available)
const BREAKDOWN_OPTIONS = [
  { key: 'campaign_name', label: 'Campaign Name', default: true },
  { key: 'adset_name', label: 'Ad Set Name', default: true },
  { key: 'name', label: 'Ad Name', default: true },
  { key: 'page_name', label: 'Page Name', default: true },
  { key: 'ad_text', label: 'Ad Text', default: false },
  { key: 'age_range', label: 'Age Range', default: false },
  { key: 'campaign_objective', label: 'Campaign Objective', default: false },
  { key: 'date', label: 'Date', default: false },
];

// Data columns by objective (metrics only, no breakdown columns)
const DATA_COLUMNS_BY_OBJECTIVE = {
  OUTCOME_AWARENESS: [
    { key: 'reach', label: 'Reach', format: 'number' },
    { key: 'cpm', label: 'CPM', format: 'currency' },
    { key: 'spend', label: 'Amount Spent', format: 'currency' },
    { key: 'frequency', label: 'Frequency', format: 'number' },
    { key: 'impressions', label: 'Impressions', format: 'number' },
    { key: 'cost_per_result', label: 'Cost per Result', format: 'currency' },
  ],

  OUTCOME_APP_PROMOTION: [
    { key: 'mobile_app_install', label: 'App Installs', format: 'number' },
    { key: 'cost_per_mobile_app_install', label: 'Cost per App Install', format: 'currency' },
    { key: 'spend', label: 'Amount Spent', format: 'currency' },
    { key: 'link_clicks', label: 'Link Clicks', format: 'number' },
    { key: 'ctr', label: 'CTR', format: 'percent' },
    { key: 'impressions', label: 'Impressions', format: 'number' },
  ],

  OUTCOME_ENGAGEMENT: [
    { key: 'post_engagement', label: 'Post Engagement', format: 'number' },
    { key: 'cost_per_inline_post_engagement', label: 'CPE', format: 'currency' },
    { key: 'spend', label: 'Amount Spent', format: 'currency' },
    { key: 'impressions', label: 'Impressions', format: 'number' },
    { key: 'quality_ranking', label: 'Quality Ranking', format: 'text' },
  ],

  OUTCOME_TRAFFIC: [
    { key: 'link_clicks', label: 'Link Clicks', format: 'number' },
    { key: 'cpc', label: 'CPC', format: 'currency' },
    { key: 'spend', label: 'Amount Spent', format: 'currency' },
    { key: 'ctr', label: 'CTR', format: 'percent' },
    { key: 'cpm', label: 'CPM', format: 'currency' },
    { key: 'impressions', label: 'Impressions', format: 'number' },
  ],

  OUTCOME_LEADS: [
    { key: 'leads', label: 'Leads', format: 'number' },
    { key: 'conversions', label: 'Registrations', format: 'number' },
    { key: 'cost_per_lead', label: 'CPL', format: 'currency' },
    { key: 'spend', label: 'Amount Spent', format: 'currency' },
    { key: 'link_clicks', label: 'Link Clicks', format: 'number' },
    { key: 'conversion_rate', label: 'Conversion rate', format: 'percent' },
    { key: 'quality_ranking', label: 'Quality Ranking', format: 'text' },
  ],

  OUTCOME_SALES: [
    { key: 'website_purchases', label: 'Purchases', format: 'number' },
    { key: 'cost_per_conversion', label: 'Cost per Purchase', format: 'currency' },
    { key: 'website_purchase_roas', label: 'ROAS', format: 'number' },
    { key: 'cost_per_action', label: 'CPA', format: 'currency' },
    { key: 'spend', label: 'Amount Spent', format: 'currency' },
    { key: 'ctr', label: 'CTR', format: 'percent' },
  ],
};

function Analytics() {
  // State definitions
  const [selectedAccount, setSelectedAccount] = useState("");
  const [adAccounts, setAdAccounts] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedObjective, setSelectedObjective] = useState("ALL");

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

  // Fetch ads when account changes
  useEffect(() => {
    if (selectedAccount) {
      fetchAds();
    }
  }, [selectedAccount]);

  const fetchAdAccounts = async () => {
    try {
      const response = await axiosInstance.get("/api/ads-accounts", {
        params: { status: "ACTIVE" }
      });
      const accounts = response.data?.items || [];
      setAdAccounts(accounts);

      if (accounts.length > 0 && !selectedAccount) {
        setSelectedAccount(accounts[0].external_id);
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
          search: searchQuery || undefined,
        }
      });

      const snapshotsData = response.data?.items || [];

      // Data is already in the correct format from AnalyticsSnapshot
      const processedAds = snapshotsData.map(snapshot => ({
        id: snapshot._id,
        name: snapshot.ad_name,
        status: snapshot.ad_status,
        campaign_name: snapshot.campaign_name,
        campaign_objective: snapshot.campaign_objective,
        adset_name: snapshot.adset_name,
        page_name: snapshot.page_name || 'N/A',
        ad_text: 'N/A', // TODO: Get from creative
        age_range: snapshot.age_range || 'N/A',
        date: new Date(snapshot.last_synced).toLocaleDateString('vi-VN'),
        // All metrics are already in snapshot
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
    } catch (error) {
      console.error("Error fetching analytics snapshots:", error);
    } finally {
      setLoading(false);
    }
  };

  // Sync analytics snapshots from Facebook
  const syncAnalytics = async () => {
    if (!selectedAccount) {
      alert("Vui lòng chọn tài khoản để sync");
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
        const { synced, errors, rateLimitReached, retryAfter } = response.data;

        if (rateLimitReached) {
          alert(`⚠️ ${response.data.message}\nVui lòng thử lại sau ${retryAfter} giây.`);
        } else {
          alert(`✅ Sync hoàn tất!\nĐã sync: ${synced} ads\nLỗi: ${errors}`);
          setTimeout(() => {
            fetchAds();
          }, 5000);
        }
      }
    } catch (error) {
      console.error("Error syncing analytics:", error);
      const errorResponse = error.response?.data;

      if (errorResponse?.rateLimitReached) {
        alert(`⚠️ ${errorResponse.message}\nVui lòng thử lại sau ${errorResponse.retryAfter || 60} giây.`);
      } else {
        alert(`❌ Lỗi khi sync: ${errorResponse?.message || error.message}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  // Filter ads
  const filteredAds = ads.filter(ad => {
    const matchesSearch = !searchQuery ||
      ad.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ad.campaign_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ad.adset_name?.toLowerCase().includes(searchQuery.toLowerCase());

    // Map ad objective to new format for comparison
    let adObjective = ad.campaign_objective;
    if (adObjective === "LINK_CLICKS") adObjective = "OUTCOME_TRAFFIC";
    if (adObjective === "BRAND_AWARENESS" || adObjective === "REACH") adObjective = "OUTCOME_AWARENESS";
    if (adObjective === "POST_ENGAGEMENT" || adObjective === "PAGE_LIKES" || adObjective === "EVENT_RESPONSES") adObjective = "OUTCOME_ENGAGEMENT";
    if (adObjective === "LEAD_GENERATION" || adObjective === "MESSAGES") adObjective = "OUTCOME_LEADS";
    if (adObjective === "CONVERSIONS" || adObjective === "CATALOG_SALES" || adObjective === "STORE_VISITS") adObjective = "OUTCOME_SALES";
    if (adObjective === "APP_INSTALLS") adObjective = "OUTCOME_APP_PROMOTION";

    const matchesObjective = selectedObjective === "ALL" ||
      adObjective === selectedObjective;

    // ✅ THÊM: Chỉ hiển thị ads có số liệu thực tế (không phải tất cả = 0)
    const hasData = ad.spend > 0 ||
      ad.impressions > 0 ||
      ad.clicks > 0 ||
      ad.reach > 0 ||
      ad.link_clicks > 0 ||
      ad.post_engagement > 0 ||
      ad.leads > 0 ||
      ad.conversions > 0 ||
      ad.website_purchases > 0 ||
      ad.mobile_app_install > 0;

    return matchesSearch && matchesObjective && hasData;
  });

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
    { value: 'OUTCOME_AWARENESS', label: 'Awareness' },
    { value: 'OUTCOME_TRAFFIC', label: 'Traffic' },
    { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement' },
    { value: 'OUTCOME_LEADS', label: 'Leads' },
    { value: 'OUTCOME_SALES', label: 'Sales' },
    { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion' },
  ];

  // Get columns to display
  const getColumns = () => {
    const breakdownCols = BREAKDOWN_OPTIONS
      .filter(opt => selectedBreakdowns.includes(opt.key))
      .map(opt => ({ key: opt.key, label: opt.label, fixed: true }));

    // Filter data columns based on user selection
    const dataCols = ALL_DATA_COLUMNS
      .filter(col => selectedDataColumns.includes(col.key))
      .map(col => ({ key: col.key, label: col.label, format: col.format }));

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
      {!entitlementsLoading && !canUseAnalyticsChatAI && (
        <div className="analytics-entitlement-alert">
          <strong>Chatbot AI đang bị khóa.</strong> Vui lòng nâng cấp lên gói
          Chatbot AI+ để sử dụng trợ lý phân tích trong trang này.
        </div>
      )}

      <div className="analytics-header">
        <h1 className="analytics-title">Intelligent Analytics</h1>

        <div className="analytics-controls">
          {/* Account Selector */}
          <select
            className="analytics-select"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            <option value="">Select Ads Account</option>
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
            <option value="ALL">Select Objective</option>
            {AVAILABLE_OBJECTIVES.map(obj => (
              <option key={obj.value} value={obj.value}>
                {obj.label}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="analytics-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name, ID, date"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Date Range Placeholder */}
          <input
            type="text"
            className="analytics-date-input"
            placeholder="dd/mm/yyyy - dd/mm/yyyy"
            readOnly
          />

          {/* Sync Button */}
          <button
            className="analytics-refresh-btn"
            onClick={syncAnalytics}
            disabled={syncing || !selectedAccount}
            title="Sync dữ liệu từ Facebook"
          >
            <RefreshCw size={16} className={syncing ? "spinning" : ""} />
            {syncing ? " Đang sync..." : " Sync"}
          </button>
        </div>
      </div>

      <div className="analytics-main">
        <div className="analytics-table-section">
          {loading ? (
            <div className="analytics-loading">
              <RefreshCw size={32} className="spinning" />
              <p>Đang tải dữ liệu...</p>
            </div>
          ) : !selectedAccount ? (
            <div className="analytics-empty-state">
              <p>Vui lòng chọn tài khoản để xem phân tích.</p>
            </div>
          ) : selectedObjective === "ALL" ? (
            <div className="analytics-empty-state">
              <p>Vui lòng chọn Objective để xem dữ liệu.</p>
            </div>
          ) : (
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
                        Không có dữ liệu
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
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="analytics-settings">
          <div className="analytics-settings-header">
            <Settings size={18} />
            <span>Setting</span>
          </div>

          <div className="analytics-settings-tabs">
            <button
              className={`analytics-settings-tab ${activeSettingsTab === 'Breakdown' ? 'analytics-active' : ''}`}
              onClick={() => setActiveSettingsTab('Breakdown')}
            >
              Breakdown
            </button>
            <button
              className={`analytics-settings-tab ${activeSettingsTab === 'Data' ? 'analytics-active' : ''}`}
              onClick={() => setActiveSettingsTab('Data')}
            >
              Data
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
                    <span className="analytics-checkbox-text">{option.label}</span>
                  </label>
                ))}
              </div>
            )}

            {activeSettingsTab === 'Data' && (
              <div className="analytics-breakdown-options">
                {selectedObjective === "ALL" ? (
                  <div className="analytics-empty-state" style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
                    Vui lòng chọn Objective để xem các cột dữ liệu
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
                      <span className="analytics-checkbox-text">{column.label}</span>
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
