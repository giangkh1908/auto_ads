import { useMemo, useState } from "react";
import "./ServicePackagePage.css";
import { Search, ChevronDown } from "lucide-react";

const PACKAGES = ["All", "Chatbot", "Chatbot AI"];
const SEGMENTS = ["All", "Expiring Soon", "Recently Expired", "New Signup", "No Issue"];
const USER_STATUSES = ["All", "Active", "Inactive", "Banned"];
const ASSIGNED_STATUSES = ["All", "Assigned", "Unassigned"];

// Mock data demo UI – có thể thay bằng dữ liệu API sau
const MOCK_SERVICE_PACKAGES = [
  {
    id: "sp1",
    name: "Vũ Quỳnh Lan",
    phone: "0909090909",
    email: "quynhlan@gmail.com",
    package: "Chatbot",
    purchasedDate: "01/08/2024",
    expiredDate: "01/09/2024",
    segment: "Expiring Soon",
    userStatus: "Active",
    assignedStatus: "Assigned",
    note: "Đã gọi warning.",
  },
  {
    id: "sp2",
    name: "Kim Hồng Giang",
    phone: "0122936534",
    email: "kimgiang@gmail.com",
    package: "Chatbot AI",
    purchasedDate: "22/07/2024",
    expiredDate: "22/08/2024",
    segment: "Recently Expired",
    userStatus: "Banned",
    assignedStatus: "Unassigned",
    note: "",
  },
  {
    id: "sp3",
    name: "Nguyễn Thành Long",
    phone: "0123456789",
    email: "longnthe171630@fpt.edu.vn",
    package: "Chatbot",
    purchasedDate: "11/10/2024",
    expiredDate: "11/11/2024",
    segment: "New Signup",
    userStatus: "Active",
    assignedStatus: "Unassigned",
    note: "Không nghe máy.",
  },
  {
    id: "sp4",
    name: "Hà Anh Tuấn",
    phone: "0123456789",
    email: "anhtuan@gmail.com",
    package: "Chatbot AI",
    purchasedDate: "04/09/2024",
    expiredDate: "04/10/2024",
    segment: "No Issue",
    userStatus: "Inactive",
    assignedStatus: "Unassigned",
    note: "Lỗi Service. Liên hệ Dev Team để trợ giúp.",
  },
];

export default function ServicePackagePage() {
  const [rows] = useState(MOCK_SERVICE_PACKAGES);
  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState("All");
  const [segment, setSegment] = useState("All");
  const [userStatus, setUserStatus] = useState("All");
  const [assignedStatus, setAssignedStatus] = useState("All");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((row) => {
      // Search theo ID, name, phone, email
      const matchSearch =
        !s ||
        row.id.toLowerCase().includes(s) ||
        row.name.toLowerCase().includes(s) ||
        (row.phone || "").toLowerCase().includes(s) ||
        (row.email || "").toLowerCase().includes(s);

      // Lọc theo package
      const matchPackage = packageFilter === "All" ? true : row.package === packageFilter;

      // Lọc theo segment
      const matchSegment = segment === "All" ? true : row.segment === segment;

      // Lọc theo user status
      const matchUserStatus = userStatus === "All" ? true : row.userStatus === userStatus;

      // Lọc theo assigned status
      const matchAssignedStatus =
        assignedStatus === "All" ? true : row.assignedStatus === assignedStatus;

      return (
        matchSearch && matchPackage && matchSegment && matchUserStatus && matchAssignedStatus
      );
    });
  }, [search, packageFilter, segment, userStatus, assignedStatus, rows]);

  return (
    <div className="cs-sp-page">
      <div className="cs-sp-toolbar">
        <div className="cs-sp-toolbar-left">
          <div className="cs-sp-filter-group">
            <label className="cs-sp-filter-label">Search</label>
            <div className="cs-sp-search">
              <input
                className="cs-sp-search-input"
                placeholder="ID, Name, Phone, Email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="cs-sp-search-icon">
                <Search size={16} />
              </span>
            </div>
          </div>

          <div className="cs-sp-filter-group">
            <label className="cs-sp-filter-label">Package</label>
            <div className="cs-sp-select-wrapper">
              <select
                className="cs-sp-select"
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value)}
              >
                {PACKAGES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-sp-select-icon" />
            </div>
          </div>

          <div className="cs-sp-filter-group">
            <label className="cs-sp-filter-label">Segment</label>
            <div className="cs-sp-select-wrapper">
              <select
                className="cs-sp-select"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
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
            <label className="cs-sp-filter-label">User Status</label>
            <div className="cs-sp-select-wrapper">
              <select
                className="cs-sp-select"
                value={userStatus}
                onChange={(e) => setUserStatus(e.target.value)}
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
            <label className="cs-sp-filter-label">Assigned Status</label>
            <div className="cs-sp-select-wrapper">
              <select
                className="cs-sp-select"
                value={assignedStatus}
                onChange={(e) => setAssignedStatus(e.target.value)}
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

      <div className="cs-sp-table">
        <div className="cs-sp-row cs-sp-header">
          <div className="cs-sp-col cs-sp-col-name">Name</div>
          <div className="cs-sp-col cs-sp-col-phone">Phone</div>
          <div className="cs-sp-col cs-sp-col-email">Email</div>
          <div className="cs-sp-col cs-sp-col-package">Package</div>
          <div className="cs-sp-col cs-sp-col-purchased">Purchased Date</div>
          <div className="cs-sp-col cs-sp-col-expired">Expired Date</div>
          <div className="cs-sp-col cs-sp-col-segment">Segment</div>
          <div className="cs-sp-col cs-sp-col-user-status">User Status</div>
          <div className="cs-sp-col cs-sp-col-assigned">Assigned Status</div>
          <div className="cs-sp-col cs-sp-col-note">Note</div>
        </div>

        {filtered.map((row) => (
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
                className={`cs-sp-badge cs-sp-badge-${row.userStatus.toLowerCase()}`}
              >
                {row.userStatus}
              </span>
            </div>
            <div className="cs-sp-col cs-sp-col-assigned">
              <span
                className={`cs-sp-badge cs-sp-badge-${
                  row.assignedStatus === "Assigned" ? "assigned" : "unassigned"
                }`}
              >
                {row.assignedStatus}
              </span>
            </div>
            <div className="cs-sp-col cs-sp-col-note">{row.note || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
