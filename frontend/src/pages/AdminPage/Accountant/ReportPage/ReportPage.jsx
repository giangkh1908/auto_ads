import { useMemo, useState } from "react";
import "./ReportPage.css";
import { ChevronDown } from "lucide-react";
import DateRangePicker from "../../../../components/common/DateRangePicker/DateRangePicker";

const PAYMENT_METHODS = ["All", "Momo", "VietQR"];

// Mock data demo UI – có thể thay bằng dữ liệu API sau
const MOCK_REPORTS = [
  {
    id: "r1",
    package: "Chatbot",
    totalRevenue: 15200000,
    numberOfTransactions: 30,
  },
  {
    id: "r2",
    package: "Chatbot AI",
    totalRevenue: 5400000,
    numberOfTransactions: 12,
  },
];

// Format số với dấu phẩy
const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export default function ReportPage() {
  const [rows] = useState(MOCK_REPORTS);
  const [paymentMethod, setPaymentMethod] = useState("All");
  const [dateRange, setDateRange] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      // Lọc theo payment method (nếu có trong data)
      const matchMethod = paymentMethod === "All" ? true : row.method === paymentMethod;

      // Lọc theo khoảng ngày (nếu có trong data)
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
          // Nếu có date trong row, filter theo date
          if (row.date) {
            const rowDate = row.date.split(" ")[0];
            const rowTs = parse(rowDate);
            if (rowTs) {
              if (fromTs && rowTs < fromTs) matchDate = false;
              if (toTs && rowTs > toTs) matchDate = false;
            }
          }
        }
      }

      return matchMethod && matchDate;
    });
  }, [paymentMethod, dateRange, rows]);

  // Tính tổng
  const totals = useMemo(() => {
    const totalRevenue = filtered.reduce((sum, row) => sum + (row.totalRevenue || 0), 0);
    const totalTransactions = filtered.reduce(
      (sum, row) => sum + (row.numberOfTransactions || 0),
      0
    );
    return { totalRevenue, totalTransactions };
  }, [filtered]);

  return (
    <div className="acc-report-page">
      <div className="acc-report-toolbar">
        <div className="acc-report-toolbar-left">
          <div className="acc-report-filter-group">
            <label className="acc-report-filter-label">Payment Method</label>
            <div className="acc-report-select-wrapper">
              <select
                className="acc-report-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="acc-report-select-icon" />
            </div>
          </div>

          <div className="acc-report-filter-group">
            <label className="acc-report-filter-label">Date Range</label>
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder="dd/mm/yyyy - dd/mm/yyyy"
            />
          </div>
        </div>
      </div>

      <div className="acc-report-table">
        <div className="acc-report-row acc-report-header">
          <div className="acc-report-col acc-report-col-package">Package</div>
          <div className="acc-report-col acc-report-col-revenue">Total Revenue</div>
          <div className="acc-report-col acc-report-col-transactions">Number of Transactions</div>
        </div>

        {filtered.map((row) => (
          <div className="acc-report-row" key={row.id}>
            <div className="acc-report-col acc-report-col-package">{row.package}</div>
            <div className="acc-report-col acc-report-col-revenue">
              {formatNumber(row.totalRevenue)}
            </div>
            <div className="acc-report-col acc-report-col-transactions">
              {formatNumber(row.numberOfTransactions)}
            </div>
          </div>
        ))}

        {/* Total Row */}
        <div className="acc-report-row acc-report-total">
          <div className="acc-report-col acc-report-col-package">
            <strong>TOTAL</strong>
          </div>
          <div className="acc-report-col acc-report-col-revenue">
            <strong>{formatNumber(totals.totalRevenue)}</strong>
          </div>
          <div className="acc-report-col acc-report-col-transactions">
            <strong>{formatNumber(totals.totalTransactions)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

