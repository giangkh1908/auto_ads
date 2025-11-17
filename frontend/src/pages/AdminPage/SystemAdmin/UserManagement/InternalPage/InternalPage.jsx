import { useMemo, useState, useEffect } from "react";
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

const STATUSES = ["All", "Active", "Inactive"];
const ROLES = ["All", "System Admin", "CS Staff", "Accountant"];

// Mock data demo UI – có thể thay bằng dữ liệu API sau
const MOCK_INTERNAL_USERS = [
  {
    id: "i1",
    name: "Vũ Quỳnh Lan",
    phone: "0123456789",
    email: "quynhlan@gmail.com",
    role: "System Admin",
    createdAt: "01/08/2024 10:30:45",
    lastLogin: "02/08/2024 14:20:30",
    status: "Active",
    note: "",
  },
  {
    id: "i2",
    name: "Kim Hồng Giang",
    phone: "0123456789",
    email: "kimgiang@gmail.com",
    role: "System Admin",
    createdAt: "22/07/2023 09:15:20",
    lastLogin: "15/03/2022 11:45:10",
    status: "Inactive",
    note: "Đã nghỉ việc.",
  },
  {
    id: "i3",
    name: "Nguyễn Thành Long",
    phone: "0123456789",
    email: "longnthe171630@fpt.edu.vn",
    role: "CS Staff",
    createdAt: "11/10/2024 08:20:15",
    lastLogin: "23/10/2024 16:30:45",
    status: "Inactive",
    note: "Đang điều tra vi phạm.",
  },
  {
    id: "i4",
    name: "Hà Anh Tuấn",
    phone: "0123456789",
    email: "anhtuan@gmail.com",
    role: "CS Staff",
    createdAt: "04/09/2024 13:45:30",
    lastLogin: "05/09/2024 10:15:20",
    status: "Active",
    note: "",
  },
  {
    id: "i5",
    name: "Nguyễn Trọng Hưng",
    phone: "0123456789",
    email: "tronghung@gmail.com",
    role: "Accountant",
    createdAt: "19/06/2024 11:20:10",
    lastLogin: "19/09/2024 09:30:25",
    status: "Active",
    note: "",
  },
  {
    id: "i6",
    name: "Nguyễn Trung Kiên",
    phone: "0123456789",
    email: "trungkien@gmail.com",
    role: "Accountant",
    createdAt: "07/05/2024 14:10:50",
    lastLogin: "08/05/2024 15:25:40",
    status: "Active",
    note: "",
  },
];

export default function InternalPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [role, setRole] = useState("All");
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

  // Fetch internal staff từ API
  useEffect(() => {
    const fetchInternalStaff = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(API_ENDPOINTS.USERS.INTERNAL);

        if (response.data.success) {
          const staff = response.data.data;

          // Format data để hiển thị trong table
          const formattedStaff = staff.map((user) => ({
            id: getEntityId(user),
            name: user.full_name || "N/A",
            phone: user.phone || "-",
            email: user.email || "-",
            role: user.internal_role || "N/A",
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
            status: user.status === "active" ? "Active" : "Inactive",
            note: "",
            noteId: null,
          }));

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
        setRows(MOCK_INTERNAL_USERS);
      } finally {
        setLoading(false);
      }
    };

    fetchInternalStaff();
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
      // Lọc theo role
      const matchRole = role === "All" ? true : c.role === role;
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
  }, [search, status, role, dateRange, rows]);

  const counters = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((c) => c.status === "Active").length;
    const inactive = filtered.filter((c) => c.status === "Inactive").length;
    return { total, active, inactive };
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
            // Map status từ DB (active/inactive) sang UI format (Active/Inactive)
            const statusMap = {
              active: "Active",
              inactive: "Inactive",
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

          // Format data để hiển thị trong table
          const formattedStaff = staff.map((user) => ({
            id: user._id || user.id,
            name: user.full_name || "N/A",
            phone: user.phone || "-",
            email: user.email || "-",
            role: user.internal_role || "N/A",
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
            status: user.status === "active" ? "Active" : "Inactive",
            note: "",
          }));

          setRows(formattedStaff);
        }
      } else {
        throw new Error(
          response.data.message || "Có lỗi xảy ra khi thêm nhân viên"
        );
      }
    } catch (error) {
      console.error("Error adding staff:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Có lỗi xảy ra khi thêm nhân viên";
      throw new Error(errorMessage);
    }
  };

  return (
    <div className="amu-internal">
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
              <span className="amu-search-icon"><Search size={16} /></span>
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
            <label className="amu-filter-label">Role</label>
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
              Active: {counters.active} | Inactive: {counters.inactive} | Total:{" "}
              {counters.total}
            </span>
          </div>
          <button
            className="amu-add-btn"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} />{" "}
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>
              Add New
            </span>
          </button>
        </div>
      </div>

      <div className="amu-table">
        <div className="amu-row amu-header">
          <div className="amu-col amu-col-name">Name</div>
          <div className="amu-col amu-col-phone">Phone</div>
          <div className="amu-col amu-col-email">Email</div>
          <div className="amu-col amu-col-role">Role</div>
          <div className="amu-col amu-col-created">Created At</div>
          <div className="amu-col amu-col-lastlogin">Last Login</div>
          <div className="amu-col amu-col-status">Status</div>
          <div className="amu-col amu-col-action">Action</div>
          <div className="amu-col amu-col-note">Note</div>
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
              <div className="amu-col amu-col-phone">{row.phone || "-"}</div>
              <div className="amu-col amu-col-email">{row.email || "-"}</div>
              <div className="amu-col amu-col-role">{row.role}</div>
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
                  {row.status === "Active" && (
                    <button
                      className="amu-action-btn amu-action-deactivate"
                      title="Deactivate"
                      onClick={() => showConfirmDialog(row, "Deactivate")}
                    >
                      <Pause size={14} />
                    </button>
                  )}
                  {row.status === "Inactive" && (
                    <button
                      className="amu-action-btn amu-action-activate"
                      title="Activate"
                      onClick={() => showConfirmDialog(row, "Activate")}
                    >
                      <Play size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="amu-col amu-col-note">
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

      {/* Add New Staff Modal */}
      <AddNewStaff
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddStaff}
      />
    </div>
  );
}
