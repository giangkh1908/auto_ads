import { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./CustomerPage.css";
import { Play, Pause, Ban, Undo, ChevronDown, Search, Eye } from "lucide-react";
import ConfirmationPopup from "../../../../../components/common/ConfirmationPopup/ConfirmationPopup";
import ViewDetails from "./ViewShop";
import CustomerUpdate from "./CustomerUpdate";
import axiosInstance from "../../../../../utils/axios";
import { API_ENDPOINTS } from "../../../../../config/api.config";
import DateRangePicker from "../../../../../components/common/DateRangePicker/DateRangePicker";
import Pagination from "../../../../../components/common/Pagination/Pagination";
import {
  getEntityId,
} from "../../../../../utils/noteUtils";
import { toast } from "sonner";

export default function CustomerPage() {
  const { t, i18n } = useTranslation("admin");
  const [rawCustomers, setRawCustomers] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(t("common.all"));
  const [dateRange, setDateRange] = useState("");

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0
  });

  // Stats state
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    banned: 0
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const STATUSES = useMemo(() => [
    t("common.all"),
    t("common.active"),
    t("common.inactive"),
    t("customerPage.statuses.banned")
  ], [t]);

  // Reset filter khi đổi ngôn ngữ
  useEffect(() => {
    setStatus(t("common.all"));
  }, [i18n.language, t]);

  // Helper function để map customer data với translation
  const mapCustomerData = useCallback((customer) => {
    return {
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
          ? t("common.active")
          : customer.status === "inactive"
            ? t("common.inactive")
            : customer.status === "banned"
              ? t("customerPage.statuses.banned")
              : t("common.inactive"),
      statusKey: customer.status || "inactive", // Lưu status gốc để dùng cho CSS class
    };
  }, [t]);
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
  // Fetch customers from API
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        startDate: dateRange.split("-")[0]?.trim(),
        endDate: dateRange.split("-")[1]?.trim(),
      };

      // Map status filter to API value
      if (status !== t("common.all")) {
        if (status === t("common.active")) params.status = "active";
        else if (status === t("common.inactive")) params.status = "inactive";
        else if (status === t("customerPage.statuses.banned")) params.status = "banned";
      }

      const response = await axiosInstance.get(API_ENDPOINTS.USERS.CUSTOMERS, { params });

      if (response.data.success) {
        const customers = response.data.data;
        setRawCustomers(customers);

        // Format data để hiển thị trong table
        const formattedCustomers = customers.map((customer) => mapCustomerData(customer));
        setRows(formattedCustomers);

        // Update pagination info
        setPagination(prev => ({
          ...prev,
          total: response.data.total,
          totalPages: response.data.totalPages
        }));

        // Update stats if available
        if (response.data.stats) {
          setStats(response.data.stats);
        }
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error(t("customerPage.messages.fetchError"));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, status, dateRange, t, mapCustomerData]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Re-map data khi ngôn ngữ thay đổi
  useEffect(() => {
    if (rawCustomers.length > 0) {
      const formattedCustomers = rawCustomers.map((customer) => mapCustomerData(customer));
      setRows(formattedCustomers);
      // Reset filter về "All" khi đổi ngôn ngữ
      setStatus(t("common.all"));
    }
  }, [i18n.language, rawCustomers, mapCustomerData, t]);

  // Use stats from API for counters
  const counters = useMemo(() => {
    return stats;
  }, [stats]);

  const handleAction = async (row, type) => {
    // Set loading state
    setConfirmationPopup((prev) => ({ ...prev, isLoading: true }));

    try {
      // Map action type sang status tương ứng
      let newStatus;
      const activateText = t("customerPage.actions.activate");
      const deactivateText = t("customerPage.actions.deactivate");
      const banText = t("customerPage.actions.ban");
      const unbanText = t("customerPage.actions.unban");

      if (type === activateText) {
        newStatus = "active";
      } else if (type === deactivateText) {
        newStatus = "inactive";
      } else if (type === banText) {
        newStatus = "banned";
      } else if (type === unbanText) {
        newStatus = "active"; // Sau khi gỡ ban → chuyển về Active
      } else {
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
        // Cập nhật rawCustomers để đồng bộ dữ liệu
        setRawCustomers((prev) =>
          prev.map((c) => {
            const customerId = getEntityId(c);
            if (customerId !== row.id) return c;
            return { ...c, status: newStatus };
          })
        );

        // Đồng bộ status trong UI
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== row.id) return r;
            // Map status từ DB (active/inactive/banned) sang UI format (Active/Inactive/Banned)
            const statusMap = {
              active: t("common.active"),
              inactive: t("common.inactive"),
              banned: t("customerPage.statuses.banned"),
            };
            return {
              ...r,
              status: statusMap[newStatus] || t("common.inactive"),
              statusKey: newStatus || "inactive"
            };
          })
        );

        // Hiển thị toast success theo từng action
        if (type === activateText) {
          toast.success(t("customerPage.messages.activateSuccess", { name: row.name }));
        } else if (type === deactivateText) {
          toast.success(t("customerPage.messages.deactivateSuccess", { name: row.name }));
        } else if (type === banText) {
          toast.success(t("customerPage.messages.banSuccess", { name: row.name }));
        } else if (type === unbanText) {
          toast.success(t("customerPage.messages.unbanSuccess", { name: row.name }));
        }

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
          response.data.message || t("customerPage.messages.updateStatusError")
        );
      }
    } catch (error) {
      console.error("Error updating user status:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        t("customerPage.messages.updateStatusError");
      toast.error(errorMessage);
      setConfirmationPopup((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const showConfirmDialog = (row, actionType) => {
    const activateText = t("customerPage.actions.activate");
    const deactivateText = t("customerPage.actions.deactivate");
    const banText = t("customerPage.actions.ban");
    const unbanText = t("customerPage.actions.unban");

    const actionConfig = {
      [activateText]: {
        type: "activate",
        title: t("customerPage.messages.confirmActivate"),
        message: t("customerPage.messages.confirmActivateMessage", { name: row.name }),
      },
      [deactivateText]: {
        type: "deactivate",
        title: t("customerPage.messages.confirmDeactivate"),
        message: t("customerPage.messages.confirmDeactivateMessage", { name: row.name }),
      },
      [banText]: {
        type: "ban",
        title: t("customerPage.messages.confirmBan"),
        message: t("customerPage.messages.confirmBanMessage", { name: row.name }),
      },
      [unbanText]: {
        type: "unban",
        title: t("customerPage.messages.confirmUnban"),
        message: t("customerPage.messages.confirmUnbanMessage", { name: row.name }),
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
            <label className="amu-filter-label">{t("customerPage.search")}</label>
            <div className="amu-search">
              <input
                className="amu-search-input"
                placeholder={t("customerPage.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="amu-search-icon">
                <Search size={16} />
              </span>
            </div>
          </div>
          <div className="amu-filter-group">
            <label className="amu-filter-label">{t("customerPage.status")}</label>
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
            <label className="amu-filter-label">{t("customerPage.dateRange")}</label>
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder={t("customerPage.dateRangePlaceholder")}
            />
          </div>
        </div>

        <div className="amu-toolbar-right">
          <div className="amu-counters">
            <span>
              {t("customerPage.counters.active")}: {counters.active} | {t("customerPage.counters.inactive")}: {counters.inactive} |
              {t("customerPage.counters.banned")}: {counters.banned} | {t("customerPage.counters.total")}: {counters.total}
            </span>
          </div>
        </div>
      </div>

      <div className="amu-table">
        <div className="amu-row amu-header">
          <div className="amu-col amu-col-name">{t("customerPage.columns.name")}</div>
          {/* <div className="amu-col amu-col-phone">{t("customerPage.columns.phone")}</div>
          <div className="amu-col amu-col-email">{t("customerPage.columns.email")}</div> */}
          <div className="amu-col amu-col-shop">{t("customerPage.columns.shop")}</div>
          <div className="amu-col amu-col-created">{t("customerPage.columns.createdAt")}</div>
          {/* <div className="amu-col amu-col-lastlogin">{t("customerPage.columns.lastLogin")}</div> */}
          <div className="amu-col amu-col-status">{t("customerPage.columns.status")}</div>
          <div className="amu-col amu-col-action">{t("customerPage.columns.action")}</div>
        </div>

        {loading ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            {t("customerPage.messages.loading")}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            {t("customerPage.messages.noData")}
          </div>
        ) : (
          rows.map((row) => (
            <div className="amu-row" key={row.id}>
              <div className="amu-col amu-col-name">{row.name}</div>
              {/* <div className="amu-col amu-col-phone">{row.phone}</div>
              <div className="amu-col amu-col-email">{row.email}</div> */}
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
                  {t("customerPage.actions.viewDetails")}
                </button>
              </div>
              <div className="amu-col amu-col-created">
                <div>{row.createdAt.split(" ")[0]}</div>
                <div className="amu-sub">{row.createdAt.split(" ")[1]}</div>
              </div>
              {/* <div className="amu-col amu-col-lastlogin">
                <div>{row.lastLogin.split(" ")[0]}</div>
                <div className="amu-sub">{row.lastLogin.split(" ")[1]}</div>
              </div> */}
              <div className="amu-col amu-col-status">
                <span className={`amu-badge ${row.statusKey || "inactive"}`}>
                  {row.status}
                </span>
              </div>
              <div className="amu-col amu-col-action">
                <div className="amu-actions">
                  <button
                    className="amu-action-btn amu-action-view-details"
                    title={t("customerPage.actions.viewEditDetails")}
                    onClick={() =>
                      setUpdatePopup({
                        isOpen: true,
                        userId: row.id,
                      })
                    }
                  >
                    <Eye size={14} />
                  </button>
                  {row.status === t("common.active") && (
                    <>
                      <button
                        className="amu-action-btn amu-action-deactivate"
                        title={t("customerPage.actions.deactivate")}
                        onClick={() => showConfirmDialog(row, t("customerPage.actions.deactivate"))}
                      >
                        <Pause size={14} />
                      </button>
                      <button
                        className="amu-action-btn amu-action-ban"
                        title={t("customerPage.actions.ban")}
                        onClick={() => showConfirmDialog(row, t("customerPage.actions.ban"))}
                      >
                        <Ban size={14} />
                      </button>
                    </>
                  )}
                  {row.status === t("common.inactive") && (
                    <>
                      <button
                        className="amu-action-btn amu-action-activate"
                        title={t("customerPage.actions.activate")}
                        onClick={() => showConfirmDialog(row, t("customerPage.actions.activate"))}
                      >
                        <Play size={14} />
                      </button>
                      <button
                        className="amu-action-btn amu-action-ban"
                        title={t("customerPage.actions.ban")}
                        onClick={() => showConfirmDialog(row, t("customerPage.actions.ban"))}
                      >
                        <Ban size={14} />
                      </button>
                    </>
                  )}
                  {row.status === t("customerPage.statuses.banned") && (
                    <button
                      className="amu-action-btn amu-action-unban"
                      title={t("customerPage.actions.unban")}
                      onClick={() => showConfirmDialog(row, t("customerPage.actions.unban"))}
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

      {/* Pagination */}
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        itemsPerPage={pagination.limit}
        startIndex={(pagination.page - 1) * pagination.limit}
        endIndex={Math.min(pagination.page * pagination.limit, pagination.total)}
        onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
        onItemsPerPageChange={(limit) => setPagination(prev => ({ ...prev, limit, page: 1 }))}
      />

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
          // Update raw data và re-map với translation
          setRawCustomers((prev) =>
            prev.map((c) => {
              const customerId = getEntityId(c);
              if (customerId !== updatedUser._id) return c;
              return {
                ...c,
                full_name: updatedUser.full_name || c.full_name,
                email: updatedUser.email || c.email,
                phone: updatedUser.phone || c.phone,
                status: updatedUser.status || c.status,
              };
            })
          );
          // Re-map với translation mới
          setRows((prev) =>
            prev.map((r) => {
              if (r.id !== updatedUser._id) return r;
              const statusMap = {
                active: t("common.active"),
                inactive: t("common.inactive"),
                banned: t("customerPage.statuses.banned"),
                pending: t("common.pending"),
              };
              return {
                ...r,
                name: updatedUser.full_name || r.name,
                email: updatedUser.email || r.email,
                phone: updatedUser.phone || r.phone,
                status: statusMap[updatedUser.status] || r.status,
                statusKey: updatedUser.status || r.statusKey || "inactive",
              };
            })
          );
        }}
      />
    </div>
  );
}