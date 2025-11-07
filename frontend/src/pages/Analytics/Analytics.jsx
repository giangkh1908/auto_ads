import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, RefreshCw } from "lucide-react";
import axiosInstance from "../../utils/axios";
import { getAdPerformance, refreshAdPerformance, getAdPerformanceStats } from "../../services/adPerformanceService";
import { useToast } from "../../hooks/useToast";
import DateRangePicker from "../../components/common/DateRangePicker/DateRangePicker";
import "./Analytics.css";

function Analytics() {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [activeTab, setActiveTab] = useState("breakdown");
  const [adAccounts, setAdAccounts] = useState([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const toast = useToast();
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

  // State cho các checkbox data metrics
  const [dataMetrics, setDataMetrics] = useState({
    amountSpent: true,
    impressions: true,
    reach: true,
    results: true,
    costPerResults: false,
    delivery: false,
    frequency: false,
    linkClicks: false,
    cpc: false,
    cpm: false,
    ctr: false,
    resultsRoas: false,
  });

  const [tableData, setTableData] = useState([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [refreshing, setRefreshing] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [stats, setStats] = useState(null);

  // Helper function để format date thành dd/MM/yyyy
  const formatDateRange = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Helper function để parse date từ dd/MM/yyyy sang YYYY-MM-DD
  const parseDateToAPIFormat = (dateString) => {
    if (!dateString) return null;
    const [start, end] = dateString.split(" - ");
    const parseDate = (str) => {
      const [day, month, year] = str.trim().split("/");
      return `${year}-${month}-${day}`;
    };
    return {
      dateFrom: parseDate(start),
      dateTo: end ? parseDate(end) : parseDate(start)
    };
  };

  // Set date range mặc định từ đầu tháng đến ngày hiện tại
  useEffect(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultDateRange = `${formatDateRange(firstDayOfMonth)} - ${formatDateRange(today)}`;
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

  // 🔹 THAY ĐỔI: Fetch insights data từ DATABASE
  useEffect(() => {
    if (selectedAccount && dateRange) {
      fetchPerformanceFromDB();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount, dateRange]);

  const fetchPerformanceFromDB = async () => {
    try {
      setLoadingInsights(true);
      
      const dates = parseDateToAPIFormat(dateRange);
      const selectedAccountData = adAccounts.find(acc => acc.id === selectedAccount);
      const filterParams = {
        account_id: selectedAccountData?.external_id || selectedAccount,
        dateFrom: dates?.dateFrom,
        dateTo: dates?.dateTo
      };

      // 🔹 Lấy data từ DATABASE thay vì Facebook API
      const [performanceRes, statsRes] = await Promise.all([
        getAdPerformance(filterParams),
        getAdPerformanceStats(filterParams)
      ]);

      // Transform data để hiển thị
      const transformedData = performanceRes.data.map(item => ({
        campaignName: item.campaign_name || "",
        adSetName: item.adset_name || "",
        adName: item.ad_name || "",
        pageName: item.page_name || "",
        adText: item.ad_text || "",
        ageRange: item.age_range || "",
        campaignObjective: item.campaign_objective || "",
        date: new Date(item.date).toLocaleDateString('vi-VN'),
        amountSpent: item.spend || 0,
        impressions: item.impressions || 0,
        reach: item.reach || 0,
        results: item.results || 0,
        costPerResults: item.cost_per_result || null,
        delivery: item.delivery || "",
        frequency: item.frequency || null,
        linkClicks: item.link_clicks || 0,
        cpc: item.cpc || null,
        cpm: item.cpm || null,
        ctr: item.ctr || null,
        resultsRoas: item.results_roas || null,
      }));

      setTableData(transformedData);
      setStats(statsRes.data);
      
      toast.success("Data loaded from database successfully");
    } catch (error) {
      console.error("Error fetching performance data:", error);
      toast.error("Error loading analytics data");
    } finally {
      setLoadingInsights(false);
    }
  };

  // 🔹 NÚT REFRESH: Lấy từ Facebook và cập nhật database
  const handleRefresh = async () => {
    if (!selectedAccount) {
      toast.error("Vui lòng chọn tài khoản quảng cáo");
      return;
    }
    
    try {
      setRefreshing(true);
      toast.info("Đang đồng bộ dữ liệu từ Facebook...");
      
      const selectedAccountData = adAccounts.find(acc => acc.id === selectedAccount);
      await refreshAdPerformance(selectedAccountData?.external_id || selectedAccount);
      
      toast.success("Đồng bộ dữ liệu thành công");
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await fetchPerformanceFromDB();
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error("Lỗi khi đồng bộ dữ liệu từ Facebook");
    } finally {
      setRefreshing(false);
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
    setBreakdownColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  // Handle checkbox change cho data metrics
  const handleDataChange = (metricKey) => {
    setDataMetrics(prev => ({
      ...prev,
      [metricKey]: !prev[metricKey]
    }));
  };

  // Tính toán các cột breakdown (cố định)
  const getBreakdownColumns = () => {
    const columns = [];
    if (breakdownColumns.campaignName) columns.push({ key: "campaignName", label: "Campaign Name" });
    if (breakdownColumns.adSetName) columns.push({ key: "adSetName", label: "Ad Set Name" });
    if (breakdownColumns.adName) columns.push({ key: "adName", label: "Ad Name" });
    if (breakdownColumns.pageName) columns.push({ key: "pageName", label: "Page Name" });
    if (breakdownColumns.adText) columns.push({ key: "adText", label: "Ad Text" });
    if (breakdownColumns.ageRange) columns.push({ key: "ageRange", label: "Age Range" });
    if (breakdownColumns.campaignObjective) columns.push({ key: "campaignObjective", label: "Campaign Objective" });
    if (breakdownColumns.date) columns.push({ key: "date", label: "Date" });
    return columns;
  };

  // Tính toán các cột data metrics (có thể scroll)
  const getDataMetricsColumns = () => {
    const columns = [];

    if (dataMetrics.amountSpent)
      columns.push({ key: "amountSpent", label: "Amount Spent" });
    if (dataMetrics.impressions)
      columns.push({ key: "impressions", label: "Impressions" });
    if (dataMetrics.reach) columns.push({ key: "reach", label: "Reach" });
    if (dataMetrics.results) columns.push({ key: "results", label: "Results" });
    if (dataMetrics.costPerResults)
      columns.push({ key: "costPerResults", label: "Cost per Results (CPR)" });
    if (dataMetrics.delivery)
      columns.push({ key: "delivery", label: "Delivery" });
    if (dataMetrics.frequency)
      columns.push({ key: "frequency", label: "Frequency" });
    if (dataMetrics.linkClicks)
      columns.push({ key: "linkClicks", label: "Link Clicks" });
    if (dataMetrics.cpc) columns.push({ key: "cpc", label: "CPC" });
    if (dataMetrics.cpm) columns.push({ key: "cpm", label: "CPM" });
    if (dataMetrics.ctr) columns.push({ key: "ctr", label: "CTR" });
    if (dataMetrics.resultsRoas)
      columns.push({ key: "resultsRoas", label: "Results ROAS" });

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
              disabled={refreshing || !selectedAccount}
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={16} className={refreshing ? "spinning" : ""} />
              {refreshing ? "Đang đồng bộ..." : "Làm mới"}
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
                    >
                      {column.label}
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
                      {/* Data metrics columns - có thể scroll */}
                      {dataMetricsCols.map((column) => (
                        <td
                          key={column.key}
                          className="analytics-data-metric-column"
                        >
                          {row[column.key] || "-"}
                        </td>
                      ))}
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
                {Object.entries(breakdownColumns).map(([key, checked]) => {
                  const labels = {
                    campaignName: "Campaign Name",
                    adSetName: "Ad Set Name",
                    adName: "Ad Name",
                    pageName: "Page Name",
                    adText: "Ad Text",
                    ageRange: "Age Range",
                    campaignObjective: "Campaign Objective",
                    date: "Date",
                  };

                  return (
                    <label key={key} className="analytics-checkbox-label">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleBreakdownChange(key)}
                        className="analytics-checkbox-input"
                      />
                      <span className="analytics-checkbox-text">
                        {labels[key]}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {activeTab === "data" && (
              <div className="analytics-data-options">
                {Object.entries(dataMetrics).map(([key, checked]) => {
                  const labels = {
                    amountSpent: "Amount Spent",
                    impressions: "Impressions",
                    reach: "Reach",
                    results: "Results",
                    costPerResults: "Cost per Results (CPR)",
                    delivery: "Delivery",
                    frequency: "Frequency",
                    linkClicks: "Link Clicks",
                    cpc: "CPC",
                    cpm: "CPM",
                    ctr: "CTR",
                    resultsRoas: "Results ROAS",
                  };

                  return (
                    <label key={key} className="analytics-checkbox-label">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleDataChange(key)}
                        className="analytics-checkbox-input"
                      />
                      <span className="analytics-checkbox-text">
                        {labels[key]}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
