import { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./ServicePackagePage.css";
import { Search, ChevronDown, UserPlus, UserCheck } from "lucide-react";
import Pagination from "../../../../components/common/Pagination/Pagination";
import axiosInstance from "../../../../utils/axios";
import { toast } from "sonner";
import NoteEditor from "../../../../components/common/NoteEditor/NoteEditor";
import { fetchLatestNotesBatch } from "../../../../utils/noteUtils";
import { useAuth } from "../../../../hooks/useAuth";

export default function ServicePackagePage() {
  const { t, i18n } = useTranslation("admin");
  const [rawPackages, setRawPackages] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  // packageFilter stores package_id string or 'All'
  const [packageFilter, setPackageFilter] = useState("All");
  const [segment, setSegment] = useState(t("common.all"));
  const [userStatus, setUserStatus] = useState(t("common.all"));
  const [assignedStatus, setAssignedStatus] = useState(t("common.all"));
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id;
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  const SEGMENTS = useMemo(() => [
    t("common.all"),
    t("servicePackagePage.segments.expiringSoon"),
    t("servicePackagePage.segments.recentlyExpired"),
    t("servicePackagePage.segments.newSignup"),
    t("servicePackagePage.segments.noIssue")
  ], [t]);
  
  // Fetch user statuses dynamically from backend
  const [userStatusesList, setUserStatusesList] = useState([]);
  // Fetch packages from backend for the package filter dropdown
  const [packagesFromServer, setPackagesFromServer] = useState([]);
  const USER_STATUSES = useMemo(() => {
    const statusTranslationMap = {
      active: t("servicePackagePage.userStatuses.active"),
      inactive: t("servicePackagePage.userStatuses.inactive"),
      banned: t("servicePackagePage.userStatuses.banned"),
    };
    return [
      t("common.all"),
      ...userStatusesList.map(status => statusTranslationMap[status.toLowerCase()] || status)
    ];
  }, [t, userStatusesList]);
  
  const ASSIGNED_STATUSES = useMemo(() => [t("common.all"), t("common.assigned"), t("common.unassigned")], [t]);

  // Helper function để map dữ liệu từ backend sang format UI
  const mapUserPackageData = useCallback((userPackage) => {
    const user = userPackage.user_id || {};
    const pkg = userPackage.package_id || {};
    const salesman = userPackage.salesman_id || {};

    const getDisplayName = (entity = {}) =>
      entity.full_name || entity.name || entity.username || "-";

    // Format date
    const formatDate = (date) => {
      if (!date) return "-";
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Xác định segment dựa trên from_date và to_date
    const getSegment = () => {
      if (!userPackage.from_date || !userPackage.to_date) return t("servicePackagePage.segments.noIssue");

      const now = new Date();
      const fromDate = new Date(userPackage.from_date);
      const toDate = new Date(userPackage.to_date);
      const daysUntilExpiry = Math.ceil((toDate - now) / (1000 * 60 * 60 * 24));
      const daysSinceExpiry = Math.ceil((now - toDate) / (1000 * 60 * 60 * 24));
      const daysSinceSignup = Math.ceil((now - fromDate) / (1000 * 60 * 60 * 24));

      // New Signup: mới mua ≤ 7 ngày
      if (daysSinceSignup <= 7) {
        return t("servicePackagePage.segments.newSignup");
      }

      // Recently Expired: đã hết hạn trong vòng 14 ngày gần đây
      if (toDate < now && daysSinceExpiry <= 14) {
        return t("servicePackagePage.segments.recentlyExpired");
      }

      // Expiring Soon: còn ≤ 7 ngày và chưa hết hạn
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        return t("servicePackagePage.segments.expiringSoon");
      }

      // No Issue: các trường hợp khác
      return t("servicePackagePage.segments.noIssue");
    };

    // Map user status với translation
    const mapUserStatus = (status) => {
      const statusMap = {
        active: t("servicePackagePage.userStatuses.active"),
        inactive: t("servicePackagePage.userStatuses.inactive"),
        banned: t("servicePackagePage.userStatuses.banned"),
        pending: t("common.pending"),
      };
      return statusMap[status?.toLowerCase()] || t("servicePackagePage.userStatuses.active");
    };

    // Map package name (loại bỏ số tháng nếu có)
    const mapPackageName = (name) => {
      if (!name) return "-";
      const lower = name.toLowerCase();
      if (lower.includes("chatbot ai")) return "Chatbot AI";
      if (lower.includes("chatbot")) return "Chatbot";
      return name;
    };

    return {
      id: userPackage._id,
      userId: user._id || "-",
      name: getDisplayName(user),
      phone: user.phone || "-",
      email: user.email || "-",
      package: mapPackageName(pkg.name),
      purchasedDate: formatDate(userPackage.from_date || userPackage.created_at),
      expiredDate: formatDate(userPackage.to_date),
      segment: getSegment(),
      userStatus: mapUserStatus(user.status),
      userStatusKey: (user.status || "active").toLowerCase(), // Lưu status gốc để dùng cho CSS class
      assignedStatus: salesman._id ? t("common.assigned") : t("common.unassigned"),
      salesmanId: salesman._id || null,
      salesmanName: getDisplayName(salesman),
      note: "",
      noteId: null,
      originalData: userPackage,
    };
  }, [t]);

  // Fetch user packages từ API
  const fetchUserPackages = useCallback(async () => {
    setLoading(true);
    try {
      // Map segment to backend value (since backend now computes it)
      const segmentMap = {
        [t("servicePackagePage.segments.expiringSoon")]: "expiringSoon",
        [t("servicePackagePage.segments.recentlyExpired")]: "recentlyExpired",
        [t("servicePackagePage.segments.newSignup")]: "newSignup",
        [t("servicePackagePage.segments.noIssue")]: "noIssue",
      };

      // Map user status to backend value
      const statusTranslationReverseMap = {
        [t("servicePackagePage.userStatuses.active")]: "active",
        [t("servicePackagePage.userStatuses.inactive")]: "inactive",
        [t("servicePackagePage.userStatuses.banned")]: "banned",
      };

      const response = await axiosInstance.get("/api/user-package", {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: search.trim() || undefined,
          package_id: packageFilter !== "All" ? packageFilter : undefined,
          segment: segment !== t("common.all") ? segmentMap[segment] : undefined,
          user_status: userStatus !== t("common.all") ? statusTranslationReverseMap[userStatus] : undefined,
          assigned_status: assignedStatus !== t("common.all") ? assignedStatus : undefined,
        },
      });

      if (response.data?.success) {
        setRawPackages(response.data.data || []);
        const mappedData = (response.data.data || []).map((pkg) => mapUserPackageData(pkg));

        // Fetch notes cho tất cả user packages
        const noteItems = mappedData.map((item) => ({
          target_type: "UserPackage",
          target_id: item.id,
        }));

        const notesMap = await fetchLatestNotesBatch(noteItems);

        // Merge notes vào data
        const dataWithNotes = mappedData.map((item) => {
          const noteKey = `UserPackage_${item.id}`;
          const note = notesMap.get(noteKey);
          return {
            ...item,
            note: note?.note || "",
            noteId: note?._id || null,
          };
        });

        setRows(dataWithNotes);
        setPagination(prev => ({
          ...prev,
          total: response.data.total,
          totalPages: response.data.pages
        }));
      } else {
        toast.error(response.data?.message || t("servicePackagePage.messages.fetchErrorGeneric"));
        setRows([]);
      }
    } catch (error) {
      console.error("Error fetching user packages:", error);
      toast.error(t("servicePackagePage.messages.fetchError"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mapUserPackageData, pagination.page, pagination.limit, search, packageFilter, segment, userStatus, assignedStatus, t]);

  useEffect(() => {
    fetchUserPackages();
  }, [fetchUserPackages]);

  // Fetch user statuses from backend on component mount
  useEffect(() => {
    const fetchUserStatuses = async () => {
      try {
        const response = await axiosInstance.get("/api/user-package/statuses");
        if (response.data?.success && Array.isArray(response.data.data)) {
          setUserStatusesList(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching user statuses:", error);
        // Fallback to empty list on error; UI will show just "All"
        setUserStatusesList([]);
      }
    };

    fetchUserStatuses();

    const fetchPackages = async () => {
      try {
        const res = await axiosInstance.get('/api/package');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setPackagesFromServer(res.data.data);
        }
      } catch (err) {
        console.error('Error fetching packages list:', err);
        setPackagesFromServer([]);
      }
    };

    fetchPackages();
  }, []);

  // Re-map data khi ngôn ngữ thay đổi
  useEffect(() => {
    if (rawPackages.length > 0) {
      const mappedData = rawPackages.map((pkg) => mapUserPackageData(pkg));

      // Fetch notes cho tất cả user packages
      const noteItems = mappedData.map((item) => ({
        target_type: "UserPackage",
        target_id: item.id,
      }));

      fetchLatestNotesBatch(noteItems).then((notesMap) => {
        const dataWithNotes = mappedData.map((item) => {
          const noteKey = `UserPackage_${item.id}`;
          const note = notesMap.get(noteKey);
          return {
            ...item,
            note: note?.note || "",
            noteId: note?._id || null,
          };
        });
        setRows(dataWithNotes);
      });

      // Reset filters về "All" khi đổi ngôn ngữ
      // setPackageFilter(t("common.all"));
      // setSegment(t("common.all"));
      // setUserStatus(t("common.all"));
      // setAssignedStatus(t("common.all"));
    }
  }, [i18n.language, rawPackages, mapUserPackageData, t]);

  // Helper function để map package name (giống như trong mapUserPackageData)
  const mapPackageNameForFilter = useCallback((name) => {
    if (!name) return "-";
    const lower = name.toLowerCase();
    if (lower.includes("chatbot ai")) return "Chatbot AI";
    if (lower.includes("chatbot")) return "Chatbot";
    return name;
  }, []);

  // Dynamic filters từ server: return list of {id, label}
  const packagesList = useMemo(() => {
    // Chỉ lấy từ server, không có fallback
    if (packagesFromServer && packagesFromServer.length > 0) {
      // Map package names và loại bỏ duplicate dựa trên mapped name
      const mappedMap = new Map(); // key: mapped label, value: {id, label}
      packagesFromServer.forEach(p => {
        const originalName = p.name || p.title || String(p._id);
        const mappedLabel = mapPackageNameForFilter(originalName);
        const pkgId = String(p._id || p.id);
        
        // Chỉ giữ lại package đầu tiên nếu có duplicate mapped label
        if (!mappedMap.has(mappedLabel)) {
          mappedMap.set(mappedLabel, { id: pkgId, label: mappedLabel });
        }
      });
      
      const arr = Array.from(mappedMap.values());
      arr.sort((a, b) => a.label.localeCompare(b.label));
      return [{ id: "All", label: t("common.all") }, ...arr];
    }
    // Nếu chưa có dữ liệu từ server, chỉ trả về "All"
    return [{ id: "All", label: t("common.all") }];
  }, [packagesFromServer, mapPackageNameForFilter, t]);

  // const filtered = useMemo(() => {
  //   const s = search.trim().toLowerCase();
  //   return rows.filter((row) => {
  //     // Search theo ID, userId, name, phone, email
  //     const matchSearch =
  //       !s ||
  //       row.id.toLowerCase().includes(s) ||
  //       (row.userId || "").toString().toLowerCase().includes(s) ||
  //       row.name.toLowerCase().includes(s) ||
  //       (row.phone || "").toLowerCase().includes(s) ||
  //       (row.email || "").toLowerCase().includes(s);

  //     // Lọc theo package (packageFilter stores package_id)
  //     const allValue = t("common.all");
  //     const matchPackage =
  //       packageFilter === "All" || packageFilter === allValue
  //         ? true
  //         : String(row.originalData?.package_id?._id || row.originalData?.package_id) === String(packageFilter);

  //     // Lọc theo segment
  //     const matchSegment = segment === "All" || segment === allValue ? true : row.segment === segment;

  //     // Lọc theo user status
  //     const matchUserStatus = userStatus === "All" || userStatus === allValue ? true : row.userStatus === userStatus;

  //     // Lọc theo assigned status
  //     const matchAssignedStatus =
  //       assignedStatus === "All" || assignedStatus === allValue
  //         ? true
  //         : assignedStatus === t("common.assigned")
  //           ? row.assignedStatus === t("common.assigned")
  //           : row.assignedStatus === t("common.unassigned");

  //     return (
  //       matchSearch && matchPackage && matchSegment && matchUserStatus && matchAssignedStatus
  //     );
  //   });
  // }, [search, packageFilter, segment, userStatus, assignedStatus, rows, t]);

  // Reset filter nếu giá trị không còn trong danh sách
  useEffect(() => {
    const allValue = t("common.all");
    const ids = packagesList.map(p => p.id);
    if (packageFilter !== "All" && packageFilter !== allValue && !ids.includes(packageFilter)) {
      setPackageFilter("All");
    }
  }, [packagesList, packageFilter, t]);

  return (
    <div className="cs-sp-page">
      <div className="cs-sp-toolbar">
        <div className="cs-sp-toolbar-left">
          <div className="cs-sp-filter-group">
            <label className="cs-sp-filter-label">{t("servicePackagePage.search")}</label>
            <div className="cs-sp-search">
              <input
                className="cs-sp-search-input"
                placeholder={t("servicePackagePage.searchPlaceholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              />
              <span className="cs-sp-search-icon">
                <Search size={16} />
              </span>
            </div>
          </div>

          <div className="cs-sp-filter-group">
            <label className="cs-sp-filter-label">{t("servicePackagePage.package")}</label>
            <div className="cs-sp-select-wrapper">
              <select
                className="cs-sp-select"
                value={packageFilter}
                onChange={(e) => {
                  setPackageFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                {packagesList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-sp-select-icon" />
            </div>
          </div>

          <div className="cs-sp-filter-group">
            <label className="cs-sp-filter-label">{t("servicePackagePage.segment")}</label>
            <div className="cs-sp-select-wrapper">
              <select
                className="cs-sp-select"
                value={segment}
                onChange={(e) => {
                  setSegment(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-sp-select-icon" />
            </div>
          </div>

          <div className="cs-sp-filter-group">
            <label className="cs-sp-filter-label">{t("servicePackagePage.userStatus")}</label>
            <div className="cs-sp-select-wrapper">
              <select
                className="cs-sp-select"
                value={userStatus}
                onChange={(e) => {
                  setUserStatus(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                {USER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-sp-select-icon" />
            </div>
          </div>

          <div className="cs-sp-filter-group">
            <label className="cs-sp-filter-label">{t("servicePackagePage.assignedStatus")}</label>
            <div className="cs-sp-select-wrapper">
              <select
                className="cs-sp-select"
                value={assignedStatus}
                onChange={(e) => {
                  setAssignedStatus(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                {ASSIGNED_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-sp-select-icon" />
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          {t("servicePackagePage.messages.loading")}
        </div>
      )}

      {!loading && (
        <div className="cs-sp-table">
          <div className="cs-sp-row cs-sp-header">
            <div className="cs-sp-col cs-sp-col-name">{t("servicePackagePage.columns.name")}</div>
            <div className="cs-sp-col cs-sp-col-phone">{t("servicePackagePage.columns.phone")}</div>
            <div className="cs-sp-col cs-sp-col-email">{t("servicePackagePage.columns.email")}</div>
            <div className="cs-sp-col cs-sp-col-package">{t("servicePackagePage.columns.package")}</div>
            <div className="cs-sp-col cs-sp-col-purchased">{t("servicePackagePage.columns.purchasedDate")}</div>
            <div className="cs-sp-col cs-sp-col-expired">{t("servicePackagePage.columns.expiredDate")}</div>
            <div className="cs-sp-col cs-sp-col-segment">{t("servicePackagePage.columns.segment")}</div>
            <div className="cs-sp-col cs-sp-col-user-status">{t("servicePackagePage.columns.userStatus")}</div>
            <div className="cs-sp-col cs-sp-col-assigned">{t("servicePackagePage.columns.assignedStatus")}</div>
            <div className="cs-sp-col cs-sp-col-note">{t("servicePackagePage.columns.note")}</div>
          </div>



          {rows.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              {t("servicePackagePage.messages.noData")}
            </div>
          ) : (
            rows.map((row) => (
              <div className="cs-sp-row" key={row.id}>
                <div className="cs-sp-col cs-sp-col-name">{row.name}</div>
                <div className="cs-sp-col cs-sp-col-phone">{row.phone || "-"}</div>
                <div className="cs-sp-col cs-sp-col-email">{row.email || "-"}</div>
                <div className="cs-sp-col cs-sp-col-package">{row.package}</div>
                <div className="cs-sp-col cs-sp-col-purchased">{row.purchasedDate}</div>
                <div className="cs-sp-col cs-sp-col-expired">{row.expiredDate}</div>
                <div className="cs-sp-col cs-sp-col-segment">{row.segment}</div>
                <div className="cs-sp-col cs-sp-col-user-status">
                  <span
                    className={`cs-sp-badge cs-sp-badge-${row.userStatusKey || "active"}`}
                  >
                    {row.userStatus}
                  </span>
                </div>
                <div className="cs-sp-col cs-sp-col-assigned">
                  {!row.salesmanId ? (
                    <button
                      className="cs-sp-assign-btn"
                      onClick={async () => {
                        const currentUserId = user?._id || user?.id;
                        if (!user || !currentUserId) {
                          toast.error(t("servicePackagePage.messages.userNotFound"));
                          return;
                        }

                        try {
                          await axiosInstance.put(`/api/user-package/${row.id}`, {
                            salesman_id: currentUserId,
                          });
                          toast.success(t("servicePackagePage.messages.assignSuccess"));
                          fetchUserPackages();
                        } catch (error) {
                          const errorMessage = error.response?.data?.message || error.message || t("servicePackagePage.messages.assignError");
                          toast.error(errorMessage);
                        }
                      }}
                      title={t("servicePackagePage.actions.assignTooltip")}
                    >
                      <UserPlus size={18} />
                    </button>
                  ) : row.salesmanId && (user?._id || user?.id) && String(row.salesmanId) === String(user._id || user.id) ? (
                    <button
                      className="cs-sp-assign-btn cs-sp-assigned-btn"
                      onClick={async () => {
                        try {
                          await axiosInstance.put(`/api/user-package/${row.id}`, {
                            salesman_id: null,
                          });
                          toast.success(t("servicePackagePage.messages.unassignSuccess"));
                          fetchUserPackages();
                        } catch (error) {
                          toast.error(error.response?.data?.message || error.message || t("servicePackagePage.messages.unassignError"));
                        }
                      }}
                      title={t("servicePackagePage.actions.unassignTooltip")}
                    >
                      <UserCheck size={18} />
                    </button>
                  ) : (
                    <span
                      className={`cs-sp-badge cs-sp-badge-assigned`}
                    >
                      {row.salesmanName || t("common.assigned")}
                    </span>
                  )}
                </div>
                <div className="cs-sp-col cs-sp-col-note">
                  <NoteEditor
                    targetType="UserPackage"
                    targetId={row.id}
                    initialNote={row.note || ""}
                    noteId={row.noteId}
                    placeholder={t("servicePackagePage.note.placeholder")}
                    disabled={
                      !(
                        row.salesmanId &&
                        currentUserId &&
                        String(row.salesmanId) === String(currentUserId)
                      )
                    }
                    disabledMessage={t("servicePackagePage.note.disabledMessage")}
                    onNoteSaved={() => {
                      fetchUserPackages();
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )
      }
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
    </div >
  );
}