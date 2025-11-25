import { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./CustomerLog.css";
import { Search } from "lucide-react";
import axiosInstance from "../../../../../utils/axios";
import { API_ENDPOINTS } from "../../../../../config/api.config";
import DateRangePicker from "../../../../../components/common/DateRangePicker/DateRangePicker";

// Mock data demo UI – có thể thay bằng dữ liệu API sau
const MOCK_CUSTOMER_LOGS = [
  {
    id: "cl1",
    user: "Vũ Quỳnh Lan",
    userId: "56546as",
    shopName: "87s4da8sd",
    shopId: "4564ssad",
    time: "01/08/2024 10:30:45",
    role: "Marketer",
    userStatus: "Active",
    event: "",
  },
  {
    id: "cl2",
    user: "Kim Hồng Giang",
    userId: "54645as",
    shopName: "54654sasd",
    shopId: "51564sada",
    time: "22/07/2024 09:15:20",
    role: "Marketing admin",
    userStatus: "Inactive",
    event: "",
  },
  {
    id: "cl3",
    user: "Nguyễn Thành Long",
    userId: "56456as",
    shopName: "541654asd",
    shopId: "51456asd",
    time: "11/10/2024 08:20:15",
    role: "Shop Owner",
    userStatus: "Banned",
    event: "",
  },
  {
    id: "cl4",
    user: "Hà Anh Tuấn",
    userId: "54564sda",
    shopName: "51564asd",
    shopId: "54565asda",
    time: "04/09/2024 13:45:30",
    role: "Marketer",
    userStatus: "Active",
    event: "",
  },
  {
    id: "cl5",
    user: "Nguyễn Trọng Hưng",
    userId: "646asda",
    shopName: "5446asd",
    shopId: "4654asda",
    time: "19/06/2024 11:20:10",
    role: "Shop Owner",
    userStatus: "Active",
    event: "",
  },
  {
    id: "cl6",
    user: "Nguyễn Trung Kiên",
    userId: "6446asd",
    shopName: "5a4asd",
    shopId: "6a45sda",
    time: "07/05/2024 14:10:50",
    role: "Marketer",
    userStatus: "Active",
    event: "",
  },
];

export default function CustomerLog() {
  const { t, i18n } = useTranslation("admin");
  const [rawLogs, setRawLogs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(""); // format: "dd/mm/yyyy - dd/mm/yyyy"

  // Helper function để map log data với translation
  const mapLogData = useCallback((log) => {
    // Map role với translation
    const roleMap = {
      "Marketer": t("customerLog.roles.marketer"),
      "Marketing Admin": t("customerLog.roles.marketingAdmin"),
      "Marketing admin": t("customerLog.roles.marketingAdmin"),
      "Shop Owner": t("customerLog.roles.shopOwner"),
      "N/A": t("customerLog.roles.nA"),
    };

    // Map userStatus với translation
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
        ? new Date(log.time)
            .toLocaleString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
            .replace(",", "")
        : "-",
      timeRaw: log.time ? new Date(log.time).getTime() : 0,
      role: roleMap[log.role] || log.role || t("customerLog.roles.nA"),
      userStatus: statusMap[log.userStatus] || log.userStatus || t("customerLog.statuses.active"),
      userStatusKey: (log.userStatus || "Active").toLowerCase(), // Lưu status gốc để dùng cho CSS class
      event: log.event || log.description || log.action || "-",
    };
  }, [t]);

  // Fetch customer logs từ API
  useEffect(() => {
    const fetchCustomerLogs = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(API_ENDPOINTS.LOGS.CUSTOMERS);

        if (response.data.success) {
          const customerLogs = response.data.data;
          setRawLogs(customerLogs);

          // Format data để hiển thị trong table
          const formattedLogs = customerLogs.map((log) => mapLogData(log));

          // Sort từ mới đến cũ (theo timeRaw)
          formattedLogs.sort((a, b) => b.timeRaw - a.timeRaw);

          setLogs(formattedLogs);
        }
      } catch (error) {
        console.error("Error fetching customer logs:", error);
        // Fallback về mock data nếu có lỗi - map với translation
        const mappedMockLogs = MOCK_CUSTOMER_LOGS.map((log) => mapLogData(log));
        mappedMockLogs.sort((a, b) => b.timeRaw - a.timeRaw);
        setLogs(mappedMockLogs);
        setRawLogs(MOCK_CUSTOMER_LOGS);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerLogs();
  }, [mapLogData]);

  // Re-map data khi ngôn ngữ thay đổi
  useEffect(() => {
    if (rawLogs.length > 0) {
      const formattedLogs = rawLogs.map((log) => mapLogData(log));
      // Sort từ mới đến cũ (theo timeRaw)
      formattedLogs.sort((a, b) => b.timeRaw - a.timeRaw);
      setLogs(formattedLogs);
    }
  }, [i18n.language, rawLogs, mapLogData]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const filteredLogs = logs.filter((log) => {
      // Search theo user, userId, shopName, shopId
      const matchSearch =
        !s ||
        log.user.toLowerCase().includes(s) ||
        log.userId.toLowerCase().includes(s) ||
        log.shopName.toLowerCase().includes(s) ||
        log.shopId.toLowerCase().includes(s);

      // Lọc theo khoảng ngày
      let matchDate = true;
      if (dateRange.includes("-")) {
        const [from, to] = dateRange.split("-").map((v) => v.trim());
        // Định dạng: dd/mm/yyyy
        const parse = (d) => {
          const [dd, mm, yyyy] = d.split("/").map((x) => parseInt(x));
          if (!dd || !mm || !yyyy) return null;
          return new Date(yyyy, mm - 1, dd).getTime();
        };
        const fromTs = parse(from);
        const toTs = parse(to);
        if (fromTs || toTs) {
          // So sánh với time (lấy phần ngày)
          const logDate = log.time.split(" ")[0];
          const logTs = parse(logDate);
          if (logTs) {
            if (fromTs && logTs < fromTs) matchDate = false;
            if (toTs && logTs > toTs) matchDate = false;
          }
        }
      }
      return matchSearch && matchDate;
    });

    // Sort lại từ mới đến cũ sau khi filter
    return filteredLogs.sort((a, b) => (b.timeRaw || 0) - (a.timeRaw || 0));
  }, [search, dateRange, logs]);

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
              <span className="customer-log-search-icon">
                <Search size={16} />
              </span>
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
          <div className="customer-log-col customer-log-col-shopname">
            {t("customerLog.columns.shopName")}
          </div>
          <div className="customer-log-col customer-log-col-shopid">{t("customerLog.columns.shopId")}</div>
          <div className="customer-log-col customer-log-col-time">{t("customerLog.columns.time")}</div>
          <div className="customer-log-col customer-log-col-role">{t("customerLog.columns.role")}</div>
          <div className="customer-log-col customer-log-col-status">
            {t("customerLog.columns.userStatus")}
          </div>
          <div className="customer-log-col customer-log-col-event">{t("customerLog.columns.event")}</div>
        </div>

        {loading ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            {t("customerLog.messages.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            {t("customerLog.messages.noData")}
          </div>
        ) : (
          filtered.map((log) => (
            <div className="customer-log-row" key={log.id}>
              <div className="customer-log-col customer-log-col-user">
                {log.user}
              </div>
              <div className="customer-log-col customer-log-col-userid">
                {log.userId}
              </div>
              <div className="customer-log-col customer-log-col-shopname">
                {log.shopName}
              </div>
              <div className="customer-log-col customer-log-col-shopid">
                {log.shopId}
              </div>
              <div className="customer-log-col customer-log-col-time">
                {log.time}
              </div>
              <div className="customer-log-col customer-log-col-role">
                {log.role}
              </div>
              <div className="customer-log-col customer-log-col-status">
                <span
                  className={`customer-log-badge customer-log-badge-${log.userStatusKey || "active"}`}
                >
                  {log.userStatus}
                </span>
              </div>
              <div className="customer-log-col customer-log-col-event">
                {log.event || "-"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
