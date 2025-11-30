import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./CustomerLog.css";
import { Search } from "lucide-react";
import axiosInstance from "../../../../../utils/axios";
import { API_ENDPOINTS } from "../../../../../config/api.config";
import DateRangePicker from "../../../../../components/common/DateRangePicker/DateRangePicker";

// Mock data demo UI – fallback if API fails
const MOCK_CUSTOMER_LOGS = [
  // optional mock entries
];

export default function CustomerLog() {
  const { t, i18n } = useTranslation("admin");
  const [rawLogs, setRawLogs] = useState([]); // original objects (for last id)
  const [logs, setLogs] = useState([]); // mapped/formatted objects for UI
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState(""); // "dd/mm/yyyy - dd/mm/yyyy"
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    const tId = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(tId);
  }, [search]);

  // Map server log item to UI-ready object
  const mapLogData = useCallback((log) => {
    const roleMap = {
      "Marketer": t("customerLog.roles.marketer"),
      "Marketing Admin": t("customerLog.roles.marketingAdmin"),
      "Marketing admin": t("customerLog.roles.marketingAdmin"),
      "Shop Owner": t("customerLog.roles.shopOwner"),
      "N/A": t("customerLog.roles.nA"),
    };
    const statusMap = {
      "Active": t("customerLog.statuses.active"),
      "Inactive": t("customerLog.statuses.inactive"),
      "Banned": t("customerLog.statuses.banned"),
    };

    return {
      id: log._id || log.id,
      user: log.user || "N/A",
      userId: log.userId || "N/A",
      shopName: log.shopName || "N/A",
      shopId: log.shopId || "N/A",
      time: log.time
        ? new Date(log.time).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).replace(",", "")
        : "-",
      timeRaw: log.time ? new Date(log.time).getTime() : 0,
      role: roleMap[log.role] || log.role || t("customerLog.roles.nA"),
      userStatus: statusMap[log.userStatus] || log.userStatus || t("customerLog.statuses.active"),
      userStatusKey: (log.userStatus || "Active").toLowerCase(),
      event: log.event || log.description || log.action || "-",
    };
  }, [t]);

  // Fetch logs from API. If lastId is provided, backend returns next batch.
  const fetchLogs = useCallback(async (lastId = null, append = true) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);

      const params = {
        lastLogId: lastId || undefined,
        limit,
        search: debouncedSearch || undefined,
        startDate: dateRange.split("-")[0]?.trim() || undefined,
        endDate: dateRange.split("-")[1]?.trim() || undefined,
      };

      const res = await axiosInstance.get(API_ENDPOINTS.LOGS.CUSTOMERS, { params });
      if (res.data && res.data.success) {
        const items = res.data.data || [];
        setRawLogs(prev => (append ? [...prev, ...items] : items));
        setLogs(prev => (append ? [...prev, ...items.map(mapLogData)] : items.map(mapLogData)));
        setHasMore(items.length === limit);
      } else {
        // if API returns success=false, treat as no data
        if (!append) {
          setRawLogs([]);
          setLogs([]);
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error("Error fetching customer logs:", err);
      if (!append) {
        const fall = MOCK_CUSTOMER_LOGS.map(mapLogData);
        setRawLogs(MOCK_CUSTOMER_LOGS);
        setLogs(fall);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, dateRange, limit, mapLogData]);

  // Initial load / reload when search or dateRange changes
  useEffect(() => {
    setRawLogs([]);
    setLogs([]);
    setHasMore(true);
    fetchLogs(null, false);
  }, [debouncedSearch, dateRange, fetchLogs]);

  // Remap when language changes
  useEffect(() => {
    if (rawLogs.length > 0) {
      setLogs(rawLogs.map(mapLogData));
    }
  }, [i18n.language, rawLogs, mapLogData]);

  // IntersectionObserver to load more
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          const last = rawLogs[rawLogs.length - 1];
          const lastId = last ? (last._id || last.id) : null;
          fetchLogs(lastId, true);
        }
      });
    }, { root: null, rootMargin: '200px', threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [rawLogs, hasMore, loadingMore, loading, fetchLogs]);

  return (
    <div className="customer-log">
      <div className="customer-log-toolbar">
        <div className="customer-log-toolbar-left">
          <div className="customer-log-filter-group">
            <label className="customer-log-filter-label">{t("customerLog.search")}</label>
            <div className="customer-log-search">
              <input
                className="customer-log-search-input"
                placeholder={t("customerLog.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="customer-log-search-icon"><Search size={16} /></span>
            </div>
          </div>
        </div>
        <div className="customer-log-filter-group">
          <label className="customer-log-filter-label">{t("customerLog.dateRange")}</label>
          <div className="customer-log-toolbar-right">
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder={t("customerLog.dateRangePlaceholder")}
            />
          </div>
        </div>
      </div>

      <div className="customer-log-table">
        <div className="customer-log-row customer-log-header">
          <div className="customer-log-col customer-log-col-user">{t("customerLog.columns.user")}</div>
          <div className="customer-log-col customer-log-col-userid">{t("customerLog.columns.userId")}</div>
          <div className="customer-log-col customer-log-col-shopname">{t("customerLog.columns.shopName")}</div>
          <div className="customer-log-col customer-log-col-shopid">{t("customerLog.columns.shopId")}</div>
          <div className="customer-log-col customer-log-col-time">{t("customerLog.columns.time")}</div>
          <div className="customer-log-col customer-log-col-role">{t("customerLog.columns.role")}</div>
          <div className="customer-log-col customer-log-col-status">{t("customerLog.columns.userStatus")}</div>
          <div className="customer-log-col customer-log-col-event">{t("customerLog.columns.event")}</div>
        </div>

        {loading && logs.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center" }}>{t("customerLog.messages.loading")}</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center" }}>{t("customerLog.messages.noData")}</div>
        ) : (
          logs.map((log) => (
            <div className="customer-log-row" key={log.id}>
              <div className="customer-log-col customer-log-col-user">{log.user}</div>
              <div className="customer-log-col customer-log-col-userid">{log.userId}</div>
              <div className="customer-log-col customer-log-col-shopname">{log.shopName}</div>
              <div className="customer-log-col customer-log-col-shopid">{log.shopId}</div>
              <div className="customer-log-col customer-log-col-time">{log.time}</div>
              <div className="customer-log-col customer-log-col-role">{log.role}</div>
              <div className="customer-log-col customer-log-col-status"><span className={`customer-log-badge customer-log-badge-${log.userStatusKey || "active"}`}>{log.userStatus}</span></div>
              <div className="customer-log-col customer-log-col-event">{log.event || "-"}</div>
            </div>
          ))
        )}

        {/* sentinel to trigger loading more */}
        <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />

        {loadingMore && <div style={{ padding: "8px 0", textAlign: "center" }}>{t("customerLog.messages.loadingMore") || "Loading..."}</div>}
        {!hasMore && logs.length > 0 && <div style={{ padding: "8px 0", textAlign: "center", color: "var(--muted)" }}>{t("customerLog.messages.noMore") || "No more logs"}</div>}
      </div>
    </div>
  );
}