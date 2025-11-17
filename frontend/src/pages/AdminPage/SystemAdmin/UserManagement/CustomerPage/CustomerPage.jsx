import { useMemo, useState, useEffect } from "react";
import "./CustomerPage.css";
import { Play, Pause, Ban, Undo, ChevronDown, Search, Eye } from "lucide-react";
import ConfirmationPopup from "../../../../../components/common/ConfirmationPopup/ConfirmationPopup";
import ViewDetails from "./ViewShop";
import CustomerUpdate from "./CustomerUpdate";
import axiosInstance from "../../../../../utils/axios";
import { API_ENDPOINTS } from "../../../../../config/api.config";
import DateRangePicker from "../../../../../components/common/DateRangePicker/DateRangePicker";
import {
  getEntityId,
} from "../../../../../utils/noteUtils";

const STATUSES = ["All", "Active", "Inactive", "Banned"];

export default function CustomerPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [dateRange, setDateRange] = useState(""); // demo input text "dd/mm/yyyy - dd/mm/yyyy"
  const [confirmationPopup, setConfirmationPopup] = useState({
    isOpen: false,
    type: "delete",
    title: "",
    message: "",
    onConfirm: null,
    isLoading: false,
  });
  const [viewDetailsPopup, setViewDetailsPopup] = useState({
    isOpen: false,
    userId: null,
    userName: "",
  });
  const [updatePopup, setUpdatePopup] = useState({
    isOpen: false,
    userId: null,
  });

  // Fetch customers từ API
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(API_ENDPOINTS.USERS.CUSTOMERS);

        if (response.data.success) {
          const customers = response.data.data;

          // Format data để hiển thị trong table
          const formattedCustomers = customers.map((customer) => ({
            id: getEntityId(customer),
            name: customer.full_name || "N/A",
            phone: customer.phone || "-",
            email: customer.email || "-",
            shop: "View", // Sẽ cần lấy shop info từ shop_id nếu có
            createdAt: customer.created_at
              ? new Date(customer.created_at)
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
            lastLogin: customer.last_login_at
              ? new Date(customer.last_login_at)
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
            status:
              customer.status === "active"
                ? "Active"
                : customer.status === "inactive"
                ? "Inactive"
                : customer.status === "banned"
                ? "Banned"
                : "Inactive",
          }));

          setRows(formattedCustomers);
        }
      } catch (error) {
        console.error("Error fetching customers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((c) => {
      // Search theo name/phone/email
      const matchSearch =
        !s ||
        c.name.toLowerCase().includes(s) ||
        (c.phone || "").toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s);
      // Lọc theo status
      const matchStatus = status === "All" ? true : c.status === status;
      // Lọc theo khoảng ngày đơn giản (demo – cần thay bằng parser thật khi tích hợp)
      let matchDate = true;
      if (dateRange.includes("-")) {
        const [from, to] = dateRange.split("-").map((v) => v.trim());
        // Định dạng demo: dd/mm/yyyy
        const parse = (d) => {
          const [dd, mm, yyyy] = d.split("/").map((x) => parseInt(x));
          if (!dd || !mm || !yyyy) return null;
          return new Date(yyyy, mm - 1, dd).getTime();
        };
        const fromTs = parse(from);
        const toTs = parse(to);
        if (fromTs || toTs) {
          // So sánh với createdAt (lấy phần ngày)
          const createdDate = c.createdAt.split(" ")[0];
          const createdTs = parse(createdDate);
          if (createdTs) {
            if (fromTs && createdTs < fromTs) matchDate = false;
            if (toTs && createdTs > toTs) matchDate = false;
          }
        }
      }
      return matchSearch && matchStatus && matchDate;
    });
  }, [search, status, dateRange, rows]);

  const counters = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((c) => c.status === "Active").length;
    const inactive = filtered.filter((c) => c.status === "Inactive").length;
    const banned = filtered.filter((c) => c.status === "Banned").length;
    return { total, active, inactive, banned };
  }, [filtered]);

  const handleAction = async (row, type) => {
    // Set loading state
    setConfirmationPopup((prev) => ({ ...prev, isLoading: true }));

    try {
      // Map action type sang status tương ứng
      let newStatus;
      switch (type) {
        case "Activate":
          newStatus = "active";
          break;
        case "Deactivate":
          newStatus = "inactive";
          break;
        case "Ban":
          newStatus = "banned";
          break;
        case "Unban":
          newStatus = "active"; // Sau khi gỡ ban → chuyển về Active
          break;
        default:
          throw new Error("Invalid action type");
      }

      // Gọi API để cập nhật status
      const response = await axiosInstance.put(
        API_ENDPOINTS.USERS.UPDATE(row.id),
        {
          status: newStatus,
        }
      );

      if (response.data.success) {
        // Đồng bộ status trong UI
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== row.id) return r;
            // Map status từ DB (active/inactive/banned) sang UI format (Active/Inactive/Banned)
            const statusMap = {
              active: "Active",
              inactive: "Inactive",
              banned: "Banned",
            };
            return { ...r, status: statusMap[newStatus] || "Inactive" };
          })
        );

        // Đóng popup sau khi thành công
        setConfirmationPopup({
          isOpen: false,
          type: "delete",
          title: "",
          message: "",
          onConfirm: null,
          isLoading: false,
        });
      } else {
        throw new Error(
          response.data.message || "Có lỗi xảy ra khi cập nhật status"
        );
      }
    } catch (error) {
      console.error("Error updating user status:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Có lỗi xảy ra khi cập nhật status";
      alert(errorMessage); // TODO: Thay bằng toast notification
      setConfirmationPopup((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const showConfirmDialog = (row, actionType) => {
    const actionConfig = {
      Activate: {
        type: "activate",
        title: "Xác nhận kích hoạt",
        message: `Bạn có chắc muốn kích hoạt tài khoản "${row.name}"?`,
      },
      Deactivate: {
        type: "deactivate",
        title: "Xác nhận vô hiệu hóa",
        message: `Bạn có chắc muốn vô hiệu hóa tài khoản "${row.name}"?`,
      },
      Ban: {
        type: "ban",
        title: "Xác nhận cấm",
        message: `Bạn có chắc muốn cấm tài khoản "${row.name}"?`,
      },
      Unban: {
        type: "unban",
        title: "Xác nhận gỡ cấm",
        message: `Bạn có chắc muốn gỡ cấm tài khoản "${row.name}"? Tài khoản sẽ được kích hoạt lại.`,
      },
    };

    const config = actionConfig[actionType];
    if (!config) return;

    setConfirmationPopup({
      isOpen: true,
      type: config.type,
      title: config.title,
      message: config.message,
      onConfirm: () => handleAction(row, actionType),
      isLoading: false,
    });
  };

  return (
    <div className="amu-customer">
      <div className="amu-toolbar">
        <div className="amu-toolbar-left">
          <div className="amu-filter-group">
            <label className="amu-filter-label">Search</label>
            <div className="amu-search">
              <input
                className="amu-search-input"
                placeholder="Name, Phone, Email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="amu-search-icon">
                <Search size={16} />
              </span>
            </div>
          </div>
          <div className="amu-filter-group">
            <label className="amu-filter-label">Status</label>
            <div className="amu-select-wrapper">
              <select
                className="amu-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="amu-select-icon" />
            </div>
          </div>
          <div className="amu-filter-group">
            <label className="amu-filter-label">Date Range</label>
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder="dd/mm/yyyy - dd/mm/yyyy"
            />
          </div>
        </div>

        <div className="amu-toolbar-right">
          <div className="amu-counters">
            <span>
              Active: {counters.active} | Inactive: {counters.inactive} |
              Banned: {counters.banned} | Total: {counters.total}
            </span>
          </div>
        </div>
      </div>

      <div className="amu-table">
        <div className="amu-row amu-header">
          <div className="amu-col amu-col-name">Name</div>
          <div className="amu-col amu-col-phone">Phone</div>
          <div className="amu-col amu-col-email">Email</div>
          <div className="amu-col amu-col-shop">Shop</div>
          <div className="amu-col amu-col-created">Created At</div>
          <div className="amu-col amu-col-lastlogin">Last Login</div>
          <div className="amu-col amu-col-status">Status</div>
          <div className="amu-col amu-col-action">Action</div>
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
          filtered.map((row) => (
            <div className="amu-row" key={row.id}>
              <div className="amu-col amu-col-name">{row.name}</div>
              <div className="amu-col amu-col-phone">{row.phone}</div>
              <div className="amu-col amu-col-email">{row.email}</div>
              <div className="amu-col amu-col-shop">
                <button
                  className="amu-view-details"
                  onClick={() =>
                    setViewDetailsPopup({
                      isOpen: true,
                      userId: row.id,
                      userName: row.name,
                    })
                  }
                >
                  View Details
                </button>
              </div>
              <div className="amu-col amu-col-created">
                <div>{row.createdAt.split(" ")[0]}</div>
                <div className="amu-sub">{row.createdAt.split(" ")[1]}</div>
              </div>
              <div className="amu-col amu-col-lastlogin">
                <div>{row.lastLogin.split(" ")[0]}</div>
                <div className="amu-sub">{row.lastLogin.split(" ")[1]}</div>
              </div>
              <div className="amu-col amu-col-status">
                <span className={`amu-badge ${row.status.toLowerCase()}`}>
                  {row.status}
                </span>
              </div>
              <div className="amu-col amu-col-action">
                <div className="amu-actions">
                  <button
                    className="amu-action-btn amu-action-view-details"
                    title="View & Edit Details"
                    onClick={() =>
                      setUpdatePopup({
                        isOpen: true,
                        userId: row.id,
                      })
                    }
                  >
                    <Eye size={14} />
                  </button>
                  {row.status === "Active" && (
                    <>
                      <button
                        className="amu-action-btn amu-action-deactivate"
                        title="Deactivate"
                        onClick={() => showConfirmDialog(row, "Deactivate")}
                      >
                        <Pause size={14} />
                      </button>
                      <button
                        className="amu-action-btn amu-action-ban"
                        title="Ban"
                        onClick={() => showConfirmDialog(row, "Ban")}
                      >
                        <Ban size={14} />
                      </button>
                    </>
                  )}
                  {row.status === "Inactive" && (
                    <>
                      <button
                        className="amu-action-btn amu-action-activate"
                        title="Activate"
                        onClick={() => showConfirmDialog(row, "Activate")}
                      >
                        <Play size={14} />
                      </button>
                      <button
                        className="amu-action-btn amu-action-ban"
                        title="Ban"
                        onClick={() => showConfirmDialog(row, "Ban")}
                      >
                        <Ban size={14} />
                      </button>
                    </>
                  )}
                  {row.status === "Banned" && (
                    <button
                      className="amu-action-btn amu-action-unban"
                      title="Unban"
                      onClick={() => showConfirmDialog(row, "Unban")}
                    >
                      <Undo size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirmation Popup */}
      <ConfirmationPopup
        isOpen={confirmationPopup.isOpen}
        onClose={() =>
          setConfirmationPopup({
            isOpen: false,
            type: "delete",
            title: "",
            message: "",
            onConfirm: null,
            isLoading: false,
          })
        }
        onConfirm={confirmationPopup.onConfirm}
        title={confirmationPopup.title}
        message={confirmationPopup.message}
        type={confirmationPopup.type}
        isLoading={confirmationPopup.isLoading}
      />

      {/* View Details Popup */}
      <ViewDetails
        isOpen={viewDetailsPopup.isOpen}
        onClose={() =>
          setViewDetailsPopup({
            isOpen: false,
            userId: null,
            userName: "",
          })
        }
        userId={viewDetailsPopup.userId}
        userName={viewDetailsPopup.userName}
      />

      {/* Customer Update Modal */}
      <CustomerUpdate
        isOpen={updatePopup.isOpen}
        onClose={() =>
          setUpdatePopup({
            isOpen: false,
            userId: null,
          })
        }
        userId={updatePopup.userId}
        onUpdateSuccess={(updatedUser) => {
          // Refresh data sau khi update thành công
          setRows((prev) =>
            prev.map((r) => {
              if (r.id !== updatedUser._id) return r;
              const statusMap = {
                active: "Active",
                inactive: "Inactive",
                banned: "Banned",
                pending: "Pending",
              };
              return {
                ...r,
                name: updatedUser.full_name || r.name,
                email: updatedUser.email || r.email,
                phone: updatedUser.phone || r.phone,
                status: statusMap[updatedUser.status] || r.status,
              };
            })
          );
        }}
      />
    </div>
  );
}
