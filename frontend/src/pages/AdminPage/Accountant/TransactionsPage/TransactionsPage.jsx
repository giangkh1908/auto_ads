import { useMemo, useState } from "react";
import "./TransactionsPage.css";
import { Search, ChevronDown } from "lucide-react";
import DateRangePicker from "../../../../components/common/DateRangePicker/DateRangePicker";

const PACKAGES = ["All", "Chatbot", "Chatbot AI"];
const PAYMENT_METHODS = ["All", "Momo", "VietQR"];
const STATUSES = ["All", "Pending", "Approved", "Rejected", "Failed", "Cancelled", "Success"];

// Mock data demo UI – có thể thay bằng dữ liệu API sau
const MOCK_TRANSACTIONS = [
  {
    id: "t1",
    name: "Vũ Quỳnh Lan",
    phone: "0909090909",
    email: "quynhlan@gmail.com",
    transactionId: "TXN-20240722-001",
    package: "Chatbot",
    amount: "1,200,000",
    method: "Momo",
    paymentTime: "01/08/2024 10:30:45",
    status: "Success",
    action: ["View Invoice", "Download"],
    remark: "",
  },
  {
    id: "t2",
    name: "Kim Hồng Giang",
    phone: "0122936534",
    email: "kimgiang@gmail.com",
    transactionId: "TXN-20240722-002",
    package: "Chatbot AI",
    amount: "1,500,000",
    method: "VietQR",
    paymentTime: "22/07/2024 09:15:20",
    status: "Failed",
    action: "-",
    remark: "",
  },
  {
    id: "t3",
    name: "Nguyễn Thành Long",
    phone: "0123456789",
    email: "longnthe171630@fpt.edu.vn",
    transactionId: "TXN-20241011-003",
    package: "Chatbot AI",
    amount: "12,000,000",
    method: "VietQR",
    paymentTime: "11/10/2024 08:20:15",
    status: "Pending",
    action: "-",
    remark: "",
  },
  {
    id: "t4",
    name: "Hà Anh Tuấn",
    phone: "0123456789",
    email: "anhtuan@gmail.com",
    transactionId: "TXN-20240904-004",
    package: "Chatbot AI",
    amount: "500,000",
    method: "Momo",
    paymentTime: "04/09/2024 13:45:30",
    status: "Success",
    action: ["View Invoice", "Download"],
    remark: "",
  },
  {
    id: "t5",
    name: "Nguyễn Trọng Hưng",
    phone: "0123456789",
    email: "hungtrong@gmail.com",
    transactionId: "TXN-20241015-005",
    package: "Chatbot",
    amount: "16,500,000",
    method: "Momo",
    paymentTime: "",
    status: "Cancelled",
    action: "-",
    remark: "",
  },
];

export default function TransactionsPage() {
  const [rows] = useState(MOCK_TRANSACTIONS);
  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("All");
  const [status, setStatus] = useState("All");
  const [dateRange, setDateRange] = useState("");

  // Tính toán counters
  const counters = useMemo(() => {
    const pending = rows.filter((r) => r.status === "Pending").length;
    const approved = rows.filter((r) => r.status === "Approved" || r.status === "Success").length;
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
        (row.transactionId || "").toLowerCase().includes(s) ||
        row.name.toLowerCase().includes(s) ||
        (row.phone || "").toLowerCase().includes(s) ||
        (row.email || "").toLowerCase().includes(s);

      // Lọc theo package
      const matchPackage = packageFilter === "All" ? true : row.package === packageFilter;

      // Lọc theo payment method
      const matchMethod = paymentMethod === "All" ? true : row.method === paymentMethod;

      // Lọc theo status
      const matchStatus = status === "All" ? true : row.status === status;

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
          if (row.paymentTime && row.paymentTime !== "") {
            const paymentDate = row.paymentTime.split(" ")[0];
            const paymentTs = parse(paymentDate);
            if (paymentTs) {
              if (fromTs && paymentTs < fromTs) matchDate = false;
              if (toTs && paymentTs > toTs) matchDate = false;
            }
          }
        }
      }

      return matchSearch && matchPackage && matchMethod && matchStatus && matchDate;
    });
  }, [search, packageFilter, paymentMethod, status, dateRange, rows]);

  return (
    <div className="acc-trans-page">
      <div className="acc-trans-toolbar">
        <div className="acc-trans-toolbar-left">
          <div className="acc-trans-filter-group">
            <label className="acc-trans-filter-label">Search</label>
            <div className="acc-trans-search">
              <input
                className="acc-trans-search-input"
                placeholder="ID, Name, Phone, Email, Transaction ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="acc-trans-search-icon">
                <Search size={16} />
              </span>
            </div>
          </div>

          <div className="acc-trans-filter-group">
            <label className="acc-trans-filter-label">Package</label>
            <div className="acc-trans-select-wrapper">
              <select
                className="acc-trans-select"
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value)}
              >
                {PACKAGES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="acc-trans-select-icon" />
            </div>
          </div>

          <div className="acc-trans-filter-group">
            <label className="acc-trans-filter-label">Payment Method</label>
            <div className="acc-trans-select-wrapper">
              <select
                className="acc-trans-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="acc-trans-select-icon" />
            </div>
          </div>

          <div className="acc-trans-filter-group">
            <label className="acc-trans-filter-label">Status</label>
            <div className="acc-trans-select-wrapper">
              <select
                className="acc-trans-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="acc-trans-select-icon" />
            </div>
          </div>

          <div className="acc-trans-filter-group">
            <label className="acc-trans-filter-label">Date Range</label>
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder="dd/mm/yyyy - dd/mm/yyyy"
            />
          </div>
        </div>

        <div className="acc-trans-toolbar-right">
          <div className="acc-trans-summary">
            <span className="acc-trans-summary-item">
              Pending: <strong>{counters.pending}</strong>
            </span>
            <span className="acc-trans-summary-separator">|</span>
            <span className="acc-trans-summary-item">
              Approved: <strong>{counters.approved}</strong>
            </span>
            <span className="acc-trans-summary-separator">|</span>
            <span className="acc-trans-summary-item">
              Rejected: <strong>{counters.rejected}</strong>
            </span>
            <span className="acc-trans-summary-separator">|</span>
            <span className="acc-trans-summary-item">
              Failed: <strong>{counters.failed}</strong>
            </span>
            <span className="acc-trans-summary-separator">|</span>
            <span className="acc-trans-summary-item">
              Cancelled: <strong>{counters.cancelled}</strong>
            </span>
            <span className="acc-trans-summary-separator">|</span>
            <span className="acc-trans-summary-item">
              Total: <strong>{counters.total}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="acc-trans-table">
        <div className="acc-trans-row acc-trans-header">
          <div className="acc-trans-col acc-trans-col-name">Name</div>
          <div className="acc-trans-col acc-trans-col-phone">Phone</div>
          <div className="acc-trans-col acc-trans-col-email">Email</div>
          <div className="acc-trans-col acc-trans-col-transaction-id">Transaction ID</div>
          <div className="acc-trans-col acc-trans-col-package">Package</div>
          <div className="acc-trans-col acc-trans-col-amount">Amount</div>
          <div className="acc-trans-col acc-trans-col-method">Method</div>
          <div className="acc-trans-col acc-trans-col-payment-time">Payment Time</div>
          <div className="acc-trans-col acc-trans-col-status">Status</div>
          <div className="acc-trans-col acc-trans-col-action">Action</div>
          <div className="acc-trans-col acc-trans-col-remark">Remark</div>
        </div>

        {filtered.map((row) => (
          <div className="acc-trans-row" key={row.id}>
            <div className="acc-trans-col acc-trans-col-name">{row.name}</div>
            <div className="acc-trans-col acc-trans-col-phone">{row.phone || "-"}</div>
            <div className="acc-trans-col acc-trans-col-email">{row.email || "-"}</div>
            <div className="acc-trans-col acc-trans-col-transaction-id">
              {row.transactionId || "-"}
            </div>
            <div className="acc-trans-col acc-trans-col-package">{row.package || "-"}</div>
            <div className="acc-trans-col acc-trans-col-amount">{row.amount}</div>
            <div className="acc-trans-col acc-trans-col-method">{row.method}</div>
            <div className="acc-trans-col acc-trans-col-payment-time">
              {row.paymentTime && row.paymentTime !== "" ? (
                <>
                  <div>{row.paymentTime.split(" ")[0]}</div>
                  <div className="acc-trans-sub">{row.paymentTime.split(" ")[1]}</div>
                </>
              ) : (
                "-"
              )}
            </div>
            <div className="acc-trans-col acc-trans-col-status">
              <span className={`acc-trans-badge acc-trans-badge-${row.status.toLowerCase()}`}>
                {row.status}
              </span>
            </div>
            <div className="acc-trans-col acc-trans-col-action">
              {Array.isArray(row.action) ? (
                <div className="acc-trans-action-links">
                  {row.action.map((act, idx) => (
                    <a
                      key={idx}
                      href="#"
                      className="acc-trans-link"
                      onClick={(e) => e.preventDefault()}
                    >
                      {act}
                    </a>
                  ))}
                </div>
              ) : row.action && row.action !== "-" ? (
                <a href="#" className="acc-trans-link" onClick={(e) => e.preventDefault()}>
                  {row.action}
                </a>
              ) : (
                "-"
              )}
            </div>
            <div className="acc-trans-col acc-trans-col-remark">{row.remark || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

