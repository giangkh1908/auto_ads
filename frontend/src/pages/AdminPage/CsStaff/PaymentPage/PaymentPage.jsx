import { useMemo, useState } from "react";
import "./PaymentPage.css";
import { Search, ChevronDown } from "lucide-react";
import DateRangePicker from "../../../../components/common/DateRangePicker/DateRangePicker";

const PACKAGES = ["All", "Chatbot", "Chatbot AI"];
const PAYMENT_METHODS = ["All", "Momo", "VietQR"];
const STATUSES = ["All", "Pending", "Approved", "Rejected", "Failed", "Cancelled", "Success"];
const ASSIGNED_STATUSES = ["All", "Assigned", "Unassigned"];

// Mock data demo UI – có thể thay bằng dữ liệu API sau
const MOCK_PAYMENTS = [
  {
    id: "pay1",
    name: "Vũ Quỳnh Lan",
    phone: "0909090909",
    email: "quynhlan@gmail.com",
    package: "Chatbot",
    method: "Momo",
    paymentTime: "01/08/2024 10:30:45",
    status: "Success",
    assignedStatus: "Assigned",
    action: "View Invoice",
    note: "",
  },
  {
    id: "pay2",
    name: "Kim Hồng Giang",
    phone: "0122936534",
    email: "kimgiang@gmail.com",
    package: "Chatbot AI",
    method: "VietQR",
    paymentTime: "22/07/2024 09:15:20",
    status: "Failed",
    assignedStatus: "Unassigned",
    action: "-",
    note: "Đã liên hệ. Do số dư không đủ.",
  },
  {
    id: "pay3",
    name: "Nguyễn Thành Long",
    phone: "0123456789",
    email: "longnthe171630@fpt.edu.vn",
    package: "Chatbot",
    method: "VietQR",
    paymentTime: "11/10/2024 08:20:15",
    status: "Pending",
    assignedStatus: "",
    action: "-",
    note: "",
  },
  {
    id: "pay4",
    name: "Hà Anh Tuấn",
    phone: "0123456789",
    email: "anhtuan@gmail.com",
    package: "Chatbot AI",
    method: "Momo",
    paymentTime: "04/09/2024 13:45:30",
    status: "Success",
    assignedStatus: "",
    action: "View Invoice",
    note: "",
  },
  {
    id: "pay5",
    name: "Trọng Hưng",
    phone: "0123456789",
    email: "hungtrong@gmail.com",
    package: "Chatbot",
    method: "Momo",
    paymentTime: "-",
    status: "Cancelled",
    assignedStatus: "",
    action: "",
    note: "",
  },
];

export default function PaymentPage() {
  const [rows] = useState(MOCK_PAYMENTS);
  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("All");
  const [status, setStatus] = useState("All");
  const [assignedStatus, setAssignedStatus] = useState("All");
  const [dateRange, setDateRange] = useState("");

  // Tính toán counters
  const counters = useMemo(() => {
    const pending = rows.filter((r) => r.status === "Pending").length;
    const approved = rows.filter((r) => r.status === "Approved").length;
    const rejected = rows.filter((r) => r.status === "Rejected").length;
    const failed = rows.filter((r) => r.status === "Failed").length;
    const cancelled = rows.filter((r) => r.status === "Cancelled").length;
    const total = rows.length;
    return { pending, approved, rejected, failed, cancelled, total };
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((row) => {
      // Search theo ID, name, phone, email, transaction ID
      const matchSearch =
        !s ||
        row.id.toLowerCase().includes(s) ||
        row.transactionId.toLowerCase().includes(s) ||
        row.name.toLowerCase().includes(s) ||
        (row.phone || "").toLowerCase().includes(s) ||
        (row.email || "").toLowerCase().includes(s);

      // Lọc theo package
      const matchPackage = packageFilter === "All" ? true : row.package === packageFilter;

      // Lọc theo payment method
      const matchMethod = paymentMethod === "All" ? true : row.method === paymentMethod;

      // Lọc theo status
      const matchStatus = status === "All" ? true : row.status === status;

      // Lọc theo assigned status
      const matchAssignedStatus =
        assignedStatus === "All" ? true : row.assignedStatus === assignedStatus;

      // Lọc theo khoảng ngày
      let matchDate = true;
      if (dateRange.includes("-")) {
        const [from, to] = dateRange.split("-").map((v) => v.trim());
        const parse = (d) => {
          const [dd, mm, yyyy] = d.split("/").map((x) => parseInt(x));
          if (!dd || !mm || !yyyy) return null;
          return new Date(yyyy, mm - 1, dd).getTime();
        };
        const fromTs = parse(from);
        const toTs = parse(to);
        if (fromTs || toTs) {
          if (row.paymentTime && row.paymentTime !== "-") {
            const paymentDate = row.paymentTime.split(" ")[0];
            const paymentTs = parse(paymentDate);
            if (paymentTs) {
              if (fromTs && paymentTs < fromTs) matchDate = false;
              if (toTs && paymentTs > toTs) matchDate = false;
            }
          }
        }
      }

      return (
        matchSearch && matchPackage && matchMethod && matchStatus && matchAssignedStatus && matchDate
      );
    });
  }, [search, packageFilter, paymentMethod, status, assignedStatus, dateRange, rows]);

  return (
    <div className="cs-pay-page">
      {/* Summary Counters */}
      <div className="cs-pay-summary">
        <span className="cs-pay-summary-item">
          Pending: <strong>{counters.pending}</strong>
        </span>
        <span className="cs-pay-summary-item">
          Approved: <strong>{counters.approved}</strong>
        </span>
        <span className="cs-pay-summary-item">
          Rejected: <strong>{counters.rejected}</strong>
        </span>
        <span className="cs-pay-summary-item">
          Failed: <strong>{counters.failed}</strong>
        </span>
        <span className="cs-pay-summary-item">
          Cancelled: <strong>{counters.cancelled}</strong>
        </span>
        <span className="cs-pay-summary-item">
          Total: <strong>{counters.total}</strong>
        </span>
      </div>

      <div className="cs-pay-toolbar">
        <div className="cs-pay-toolbar-left">
          <div className="cs-pay-filter-group">
            <label className="cs-pay-filter-label">Search</label>
            <div className="cs-pay-search">
              <input
                className="cs-pay-search-input"
                placeholder="ID, Name, Phone, Email, Transaction ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="cs-pay-search-icon">
                <Search size={16} />
              </span>
            </div>
          </div>

          <div className="cs-pay-filter-group">
            <label className="cs-pay-filter-label">Package</label>
            <div className="cs-pay-select-wrapper">
              <select
                className="cs-pay-select"
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value)}
              >
                {PACKAGES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-pay-select-icon" />
            </div>
          </div>

          <div className="cs-pay-filter-group">
            <label className="cs-pay-filter-label">Payment Method</label>
            <div className="cs-pay-select-wrapper">
              <select
                className="cs-pay-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-pay-select-icon" />
            </div>
          </div>

          <div className="cs-pay-filter-group">
            <label className="cs-pay-filter-label">Status</label>
            <div className="cs-pay-select-wrapper">
              <select
                className="cs-pay-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-pay-select-icon" />
            </div>
          </div>

          <div className="cs-pay-filter-group">
            <label className="cs-pay-filter-label">Assigned Status</label>
            <div className="cs-pay-select-wrapper">
              <select
                className="cs-pay-select"
                value={assignedStatus}
                onChange={(e) => setAssignedStatus(e.target.value)}
              >
                {ASSIGNED_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="cs-pay-select-icon" />
            </div>
          </div>

          <div className="cs-pay-filter-group">
            <label className="cs-pay-filter-label">Date Range</label>
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder="dd/mm/yyyy - dd/mm/yyyy"
            />
          </div>
        </div>
      </div>

      <div className="cs-pay-table">
        <div className="cs-pay-row cs-pay-header">
          <div className="cs-pay-col cs-pay-col-name">Name</div>
          <div className="cs-pay-col cs-pay-col-phone">Phone</div>
          <div className="cs-pay-col cs-pay-col-email">Email</div>
          <div className="cs-pay-col cs-pay-col-package">Package</div>
          <div className="cs-pay-col cs-pay-col-method">Method</div>
          <div className="cs-pay-col cs-pay-col-time">Payment Time</div>
          <div className="cs-pay-col cs-pay-col-status">Status</div>
          <div className="cs-pay-col cs-pay-col-assigned">Assigned Status</div>
          <div className="cs-pay-col cs-pay-col-action">Action</div>
          <div className="cs-pay-col cs-pay-col-note">Note</div>
        </div>

        {filtered.map((row) => (
          <div className="cs-pay-row" key={row.id}>
            <div className="cs-pay-col cs-pay-col-name">{row.name}</div>
            <div className="cs-pay-col cs-pay-col-phone">{row.phone || "-"}</div>
            <div className="cs-pay-col cs-pay-col-email">{row.email || "-"}</div>
            <div className="cs-pay-col cs-pay-col-package">{row.package || "-"}</div>
            <div className="cs-pay-col cs-pay-col-method">{row.method}</div>
            <div className="cs-pay-col cs-pay-col-time">
              {row.paymentTime && row.paymentTime !== "-" ? (
                <>
                  <div>{row.paymentTime.split(" ")[0]}</div>
                  <div className="cs-pay-sub">{row.paymentTime.split(" ")[1]}</div>
                </>
              ) : (
                "-"
              )}
            </div>
            <div className="cs-pay-col cs-pay-col-status">
              <span className={`cs-pay-badge cs-pay-badge-${row.status.toLowerCase()}`}>
                {row.status}
              </span>
            </div>
            <div className="cs-pay-col cs-pay-col-assigned">
              {row.assignedStatus ? (
                <span
                  className={`cs-pay-badge cs-pay-badge-${
                    row.assignedStatus === "Assigned" ? "assigned" : "unassigned"
                  }`}
                >
                  {row.assignedStatus}
                </span>
              ) : (
                "-"
              )}
            </div>
            <div className="cs-pay-col cs-pay-col-action">
              {row.action && row.action !== "-" ? (
                <a href="#" className="cs-pay-link" onClick={(e) => e.preventDefault()}>
                  {row.action}
                </a>
              ) : (
                "-"
              )}
            </div>
            <div className="cs-pay-col cs-pay-col-note">{row.note || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
