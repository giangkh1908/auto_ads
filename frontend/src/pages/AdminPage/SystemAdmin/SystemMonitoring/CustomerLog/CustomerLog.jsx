import { useMemo, useState, useEffect } from "react";
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
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(""); // format: "dd/mm/yyyy - dd/mm/yyyy"

  // Fetch customer logs từ API
  useEffect(() => {
    const fetchCustomerLogs = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(API_ENDPOINTS.LOGS.CUSTOMERS);

        if (response.data.success) {
          const customerLogs = response.data.data;

          // Format data để hiển thị trong table
          const formattedLogs = customerLogs.map((log) => ({
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
            timeRaw: log.time ? new Date(log.time).getTime() : 0, // Lưu timestamp để sort
            role: log.role || "N/A",
            userStatus: log.userStatus || "Active",
            event: log.event || log.description || log.action || "-",
          }));

          // Sort từ mới đến cũ (theo timeRaw)
          formattedLogs.sort((a, b) => b.timeRaw - a.timeRaw);

          setLogs(formattedLogs);
        }
      } catch (error) {
        console.error("Error fetching customer logs:", error);
        // Fallback về mock data nếu có lỗi
        setLogs(MOCK_CUSTOMER_LOGS);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerLogs();
  }, []);

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
            <label className="customer-log-filter-label">Search</label>
            <div className="customer-log-search">
              <input
                className="customer-log-search-input"
                placeholder="User, UserID, Shop name, ShopID"
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
          <label className="customer-log-filter-label">Date Range</label>
          <div className="customer-log-toolbar-right">
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder="dd/mm/yyyy - dd/mm/yyyy"
            />
          </div>
        </div>
      </div>

      <div className="customer-log-table">
        <div className="customer-log-row customer-log-header">
          <div className="customer-log-col customer-log-col-user">User</div>
          <div className="customer-log-col customer-log-col-userid">UserID</div>
          <div className="customer-log-col customer-log-col-shopname">
            Shop name
          </div>
          <div className="customer-log-col customer-log-col-shopid">ShopID</div>
          <div className="customer-log-col customer-log-col-time">Time</div>
          <div className="customer-log-col customer-log-col-role">Role</div>
          <div className="customer-log-col customer-log-col-status">
            User Status
          </div>
          <div className="customer-log-col customer-log-col-event">Event</div>
        </div>

        {loading ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            Đang tải dữ liệu...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            Không có dữ liệu
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
                  className={`customer-log-badge customer-log-badge-${log.userStatus.toLowerCase()}`}
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
