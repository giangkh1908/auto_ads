import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./LeadPage.css";
import { Search, ChevronDown, UserPlus, UserCheck } from "lucide-react";
import NoteEditor from "../../../../components/common/NoteEditor/NoteEditor";
import leadService from "../../../../services/leadService";
import { useToast } from "../../../../hooks/useToast";
import { useAuth } from "../../../../hooks/useAuth";
import DateRangePicker from "../../../../components/common/DateRangePicker/DateRangePicker";

// Format date từ ISO string sang dd/mm/yyyy HH:mm:ss
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

// Map status từ DB sang UI
const mapStatusToUI = (dbStatus, t) => {
  const statusMap = {
    new: t("leadPage.statuses.new"),
    contacted: t("leadPage.statuses.contacted"),
  };
  return statusMap[dbStatus] || dbStatus;
};


export default function LeadPage() {
  const { t, i18n } = useTranslation("admin");
  const [rawLeads, setRawLeads] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(t("common.all"));
  const [assignedStatus, setAssignedStatus] = useState(t("common.all"));
  const [dateRange, setDateRange] = useState("");
  const toast = useToast();
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id;

  const STATUSES = useMemo(() => [t("common.all"), t("leadPage.statuses.new"), t("leadPage.statuses.contacted")], [t]);
  const ASSIGNED_STATUSES = useMemo(() => [t("common.all"), t("common.assigned"), t("common.unassigned")], [t]);
  
  // Track previous search và filters để phân biệt thay đổi
  // Khởi tạo với null để detect lần mount đầu tiên
  const prevSearchRef = useRef(null);
  const prevFiltersRef = useRef(null);
  const isMountedRef = useRef(false);
  const prevUserIdRef = useRef(null);

  // Fetch leads từ API
  const fetchLeads = async () => {
    setLoading(true);
    try {
      // Parse date range
      let dateFrom = null;
      let dateTo = null;
      if (dateRange && dateRange.includes("-")) {
        const [from, to] = dateRange.split("-").map((v) => v.trim());
        if (from) {
          const [dd, mm, yyyy] = from.split("/").map((x) => parseInt(x));
          if (dd && mm && yyyy) {
            dateFrom = new Date(yyyy, mm - 1, dd).toISOString();
          }
        }
        if (to) {
          const [dd, mm, yyyy] = to.split("/").map((x) => parseInt(x));
          if (dd && mm && yyyy) {
            dateTo = new Date(yyyy, mm - 1, dd).toISOString();
          }
        }
      }

      // Map UI status back to DB status for API
      const getDbStatus = (uiStatus) => {
        if (uiStatus === t("leadPage.statuses.new")) return "new";
        if (uiStatus === t("leadPage.statuses.contacted")) return "contacted";
        return uiStatus;
      };

      const params = {
        search: search.trim() || undefined,
        status: status !== t("common.all") ? getDbStatus(status) : undefined,
        assigned_status: assignedStatus !== t("common.all") ? (assignedStatus === t("common.assigned") ? "assigned" : "unassigned") : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: 1,
        limit: 1000, // Lấy tất cả để filter ở frontend
      };

      const response = await leadService.getLeads(params);
      
      if (response.success) {
        setRawLeads(response.data);
        // Map dữ liệu từ DB format sang UI format
        const mappedLeads = response.data.map((lead) => ({
          id: lead.id,
          leadName: lead.lead_name,
          phone: lead.phone,
          createdAt: formatDate(lead.created_at),
          status: mapStatusToUI(lead.status, t),
          assignedStatus: lead.assigned_to ? t("common.assigned") : t("common.unassigned"),
          assignedTo: lead.assigned_to, // Lưu thông tin assigned_to để so sánh
          isAssignedToMe: lead.assigned_to && user && (() => {
            const assignedUserId = lead.assigned_to._id;
            const currentUserId = user._id || user.id;
            return String(assignedUserId) === String(currentUserId);
          })(),
          note: lead.note || "",
          noteId: lead.noteId || null,
          _raw: lead, // Lưu raw data để update
        }));
        setRows(mappedLeads);
      } else {
        toast.error(response.message || t("leadPage.messages.fetchError"));
      }
    } catch (error) {
      toast.error(error.message || t("leadPage.messages.fetchError"));
    } finally {
      setLoading(false);
    }
  };

  // Lấy user ID để track thay đổi (tránh trigger khi user object reference thay đổi)
  const userId = useMemo(() => user?._id || user?.id || null, [user?._id, user?.id]);
  
  // Tạo một dependency key duy nhất để track khi nào cần fetch
  // Chỉ thay đổi khi user ID thay đổi hoặc filter/search thay đổi
  const filtersKey = useMemo(() => 
    `${status}|${assignedStatus}|${dateRange}|${search}`,
    [status, assignedStatus, dateRange, search]
  );

  // Gộp tất cả logic fetch vào 1 useEffect với debounce thông minh
  // Chỉ debounce khi search thay đổi, các filter khác gọi ngay lập tức
  useEffect(() => {
    // Không fetch nếu chưa có user
    if (!user || !userId) {
      // Reset mounted flag khi user = null (đăng xuất)
      if (!user) {
        isMountedRef.current = false;
        prevUserIdRef.current = null;
      }
      return;
    }

    // Kiểm tra xem user ID có thay đổi không
    const isUserIdChanged = prevUserIdRef.current !== userId;
    
    // Lưu filters key hiện tại để so sánh
    const currentFiltersKey = filtersKey;

    // Nếu user ID thay đổi (lần đầu load user hoặc đăng nhập user mới)
    if (isUserIdChanged) {
      // Cập nhật refs
      prevUserIdRef.current = userId;
      prevSearchRef.current = search;
      prevFiltersRef.current = { status, assignedStatus, dateRange };
      isMountedRef.current = true;
      // Gọi ngay lập tức (không debounce) khi user ID thay đổi
      fetchLeads();
      return;
    }

    // Từ đây, user ID không thay đổi, chỉ check filter/search changes
    // Kiểm tra xem có phải search thay đổi không
    const isSearchChange = prevSearchRef.current !== search;
    // Kiểm tra xem có filter nào thay đổi không bằng cách so sánh filtersKey
    const prevFiltersKey = `${prevFiltersRef.current?.status}|${prevFiltersRef.current?.assignedStatus}|${prevFiltersRef.current?.dateRange}|${prevSearchRef.current}`;
    const hasFilterChange = prevFiltersKey !== currentFiltersKey;

    // Nếu không có thay đổi gì, không gọi API
    if (!hasFilterChange) {
      return;
    }

    // Cập nhật ref TRƯỚC KHI set timeout để tránh race condition
    prevSearchRef.current = search;
    prevFiltersRef.current = { status, assignedStatus, dateRange };

    // Debounce 500ms chỉ cho search, không debounce cho filter khác
    // Nếu chỉ filter thay đổi (không phải search), gọi ngay lập tức
    const delay = isSearchChange ? 500 : 0;

    const timer = setTimeout(() => {
      fetchLeads();
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filtersKey]);

  // Re-map data khi ngôn ngữ thay đổi
  useEffect(() => {
    if (rawLeads.length > 0) {
      const mappedLeads = rawLeads.map((lead) => ({
        id: lead.id,
        leadName: lead.lead_name,
        phone: lead.phone,
        createdAt: formatDate(lead.created_at),
        status: mapStatusToUI(lead.status, t),
        assignedStatus: lead.assigned_to ? t("common.assigned") : t("common.unassigned"),
        assignedTo: lead.assigned_to,
        isAssignedToMe: lead.assigned_to && user && (() => {
          const assignedUserId = lead.assigned_to._id;
          const currentUserId = user._id || user.id;
          return String(assignedUserId) === String(currentUserId);
        })(),
        note: lead.note || "",
        noteId: lead.noteId || null,
        _raw: lead,
      }));
      setRows(mappedLeads);
      // Reset filters về "All" khi đổi ngôn ngữ
      setStatus(t("common.all"));
      setAssignedStatus(t("common.all"));
    }
  }, [i18n.language, rawLeads, t, user]);

  return (
    <div className="cs-lead-page">
      <div className="cs-lead-toolbar">
        <div className="cs-lead-toolbar-left">
        <div className="cs-lead-filter-group">
            <label className="cs-lead-filter-label">{t("leadPage.search")}</label>
          <div className="cs-lead-search">
            <input
              className="cs-lead-search-input"
              placeholder={t("leadPage.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="cs-lead-search-icon">
              <Search size={16} />
            </span>
          </div>
        </div>
          <div className="cs-lead-filter-group">
            <label className="cs-lead-filter-label">{t("leadPage.status")}</label>
            <div className="cs-lead-select-wrapper">
              <select
                className="cs-lead-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-lead-select-icon" />
            </div>
          </div>

          <div className="cs-lead-filter-group">
            <label className="cs-lead-filter-label">{t("leadPage.assignedStatus")}</label>
            <div className="cs-lead-select-wrapper">
              <select
                className="cs-lead-assigned-select"
                value={assignedStatus}
                onChange={(e) => setAssignedStatus(e.target.value)}
              >
                {ASSIGNED_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-lead-select-icon" />
            </div>
          </div>

          <div className="cs-lead-filter-group">
            <label className="cs-lead-filter-label">{t("leadPage.dateRange")}</label>
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder={t("leadPage.dateRangePlaceholder")}
            />
          </div>
        </div>
      </div>

      <div className="cs-lead-table">
        <div className="cs-lead-row cs-lead-header">
          <div className="cs-lead-col cs-lead-col-name">{t("leadPage.columns.leadName")}</div>
          <div className="cs-lead-col cs-lead-col-phone">{t("leadPage.columns.phone")}</div>
          <div className="cs-lead-col cs-lead-col-created">{t("leadPage.columns.createdAt")}</div>
          <div className="cs-lead-col cs-lead-col-status">{t("leadPage.columns.status")}</div>
          <div className="cs-lead-col cs-lead-col-assigned">{t("leadPage.columns.assignedStatus")}</div>
          <div className="cs-lead-col cs-lead-col-note">{t("leadPage.columns.note")}</div>
        </div>

        {loading ? (
          <div className="cs-lead-loading">{t("leadPage.messages.loading")}</div>
        ) : rows.length === 0 ? (
          <div className="cs-lead-empty">{t("leadPage.messages.noData")}</div>
        ) : (
          rows.map((lead) => (
          <div className="cs-lead-row" key={lead.id}>
            <div className="cs-lead-col cs-lead-col-name">{lead.leadName}</div>
            <div className="cs-lead-col cs-lead-col-phone">{lead.phone}</div>
            <div className="cs-lead-col cs-lead-col-created">
              <div>{lead.createdAt.split(" ")[0]}</div>
              <div className="cs-lead-sub">{lead.createdAt.split(" ")[1]}</div>
            </div>
            <div className="cs-lead-col cs-lead-col-status">
              <div className="cs-lead-select-wrapper">
                <select
                  className="cs-lead-status-select"
                  value={lead.status}
                  disabled={!lead.isAssignedToMe}
                  onChange={async (e) => {
                    // Check ngay lập tức: chỉ cho phép nếu được assign cho user hiện tại
                    if (!lead.isAssignedToMe) {
                      toast.error(t("leadPage.messages.onlyAssignedCanChange"));
                      return;
                    }

                    const newStatus = e.target.value;
                    const oldStatus = lead.status;
                    
                    // Optimistic update
                    setRows((prev) =>
                      prev.map((r) =>
                        r.id === lead.id ? { ...r, status: newStatus } : r
                      )
                    );

                    try {
                      await leadService.updateLeadStatus(lead.id, newStatus);
                      toast.success(t("leadPage.messages.updateStatusSuccess"));
                    } catch (error) {
                      // Revert on error
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === lead.id ? { ...r, status: oldStatus } : r
                        )
                      );
                      const errorMessage = error.message || t("leadPage.messages.updateStatusError");
                      toast.error(errorMessage);
                      
                      // Nếu lỗi là do không có quyền, reload trang
                      if (errorMessage.includes("Chỉ người dùng được gán") || 
                          errorMessage.includes("chưa được gán") ||
                          errorMessage.includes("làm mới trang")) {
                        setTimeout(() => {
                          window.location.reload();
                        }, 1500);
                      }
                    }
                  }}
                  title={lead.isAssignedToMe ? t("leadPage.actions.changeStatus") : t("leadPage.actions.changeStatusTooltip")}
                >
                  {STATUSES.filter((s) => s !== t("common.all")).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="cs-lead-select-icon" />
              </div>
            </div>
            <div className="cs-lead-col cs-lead-col-assigned">
              {!lead.assignedTo ? (
                <button
                  className="cs-lead-assign-btn"
                  onClick={async () => {
                    if (!user || !currentUserId) {
                      toast.error(t("leadPage.messages.userNotFound"));
                      return;
                    }

                    try {
                      await leadService.assignLead(lead.id, currentUserId);
                      toast.success(t("leadPage.messages.assignSuccess"));
                      // Refresh data
                      fetchLeads();
                    } catch (error) {
                      const errorMessage = error.message || t("leadPage.messages.assignError");
                      toast.error(errorMessage);
                      
                      // Nếu lỗi là do lead đã được assign cho user khác, reload trang
                      if (errorMessage.includes("đã được gán cho người dùng khác") || 
                          errorMessage.includes("already assigned") ||
                          errorMessage.includes("làm mới trang")) {
                        setTimeout(() => {
                          window.location.reload();
                        }, 1500);
                      }
                    }
                  }}
                  title={t("leadPage.actions.assignTooltip")}
                >
                  <UserPlus size={18} />
                </button>
              ) : lead.isAssignedToMe ? (
                <button
                  className="cs-lead-assign-btn cs-lead-assigned-btn"
                  onClick={async () => {
                    try {
                      await leadService.assignLead(lead.id, null);
                      toast.success(t("leadPage.messages.unassignSuccess"));
                      // Refresh data
                      fetchLeads();
                    } catch (error) {
                      toast.error(error.message || t("leadPage.messages.unassignError"));
                    }
                  }}
                  title={t("leadPage.actions.unassignTooltip")}
                >
                  <UserCheck size={18} />
                </button>
              ) : (
                <span className="cs-lead-badge cs-lead-badge-assigned">
                  {t("common.assigned")}
                </span>
              )}
            </div>
            <div className="cs-lead-col cs-lead-col-note">
              <NoteEditor
                targetType="Lead"
                targetId={lead.id}
                initialNote={lead.note || ""}
                noteId={lead.noteId}
                disabled={!lead.isAssignedToMe}
                disabledMessage={t("leadPage.note.disabledMessage")}
                onNoteSaved={(savedData) => {
                  setRows((prev) =>
                    prev.map((r) =>
                      r.id === lead.id
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
    </div>
  );
}

