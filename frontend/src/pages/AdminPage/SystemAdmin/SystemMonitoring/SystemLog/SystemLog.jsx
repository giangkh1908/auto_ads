import {useState, useEffect, useRef } from "react";
import "./SystemLog.css";
import { Search, ChevronDown } from "lucide-react";
import DateRangePicker from "../../../../../components/common/DateRangePicker/DateRangePicker";
import { getSystemLogs } from "../../../../../services/systemLogService.js";

const ROLES = ["All", "System Admin", "CS Staff", "Accountant", "System"];

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
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [dateRange, setDateRange] = useState("");
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
          role: roleFilter,
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
          setError(response.message || "Có lỗi xảy ra khi lấy system logs");
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching system logs:", err);
        setError(
          err.message || "Có lỗi xảy ra khi lấy system logs. Vui lòng thử lại."
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
            <label className="system-log-filter-label">Search</label>
            <div className="system-log-search">
              <input
                className="system-log-search-input"
                placeholder="Name, Phone, Email"
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
            <label className="system-log-filter-label">Role</label>
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
            <label className="system-log-filter-label">Date Range</label>
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              placeholder="dd/mm/yyyy - dd/mm/yyyy"
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
          Đang tải...
        </div>
      )}

      {/* Logs table */}
      <div className="system-log-table">
        <div className="system-log-row system-log-header">
          <div className="system-log-col system-log-col-user">User</div>
          <div className="system-log-col system-log-col-role">Role</div>
          <div className="system-log-col system-log-col-time">Time</div>
          <div className="system-log-col system-log-col-event">Event</div>
        </div>

        {!loading && logs.length === 0 && !error && (
          <div style={{ padding: "16px", textAlign: "center", color: "#666" }}>
            Không có log nào
          </div>
        )}

        {!loading &&
          logs.map((log) => (
            <div className="system-log-row" key={log._id}>
              <div className="system-log-col system-log-col-user">
                {log.user || "Hệ thống"}
              </div>
              <div className="system-log-col system-log-col-role">
                {log.role || "System"}
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
            Hiển thị {logs.length} / {pagination.total} logs
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
              Trước
            </button>
            <span style={{ padding: "8px 16px" }}>
              Trang {pagination.page} / {pagination.totalPages}
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
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}