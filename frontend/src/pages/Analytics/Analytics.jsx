import { useState, useEffect, useRef, useCallback } from "react";
import { Search, ChevronDown, RefreshCw } from "lucide-react";
import DateRangePicker from "../../components/common/DateRangePicker/DateRangePicker";
import axiosInstance from "../../utils/axios";
import "./Analytics.css";

function Analytics() {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [activeTab, setActiveTab] = useState("breakdown");
  const [adAccounts, setAdAccounts] = useState([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // State cho các checkbox breakdown
  const [breakdownColumns, setBreakdownColumns] = useState({
    campaignName: true,
    adSetName: true,
    adName: true,
    pageName: true,
    adText: false,
    ageRange: false,
    campaignObjective: false,
    date: false,
  });

  const [dataMetrics, setDataMetrics] = useState({
    amountSpent: true,
    dailyBudget: false,
    dailySpendRate: false,
    totalAmountSpent: false,
    impressions: true,
    reach: true,
    frequency: false,
    audienceReachPercentage: false,
    clicks: false,
    linkClicks: false,
    linkCpc: false,
    linkCtr: false,
    cpc: false,
    cpm: false,
    ctr: false,
    conversions: false,
    conversionRate: false,
    costPerConversion: false,
    websitePurchases: false,
    websitePurchaseRoas: false,
    results: true,
    costPerResults: false,
    delivery: false,
  });

  // Mock data - sau này sẽ thay bằng API call
  const [tableData, setTableData] = useState([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Helper function để format date thành dd/MM/yyyy
  const formatDateRange = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Set date range mặc định từ đầu tháng đến ngày hiện tại
  useEffect(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultDateRange = `${formatDateRange(
      firstDayOfMonth
    )} - ${formatDateRange(today)}`;
    setDateRange(defaultDateRange);
  }, []);

  // Fetch ad accounts từ API
  useEffect(() => {
    let isMounted = true;
    const fetchAdAccounts = async () => {
      try {
        const response = await axiosInstance.get("/api/ads-accounts", {
          params: { status: "ACTIVE" }, // Chỉ lấy accounts có status ACTIVE
        });
        if (response.data?.items && isMounted) {
          // Map data từ API sang format cần thiết
          const accounts = response.data.items.map((account) => ({
            id: account._id || account.id,
            name: account.name || "Unnamed Account",
            external_id: account.external_id,
          }));
          setAdAccounts(accounts);
          // Không tự động chọn account, để người dùng tự chọn
        }
      } catch (error) {
        console.error("Error fetching ad accounts:", error);
        // Nếu có lỗi, vẫn giữ empty array
        if (isMounted) {
          setAdAccounts([]);
        }
      }
    };
    fetchAdAccounts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Helper function để parse date từ dd/MM/yyyy sang YYYY-MM-DD
  const parseDateToAPIFormat = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.trim().split("/");
    if (parts.length === 3) {
      const day = parts[0];
      const month = parts[1];
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const fetchInsights = useCallback(async () => {
    if (!selectedAccount || !dateRange) {
      setTableData([]);
      return;
    }

    setLoadingInsights(true);
    try {
      const parts = dateRange.split(" - ");
      if (parts.length !== 2) {
        setTableData([]);
        setLoadingInsights(false);
        return;
      }

      const dateStart = parseDateToAPIFormat(parts[0]);
      const dateStop = parseDateToAPIFormat(parts[1]);

      if (!dateStart || !dateStop) {
        setTableData([]);
        setLoadingInsights(false);
        return;
      }

      const response = await axiosInstance.get(
        `/api/ads-accounts/${selectedAccount}/insights`,
        {
          params: {
            breakdowns: "age",
            date_start: dateStart,
            date_stop: dateStop,
            _t: Date.now(),
          },
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );

      console.log("📊 Insights Response:", {
        total: response.data?.total,
        itemsCount: response.data?.items?.length || 0,
        items: response.data?.items,
      });

      if (response.data?.items) {
        const mappedData = response.data.items.map((item) => {
          let results = item.results || 0;
          if (results === 0 && item.actions && Array.isArray(item.actions)) {
            const purchaseAction = item.actions.find(
              (action) => action.action_type === "purchase"
            );
            results = purchaseAction ? parseFloat(purchaseAction.value) || 0 : 0;
          }

          let purchaseRoas = null;
          if (item.purchase_roas && Array.isArray(item.purchase_roas)) {
            purchaseRoas = parseFloat(item.purchase_roas[0]?.value) || null;
          } else if (item.website_purchase_roas) {
            purchaseRoas = parseFloat(item.website_purchase_roas) || null;
          }

          let linkClicks = item.link_clicks || 0;
          if (linkClicks === 0 && item.actions && Array.isArray(item.actions)) {
            const linkClickAction = item.actions.find(
              (action) => action.action_type === "link_click"
            );
            linkClicks = linkClickAction ? parseInt(linkClickAction.value) || 0 : 0;
          }

          const spend = parseFloat(item.spend) || 0;
          const impressions = parseInt(item.impressions) || 0;
          const reach = parseInt(item.reach) || 0;
          const clicks = parseInt(item.clicks) || 0;

          return {
            campaignName: item.campaign_name || "",
            adSetName: item.adset_name || "",
            adName: item.ad_name || "",
            pageName: item.page_name || "",
            adText: item.ad_creative_body || "",
            ageRange: item.age || "",
            campaignObjective: item.objective || "",
            date: item.date_start || "",
            amountSpent: spend,
            dailyBudget: item.daily_budget ? parseFloat(item.daily_budget) : null,
            dailySpendRate: item.daily_spend_rate ? parseFloat(item.daily_spend_rate) : null,
            totalAmountSpent: item.total_amount_spent ? parseFloat(item.total_amount_spent) : spend,
            impressions: impressions,
            reach: reach,
            frequency: item.frequency ? parseFloat(item.frequency) : null,
            audienceReachPercentage: item.audience_reach_percentage ? parseFloat(item.audience_reach_percentage) : null,
            clicks: clicks,
            linkClicks: linkClicks,
            linkCpc: item.link_cpc ? parseFloat(item.link_cpc) : null,
            linkCtr: item.link_ctr ? parseFloat(item.link_ctr) : null,
            cpc: item.cpc ? parseFloat(item.cpc) : null,
            cpm: item.cpm ? parseFloat(item.cpm) : null,
            ctr: item.ctr ? parseFloat(item.ctr) : null,
            conversions: item.conversions ? parseFloat(item.conversions) : 0,
            conversionRate: item.conversion_rate ? parseFloat(item.conversion_rate) : null,
            costPerConversion: item.cost_per_conversion ? parseFloat(item.cost_per_conversion) : null,
            websitePurchases: item.website_purchases ? parseFloat(item.website_purchases) : 0,
            websitePurchaseRoas: purchaseRoas,
            results: results,
            costPerResults: item.cost_per_result ? parseFloat(item.cost_per_result) : (results > 0 ? spend / results : null),
            delivery: item.delivery || "",
          };
        });
        
        console.log("📊 Final Mapped Data:", {
          total: mappedData.length,
          sample: mappedData[0],
        });
        
        setTableData(mappedData);
      } else {
        console.warn("⚠️ No items in response:", response.data);
        setTableData([]);
      }
    } catch (error) {
      console.error("Error fetching insights:", error);
      setTableData([]);
    } finally {
      setLoadingInsights(false);
    }
  }, [selectedAccount, dateRange]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleRefresh = () => {
    if (selectedAccount && dateRange) {
      fetchInsights();
    }
  };

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowAccountDropdown(false);
      }
    };

    if (showAccountDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showAccountDropdown]);

  // Handle checkbox change cho breakdown
  const handleBreakdownChange = (columnKey) => {
    setBreakdownColumns((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  };

  // Handle checkbox change cho data metrics
  const handleDataChange = (metricKey) => {
    setDataMetrics((prev) => ({
      ...prev,
      [metricKey]: !prev[metricKey],
    }));
  };

  // Mapping labels tiếng Việt
  const columnLabels = {
    // Breakdown columns
    campaignName: "Tên chiến dịch",
    adSetName: "Tên nhóm quảng cáo",
    adName: "Tên quảng cáo",
    pageName: "Tên trang",
    adText: "Nội dung quảng cáo",
    ageRange: "Độ tuổi",
    campaignObjective: "Mục tiêu chiến dịch",
    date: "Ngày",
    
    // Data metrics
    amountSpent: "Số tiền đã chi",
    dailyBudget: "Ngân sách hàng ngày",
    dailySpendRate: "Tỷ lệ chi tiêu hàng ngày (%)",
    totalAmountSpent: "Tổng số tiền đã chi",
    impressions: "Số lần hiển thị",
    reach: "Lượt tiếp cận",
    frequency: "Tần suất",
    audienceReachPercentage: "Tỷ lệ tiếp cận đối tượng (%)",
    clicks: "Số lượt nhấp",
    linkClicks: "Số lượt nhấp liên kết",
    linkCpc: "Link CPC",
    linkCtr: "Link CTR",
    cpc: "CPC",
    cpm: "CPM",
    ctr: "CTR",
    conversions: "Số chuyển đổi",
    conversionRate: "Tỷ lệ chuyển đổi (%)",
    costPerConversion: "Chi phí mỗi chuyển đổi",
    websitePurchases: "Lượt mua trên website",
    websitePurchaseRoas: "Website Purchase ROAS",
    results: "Kết quả",
    costPerResults: "Chi phí mỗi kết quả (CPA)",
    delivery: "Trạng thái phân phối",
  };

  // Tooltips cho các metrics
  const columnTooltips = {
    cpc: "Cost Per Click - Chi phí trung bình cho mỗi lượt nhấp",
    cpm: "Cost Per Mille - Chi phí cho 1,000 lần hiển thị",
    ctr: "Click-Through Rate - Tỷ lệ nhấp (số lượt nhấp / số lần hiển thị × 100%)",
    linkCpc: "Link Cost Per Click - Chi phí trung bình cho mỗi lượt nhấp vào liên kết",
    linkCtr: "Link Click-Through Rate - Tỷ lệ nhấp vào liên kết",
    conversions: "Số lượng hành động chuyển đổi (mua hàng, đăng ký, v.v.)",
    conversionRate: "Tỷ lệ chuyển đổi (số chuyển đổi / số lượt nhấp × 100%)",
    costPerConversion: "Chi phí trung bình để có được một chuyển đổi",
    websitePurchaseRoas: "Return On Ad Spend - Tỷ suất hoàn vốn từ quảng cáo cho lượt mua trên website",
    costPerResults: "Cost Per Action - Chi phí cho mỗi kết quả (hành động mục tiêu)",
    frequency: "Số lần trung bình một người xem quảng cáo của bạn",
    audienceReachPercentage: "Tỷ lệ phần trăm đối tượng mục tiêu đã tiếp cận được",
    dailySpendRate: "Tỷ lệ phần trăm ngân sách hàng ngày đã sử dụng",
  };

  // Tính toán các cột breakdown (cố định)
  const getBreakdownColumns = () => {
    const columns = [];

    if (breakdownColumns.campaignName)
      columns.push({ key: "campaignName", label: columnLabels.campaignName });
    if (breakdownColumns.adSetName)
      columns.push({ key: "adSetName", label: columnLabels.adSetName });
    if (breakdownColumns.adName)
      columns.push({ key: "adName", label: columnLabels.adName });
    if (breakdownColumns.pageName)
      columns.push({ key: "pageName", label: columnLabels.pageName });
    if (breakdownColumns.adText)
      columns.push({ key: "adText", label: columnLabels.adText });
    if (breakdownColumns.ageRange)
      columns.push({ key: "ageRange", label: columnLabels.ageRange });
    if (breakdownColumns.campaignObjective)
      columns.push({ key: "campaignObjective", label: columnLabels.campaignObjective });
    if (breakdownColumns.date) 
      columns.push({ key: "date", label: columnLabels.date });
    return columns;
  };

  const getDataMetricsColumns = () => {
    const columns = [];

    if (dataMetrics.amountSpent)
      columns.push({ key: "amountSpent", label: columnLabels.amountSpent });
    if (dataMetrics.dailyBudget)
      columns.push({ key: "dailyBudget", label: columnLabels.dailyBudget });
    if (dataMetrics.dailySpendRate)
      columns.push({ key: "dailySpendRate", label: columnLabels.dailySpendRate, tooltip: columnTooltips.dailySpendRate });
    if (dataMetrics.totalAmountSpent)
      columns.push({ key: "totalAmountSpent", label: columnLabels.totalAmountSpent });
    if (dataMetrics.impressions)
      columns.push({ key: "impressions", label: columnLabels.impressions });
    if (dataMetrics.reach) 
      columns.push({ key: "reach", label: columnLabels.reach });
    if (dataMetrics.frequency)
      columns.push({ key: "frequency", label: columnLabels.frequency, tooltip: columnTooltips.frequency });
    if (dataMetrics.audienceReachPercentage)
      columns.push({ key: "audienceReachPercentage", label: columnLabels.audienceReachPercentage, tooltip: columnTooltips.audienceReachPercentage });
    if (dataMetrics.clicks)
      columns.push({ key: "clicks", label: columnLabels.clicks });
    if (dataMetrics.linkClicks)
      columns.push({ key: "linkClicks", label: columnLabels.linkClicks });
    if (dataMetrics.linkCpc)
      columns.push({ key: "linkCpc", label: columnLabels.linkCpc, tooltip: columnTooltips.linkCpc });
    if (dataMetrics.linkCtr)
      columns.push({ key: "linkCtr", label: columnLabels.linkCtr, tooltip: columnTooltips.linkCtr });
    if (dataMetrics.cpc) 
      columns.push({ key: "cpc", label: columnLabels.cpc, tooltip: columnTooltips.cpc });
    if (dataMetrics.cpm) 
      columns.push({ key: "cpm", label: columnLabels.cpm, tooltip: columnTooltips.cpm });
    if (dataMetrics.ctr) 
      columns.push({ key: "ctr", label: columnLabels.ctr, tooltip: columnTooltips.ctr });
    if (dataMetrics.conversions)
      columns.push({ key: "conversions", label: columnLabels.conversions, tooltip: columnTooltips.conversions });
    if (dataMetrics.conversionRate)
      columns.push({ key: "conversionRate", label: columnLabels.conversionRate, tooltip: columnTooltips.conversionRate });
    if (dataMetrics.costPerConversion)
      columns.push({ key: "costPerConversion", label: columnLabels.costPerConversion, tooltip: columnTooltips.costPerConversion });
    if (dataMetrics.websitePurchases)
      columns.push({ key: "websitePurchases", label: columnLabels.websitePurchases });
    if (dataMetrics.websitePurchaseRoas)
      columns.push({ key: "websitePurchaseRoas", label: columnLabels.websitePurchaseRoas, tooltip: columnTooltips.websitePurchaseRoas });
    if (dataMetrics.results) 
      columns.push({ key: "results", label: columnLabels.results });
    if (dataMetrics.costPerResults)
      columns.push({ key: "costPerResults", label: columnLabels.costPerResults, tooltip: columnTooltips.costPerResults });
    if (dataMetrics.delivery)
      columns.push({ key: "delivery", label: columnLabels.delivery });

    return columns;
  };

  const breakdownCols = getBreakdownColumns();
  const dataMetricsCols = getDataMetricsColumns();
  const allColumns = [...breakdownCols, ...dataMetricsCols];

  return (
    <div className="analytics-container">
      {/* Header Section */}
      <div className="analytics-header">
        <h1 className="analytics-title">Phân tích quảng cáo</h1>
        <div className="analytics-header-controls">
          <div className="analytics-account-selector-wrapper" ref={dropdownRef}>
            <button
              className="analytics-account-selector"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            >
              <span>
                {selectedAccount
                  ? adAccounts.find((acc) => acc.id === selectedAccount)
                      ?.name || "Chọn tài khoản quảng cáo"
                  : "Chọn tài khoản quảng cáo"}
              </span>
              <ChevronDown size={16} />
            </button>
            {showAccountDropdown && (
              <div className="analytics-account-dropdown">
                {adAccounts.length === 0 ? (
                  <div className="analytics-dropdown-empty">
                    No accounts available
                  </div>
                ) : (
                  adAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={`analytics-dropdown-item ${
                        selectedAccount === account.id ? "analytics-active" : ""
                      }`}
                      onClick={() => {
                        setSelectedAccount(account.id);
                        setShowAccountDropdown(false);
                      }}
                    >
                      {account.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="analytics-header-right-controls">
            <button
              className="analytics-refresh-button"
              onClick={handleRefresh}
              disabled={!selectedAccount || !dateRange || loadingInsights}
              aria-label="Refresh data"
              title="Làm mới dữ liệu"
            >
              <RefreshCw 
                size={18} 
                className={loadingInsights ? "analytics-refresh-icon-spinning" : ""}
              />
            </button>
            <div className="analytics-search-box">
              <input
                type="text"
                className="analytics-search-input"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="analytics-search-button" aria-label="Search">
                <Search size={16} />
              </button>
            </div>
            <div className="analytics-date-range-wrapper">
              <DateRangePicker
                value={dateRange}
                onChange={(value) => setDateRange(value)}
                placeholder="dd/mm/yyyy - dd/mm/yyyy"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="analytics-main">
        {/* Table Section */}
        <div className="analytics-table-section">
          <div className="analytics-table-wrapper">
            <table className="analytics-table">
              <thead>
                <tr>
                  {/* Breakdown columns - cố định */}
                  {breakdownCols.map((column, index) => (
                    <th
                      key={column.key}
                      className={`analytics-breakdown-column ${
                        index === breakdownCols.length - 1
                          ? "analytics-breakdown-column-last"
                          : ""
                      }`}
                      style={{
                        left: `${index * 150}px`, // Ước tính width mỗi cột là 150px
                      }}
                    >
                      {column.label}
                    </th>
                  ))}
                  {/* Data metrics columns - có thể scroll */}
                  {dataMetricsCols.map((column) => (
                    <th
                      key={column.key}
                      className="analytics-data-metric-column"
                      title={column.tooltip || ""}
                      style={{ cursor: column.tooltip ? "help" : "default" }}
                    >
                      {column.label}
                      {column.tooltip && <span className="analytics-tooltip-icon" title={column.tooltip}>ℹ️</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingInsights ? (
                  <tr>
                    <td
                      colSpan={allColumns.length}
                      className="analytics-empty-table"
                    >
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : tableData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={allColumns.length}
                      className="analytics-empty-table"
                    >
                      {selectedAccount && dateRange
                        ? "Không có dữ liệu"
                        : "Vui lòng chọn tài khoản và khoảng thời gian"}
                    </td>
                  </tr>
                ) : (
                  tableData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {/* Breakdown columns - cố định */}
                      {breakdownCols.map((column, colIndex) => (
                        <td
                          key={column.key}
                          className={`analytics-breakdown-column ${
                            colIndex === breakdownCols.length - 1
                              ? "analytics-breakdown-column-last"
                              : ""
                          }`}
                          style={{
                            left: `${colIndex * 150}px`, // Ước tính width mỗi cột là 150px
                          }}
                        >
                          {row[column.key] || "-"}
                        </td>
                      ))}
                      {dataMetricsCols.map((column) => {
                        let displayValue = row[column.key];
                        
                        if (displayValue === null || displayValue === undefined || displayValue === "") {
                          displayValue = "-";
                        } else if (typeof displayValue === "number") {
                          if (column.key.includes("Rate") || column.key.includes("Percentage") || column.key.includes("CTR") || column.key.includes("ROAS")) {
                            displayValue = displayValue.toFixed(2) + (column.key.includes("ROAS") ? "" : "%");
                          } else if (column.key.includes("Spent") || column.key.includes("Budget") || column.key.includes("CPC") || column.key.includes("CPM") || column.key.includes("CPA") || column.key.includes("Conversion")) {
                            displayValue = displayValue.toFixed(2);
                          } else {
                            displayValue = displayValue.toLocaleString();
                          }
                        }
                        
                        return (
                          <td
                            key={column.key}
                            className="analytics-data-metric-column"
                          >
                            {displayValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="analytics-settings">
          <h2 className="analytics-settings-title">Setting</h2>

          {/* Tabs */}
          <div className="analytics-settings-tabs">
            <button
              className={`analytics-settings-tab ${
                activeTab === "breakdown" ? "analytics-active" : ""
              }`}
              onClick={() => setActiveTab("breakdown")}
            >
              Breakdown
            </button>
            <button
              className={`analytics-settings-tab ${
                activeTab === "data" ? "analytics-active" : ""
              }`}
              onClick={() => setActiveTab("data")}
            >
              Data
            </button>
          </div>

          {/* Tab Content */}
          <div className="analytics-settings-content">
            {activeTab === "breakdown" && (
              <div className="analytics-breakdown-options">
                {Object.entries(breakdownColumns).map(([key, checked]) => (
                  <label key={key} className="analytics-checkbox-label">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleBreakdownChange(key)}
                      className="analytics-checkbox-input"
                    />
                    <span className="analytics-checkbox-text">
                      {columnLabels[key]}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {activeTab === "data" && (
              <div className="analytics-data-options">
                {Object.entries(dataMetrics).map(([key, checked]) => (
                  <label 
                    key={key} 
                    className="analytics-checkbox-label"
                    title={columnTooltips[key] || ""}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleDataChange(key)}
                      className="analytics-checkbox-input"
                    />
                    <span className="analytics-checkbox-text">
                      {columnLabels[key]}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
