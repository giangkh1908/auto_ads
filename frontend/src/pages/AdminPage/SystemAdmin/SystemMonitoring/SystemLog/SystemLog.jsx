import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./SystemLog.css";
import { Search, ChevronDown } from "lucide-react";
import DateRangePicker from "../../../../../components/common/DateRangePicker/DateRangePicker";
import { getSystemLogs } from "../../../../../services/systemLogService.js";

/**
 * Format date from ISO string to "dd/mm/yyyy HH:mm:ss"
 */
const formatDateTime = (dateString) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};

/**
 * Debounce function
 */
// const debounce = (func, wait) => {
//   let timeout;
//   return function executedFunction(...args) {
//     const later = () => {
//       clearTimeout(timeout);
//       func(...args);
//     };
//     clearTimeout(timeout);
//     timeout = setTimeout(later, wait);
//   };
// };

export default function SystemLog() {
  const { t, i18n } = useTranslation("admin");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(t("systemLog.roles.all"));
  const [dateRange, setDateRange] = useState("");

  const ROLES = useMemo(() => [
    t("systemLog.roles.all"),
    t("systemLog.roles.systemAdmin"),
    t("systemLog.roles.csStaff"),
    t("systemLog.roles.accountant"),
    t("systemLog.roles.system")
  ], [t]);

  // Reset filter khi đổi ngôn ngữ
  useEffect(() => {
    setRoleFilter(t("systemLog.roles.all"));
  }, [i18n.language, t]);

  // Convert translated roleFilter back to original value for API
  const getOriginalRole = useCallback((translatedRole) => {
    const roleMap = {
      [t("systemLog.roles.all")]: "All",
      [t("systemLog.roles.systemAdmin")]: "System Admin",
      [t("systemLog.roles.csStaff")]: "CS Staff",
      [t("systemLog.roles.accountant")]: "Accountant",
      [t("systemLog.roles.system")]: "System",
    };
    return roleMap[translatedRole] || translatedRole;
  }, [t]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0,
  });

  // Debounced search ref to track search changes
  const searchTimeoutRef = useRef(null);

  // Update debounced search value
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    const timeoutId = setTimeout(() => {
      setDebouncedSearch((prevDebounced) => {
        // Only update if value actually changed
        if (prevDebounced !== search) {
          // Reset to page 1 when search changes
          setPagination((prev) => {
            if (prev.page !== 1) {
              return { ...prev, page: 1 };
            }
            return prev;
          });
          return search;
        }
        return prevDebounced;
      });
    }, 500);
    searchTimeoutRef.current = timeoutId;

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  // Main effect to fetch logs - only one API call
  useEffect(() => {
    let isMounted = true;

    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getSystemLogs({
          role: getOriginalRole(roleFilter),
          search: debouncedSearch.trim(),
          dateRange,
          page: pagination.page,
          limit: pagination.limit,
        });

        if (!isMounted) return;

        if (response.success) {
          setLogs(response.data || []);
          setPagination((prev) => ({
            ...prev,
            total: response.pagination?.total || 0,
            totalPages: response.pagination?.totalPages || 0,
          }));
        } else {
          setError(response.message || t("systemLog.messages.error"));
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching system logs:", err);
        setError(
          err.message || t("systemLog.messages.error")
        );
        setLogs([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLogs();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [
    roleFilter,
    dateRange,
    pagination.page,
    pagination.limit,
    debouncedSearch, // Use debounced search state
    getOriginalRole, // Add getOriginalRole to dependencies
    t, // Add t to dependencies
  ]);

  // Handle search change
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  // Handle role filter change
  const handleRoleChange = (e) => {
    setRoleFilter(e.target.value);
    setPagination((prev) => {
      if (prev.page !== 1) {
        return { ...prev, page: 1 };
      }
      return prev;
    });
  };

  // Handle date range change
  const handleDateRangeChange = (value) => {
    setDateRange(value);
    setPagination((prev) => {
      if (prev.page !== 1) {
        return { ...prev, page: 1 };
      }
      return prev;
    });
  };

  return (
    <div className="system-log">
      <div className="system-log-toolbar">
        <div className="system-log-toolbar-left">
          <div className="system-log-filter-group">
            <label className="system-log-filter-label">{t("systemLog.search")}</label>
            <div className="system-log-search">
              <input
                className="system-log-search-input"
                placeholder={t("systemLog.searchPlaceholder")}
                value={search}
                onChange={handleSearchChange}
                disabled={loading}
              />
              <span className="system-log-search-icon">
                <Search size={16} />
              </span>
            </div>
          </div>
          <div className="system-log-filter-group">
            <label className="system-log-filter-label">{t("systemLog.role")}</label>
            <div className="system-log-select-wrapper">
              <select
                className="system-log-role-select"
                value={roleFilter}
                onChange={handleRoleChange}
                disabled={loading}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="system-log-select-icon" />
            </div>
          </div>

          <div className="system-log-filter-group">
            <label className="system-log-filter-label">{t("systemLog.dateRange")}</label>
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              placeholder={t("systemLog.dateRangePlaceholder")}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="system-log-error" style={{ padding: "16px", color: "red", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="system-log-loading" style={{ padding: "16px", textAlign: "center" }}>
          {t("systemLog.messages.loading")}
        </div>
      )}

      {/* Logs table */}
      <div className="system-log-table">
        <div className="system-log-row system-log-header">
          <div className="system-log-col system-log-col-user">{t("systemLog.columns.user")}</div>
          <div className="system-log-col system-log-col-role">{t("systemLog.columns.role")}</div>
          <div className="system-log-col system-log-col-time">{t("systemLog.columns.time")}</div>
          <div className="system-log-col system-log-col-event">{t("systemLog.columns.event")}</div>
        </div>

        {!loading && logs.length === 0 && !error && (
          <div style={{ padding: "16px", textAlign: "center", color: "#666" }}>
            {t("systemLog.messages.noData")}
          </div>
        )}

        {!loading &&
          logs.map((log) => (
            <div className="system-log-row" key={log._id}>
              <div className="system-log-col system-log-col-user">
                {log.user || t("systemLog.system.system")}
              </div>
              <div className="system-log-col system-log-col-role">
                {log.role || t("systemLog.system.system")}
              </div>
              <div className="system-log-col system-log-col-time">
                {formatDateTime(log.time)}
              </div>
              <div className="system-log-col system-log-col-event">
                {log.event || "-"}
              </div>
            </div>
          ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div
          className="system-log-pagination"
          style={{
            padding: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            {t("systemLog.pagination.showing")} {logs.length} {t("systemLog.pagination.of")} {pagination.total} {t("systemLog.pagination.logs")}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              disabled={pagination.page === 1 || loading}
              style={{
                padding: "8px 16px",
                cursor: pagination.page === 1 || loading ? "not-allowed" : "pointer",
                opacity: pagination.page === 1 || loading ? 0.5 : 1,
              }}
            >
              {t("systemLog.pagination.previous")}
            </button>
            <span style={{ padding: "8px 16px" }}>
              {t("systemLog.pagination.page")} {pagination.page} {t("systemLog.pagination.of")} {pagination.totalPages}
            </span>
            <button
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              disabled={pagination.page >= pagination.totalPages || loading}
              style={{
                padding: "8px 16px",
                cursor:
                  pagination.page >= pagination.totalPages || loading
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  pagination.page >= pagination.totalPages || loading ? 0.5 : 1,
              }}
            >
              {t("systemLog.pagination.next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}