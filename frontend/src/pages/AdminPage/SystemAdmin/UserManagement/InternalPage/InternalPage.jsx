import { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./InternalPage.css";
import { Play, Pause, Plus, ChevronDown, Search } from "lucide-react";
import ConfirmationPopup from "../../../../../components/common/ConfirmationPopup/ConfirmationPopup";
import AddNewStaff from "./AddNewStaff";
import NoteEditor from "../../../../../components/common/NoteEditor/NoteEditor";
import axiosInstance from "../../../../../utils/axios";
import { API_ENDPOINTS } from "../../../../../config/api.config";
import DateRangePicker from "../../../../../components/common/DateRangePicker/DateRangePicker";
import {
  prepareNoteItems,
  createNotesMap,
  mergeNoteToEntity,
  getEntityId,
} from "../../../../../utils/noteUtils";

export default function InternalPage() {
  const { t, i18n } = useTranslation("admin");
  const [rawStaff, setRawStaff] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(t("common.all"));
  const [role, setRole] = useState(t("common.all"));
  const [dateRange, setDateRange] = useState("");
  const [confirmationPopup, setConfirmationPopup] = useState({
    isOpen: false,
    type: "delete",
    title: "",
    message: "",
    onConfirm: null,
    isLoading: false,
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const STATUSES = useMemo(() => [t("common.all"), t("common.active"), t("common.inactive")], [t]);
  const ROLES = useMemo(() => [
    t("common.all"),
    t("internalPage.roles.systemAdmin"),
    t("internalPage.roles.csStaff"),
    t("internalPage.roles.accountant")
  ], [t]);

  // Reset filters khi đổi ngôn ngữ
  useEffect(() => {
    setStatus(t("common.all"));
    setRole(t("common.all"));
  }, [i18n.language, t]);

  // Helper function để map staff data với translation
  const mapStaffData = useCallback((user) => {
    // Map role với translation
    const roleMap = {
      "System Admin": t("internalPage.roles.systemAdmin"),
      "CS Staff": t("internalPage.roles.csStaff"),
      "Accountant": t("internalPage.roles.accountant"),
    };

    return {
      id: getEntityId(user),
      name: user.full_name || "N/A",
      phone: user.phone || "-",
      email: user.email || "-",
      role: roleMap[user.internal_role] || user.internal_role || "N/A",
      createdAt: user.created_at
        ? new Date(user.created_at)
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
      lastLogin: user.last_login_at
        ? new Date(user.last_login_at)
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
      status: user.status === "active" ? t("common.active") : t("common.inactive"),
      statusKey: user.status || "inactive", // Lưu status gốc để dùng cho CSS class
      note: "",
      noteId: null,
    };
  }, [t]);

  // Fetch internal staff từ API
  useEffect(() => {
    const fetchInternalStaff = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(API_ENDPOINTS.USERS.INTERNAL);

        if (response.data.success) {
          const staff = response.data.data;
          setRawStaff(staff);

          // Format data để hiển thị trong table
          const formattedStaff = staff.map((user) => mapStaffData(user));

          // Chuẩn bị items để query notes
          const noteItems = prepareNoteItems(staff, "User");

          // Fetch notes batch nếu có staff
          if (noteItems.length > 0) {
            const notesResponse = await axiosInstance.post(
              API_ENDPOINTS.NOTES.BATCH,
              { items: noteItems }
            );

            // Tạo Map để lookup notes
            const notesMap = createNotesMap(notesResponse);

            // Merge notes vào staff
            const staffWithNotes = formattedStaff.map((staffMember) =>
              mergeNoteToEntity(staffMember, "User", notesMap)
            );

            setRows(staffWithNotes);
          } else {
            setRows(formattedStaff);
          }
        }
      } catch (error) {
        console.error("Error fetching internal staff:", error);
        // Fallback về mock data nếu có lỗi
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInternalStaff();
  }, [mapStaffData]);

  // Re-map data khi ngôn ngữ thay đổi
  useEffect(() => {
    if (rawStaff.length > 0) {
      const formattedStaff = rawStaff.map((user) => mapStaffData(user));

      // Chuẩn bị items để query notes
      const noteItems = prepareNoteItems(rawStaff, "User");

      // Fetch notes batch nếu có staff
      if (noteItems.length > 0) {
        axiosInstance
          .post(API_ENDPOINTS.NOTES.BATCH, { items: noteItems })
          .then((notesResponse) => {
            // Tạo Map để lookup notes
            const notesMap = createNotesMap(notesResponse);

            // Merge notes vào staff
            const staffWithNotes = formattedStaff.map((staffMember) =>
              mergeNoteToEntity(staffMember, "User", notesMap)
            );

            setRows(staffWithNotes);
          })
          .catch((error) => {
            console.error("Error fetching notes:", error);
            setRows(formattedStaff);
          });
      } else {
        setRows(formattedStaff);
      }

      // Reset filters về "All" khi đổi ngôn ngữ
      setStatus(t("common.all"));
      setRole(t("common.all"));
    }
  }, [i18n.language, rawStaff, mapStaffData, t]);

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
      const allValue = t("common.all");
      const matchStatus = status === "All" || status === allValue ? true : c.status === status;
      // Lọc theo role
      const matchRole = role === "All" || role === allValue ? true : c.role === role;
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
      return matchSearch && matchStatus && matchRole && matchDate;
    });
  }, [search, status, role, dateRange, rows, t]);

  const counters = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((c) => c.status === t("common.active")).length;
    const inactive = filtered.filter((c) => c.status === t("common.inactive")).length;
    return { total, active, inactive };
  }, [filtered, t]);

  const handleAction = async (row, type) => {
    // Set loading state
    setConfirmationPopup((prev) => ({ ...prev, isLoading: true }));

    try {
      // Map action type sang status tương ứng
      let newStatus;
      switch (type) {
        case t("internalPage.actions.activate"):
          newStatus = "active";
          break;
        case t("internalPage.actions.deactivate"):
          newStatus = "inactive";
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
        // Update raw data
        setRawStaff((prev) =>
          prev.map((s) => {
            const staffId = getEntityId(s);
            if (staffId !== row.id) return s;
            return { ...s, status: newStatus };
          })
        );

        // Đồng bộ status trong UI với translation
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== row.id) return r;
            // Map status từ DB (active/inactive) sang UI format với translation
            const statusMap = {
              active: t("common.active"),
              inactive: t("common.inactive"),
            };
            return { 
              ...r, 
              status: statusMap[newStatus] || t("common.inactive"),
              statusKey: newStatus || "inactive"
            };
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
          response.data.message || t("internalPage.messages.updateStatusError")
        );
      }
    } catch (error) {
      console.error("Error updating user status:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        t("internalPage.messages.updateStatusError");
      alert(errorMessage); // TODO: Thay bằng toast notification
      setConfirmationPopup((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const showConfirmDialog = (row, actionType) => {
    const actionConfig = {
      [t("internalPage.actions.activate")]: {
        type: "activate",
        title: t("internalPage.messages.confirmActivate"),
        message: t("internalPage.messages.confirmActivateMessage", { name: row.name }),
      },
      [t("internalPage.actions.deactivate")]: {
        type: "deactivate",
        title: t("internalPage.messages.confirmDeactivate"),
        message: t("internalPage.messages.confirmDeactivateMessage", { name: row.name }),
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

  const handleAddStaff = async (formData) => {
    try {
      // Gọi API thực tế
      const response = await axiosInstance.post(
        API_ENDPOINTS.USERS.CREATE_INTERNAL,
        {
          email: formData.email,
          role: formData.role,
        }
      );

      if (response.data.success) {
        // Refresh lại danh sách internal staff sau khi thêm thành công
        const refreshResponse = await axiosInstance.get(
          API_ENDPOINTS.USERS.INTERNAL
        );

        if (refreshResponse.data.success) {
          const staff = refreshResponse.data.data;
          setRawStaff(staff);

          // Format data để hiển thị trong table
          const formattedStaff = staff.map((user) => mapStaffData(user));

          // Chuẩn bị items để query notes
          const noteItems = prepareNoteItems(staff, "User");

          // Fetch notes batch nếu có staff
          if (noteItems.length > 0) {
            const notesResponse = await axiosInstance.post(
              API_ENDPOINTS.NOTES.BATCH,
              { items: noteItems }
            );

            // Tạo Map để lookup notes
            const notesMap = createNotesMap(notesResponse);

            // Merge notes vào staff
            const staffWithNotes = formattedStaff.map((staffMember) =>
              mergeNoteToEntity(staffMember, "User", notesMap)
            );

            setRows(staffWithNotes);
          } else {
            setRows(formattedStaff);
          }
        }
      } else {
        throw new Error(
          response.data.message || t("internalPage.messages.addStaffError")
        );
      }
    } catch (error) {
      console.error("Error adding staff:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        t("internalPage.messages.addStaffError");
      throw new Error(errorMessage);
    }
  };

  return (
    <div className="amu-internal">
      <div className="amu-toolbar">
        <div className="amu-toolbar-left">
          <div className="amu-filter-group">
            <label className="amu-filter-label">{t("internalPage.search")}</label>
            <div className="amu-search">
              <input
                className="amu-search-input"
                placeholder={t("internalPage.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="amu-search-icon"><Search size={16} /></span>
            </div>
          </div>
          <div className="amu-filter-group">
            <label className="amu-filter-label">{t("internalPage.status")}</label>
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
            <label className="amu-filter-label">{t("internalPage.role")}</label>
            <div className="amu-select-wrapper">
              <select
                className="amu-role-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="amu-select-icon" />
            </div>
          </div>
          <div className="amu-filter-group">
            <label className="amu-filter-label">{t("internalPage.dateRange")}</label>
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder={t("internalPage.dateRangePlaceholder")}
            />
          </div>
        </div>

        <div className="amu-toolbar-right">
          <div className="amu-counters">
            <span>
              {t("internalPage.counters.active")}: {counters.active} | {t("internalPage.counters.inactive")}: {counters.inactive} | {t("internalPage.counters.total")}:{" "}
              {counters.total}
            </span>
          </div>
          <button
            className="amu-add-btn"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} />{" "}
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>
              {t("internalPage.actions.addNew")}
            </span>
          </button>
        </div>
      </div>

      <div className="amu-table">
        <div className="amu-row amu-header">
          <div className="amu-col amu-col-name">{t("internalPage.columns.name")}</div>
          <div className="amu-col amu-col-phone">{t("internalPage.columns.phone")}</div>
          <div className="amu-col amu-col-email">{t("internalPage.columns.email")}</div>
          <div className="amu-col amu-col-role">{t("internalPage.columns.role")}</div>
          <div className="amu-col amu-col-created">{t("internalPage.columns.createdAt")}</div>
          {/* <div className="amu-col amu-col-lastlogin">{t("internalPage.columns.lastLogin")}</div> */}
          <div className="amu-col amu-col-status">{t("internalPage.columns.status")}</div>
          <div className="amu-col amu-col-action">{t("internalPage.columns.action")}</div>
        </div>

        {loading ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            {t("internalPage.messages.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            {t("internalPage.messages.noData")}
          </div>
        ) : (
          filtered.map((row) => (
            <div className="amu-row" key={row.id}>
              <div className="amu-col amu-col-name">{row.name}</div>
              <div className="amu-col amu-col-phone">{row.phone || "-"}</div>
              <div className="amu-col amu-col-email">{row.email || "-"}</div>
              <div className="amu-col amu-col-role">{row.role}</div>
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
                  {row.status === t("common.active") && (
                    <button
                      className="amu-action-btn amu-action-deactivate"
                      title={t("internalPage.actions.deactivate")}
                      onClick={() => showConfirmDialog(row, t("internalPage.actions.deactivate"))}
                    >
                      <Pause size={14} />
                    </button>
                  )}
                  {row.status === t("common.inactive") && (
                    <button
                      className="amu-action-btn amu-action-activate"
                      title={t("internalPage.actions.activate")}
                      onClick={() => showConfirmDialog(row, t("internalPage.actions.activate"))}
                    >
                      <Play size={14} />
                    </button>
                  )}
                </div>
              </div>
              {/* <div className="amu-col amu-col-note">
                <NoteEditor
                  targetType="User"
                  targetId={row.id}
                  initialNote={row.note || ""}
                  noteId={row.noteId}
                  onNoteSaved={(savedData) => {
                    setRows((prev) =>
                      prev.map((r) =>
                        r.id === row.id
                          ? { ...r, note: savedData.note, noteId: savedData.noteId }
                          : r
                      )
                    );
                  }}
                />
              </div> */}
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

      {/* Add New Staff Modal */}
      <AddNewStaff
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddStaff}
      />
    </div>
  );
}
