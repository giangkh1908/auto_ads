import { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./ReportPage.css";
import { ChevronDown } from "lucide-react";
import DateRangePicker from "../../../../components/common/DateRangePicker/DateRangePicker";
import paymentTransactionService from "../../../../services/paymentTransactionService";
import { toast } from "sonner";

// Format số với dấu phẩy
const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Map package name
const mapPackageName = (name) => {
  if (!name) return "-";
  const lower = name.toLowerCase();
  if (lower.includes("chatbot ai")) return "Chatbot AI";
  if (lower.includes("chatbot")) return "Chatbot";
  return name;
};

// Map method từ DB sang UI
const methodMap = {
  momo: "Momo",
  vnpay: "VietQR",
  vietqr: "VietQR",
  "manual banking": "Manual Banking",
};

export default function ReportPage() {
  const { t, i18n } = useTranslation("admin");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(t("common.all"));
  const [dateRange, setDateRange] = useState("");

  // Fetch payment transactions from API
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // Chỉ lấy transactions thành công (success) để tính revenue
      const params = { 
        limit: 1000,
        status: "success" // Chỉ lấy transactions thành công
      };

      const response = await paymentTransactionService.getPaymentTransactions(
        params
      );

      if (response.success) {
        setTransactions(response.data || []);
      } else {
        toast.error(response.message || t("reportPage.messages.fetchErrorGeneric"));
        setTransactions([]);
      }
    } catch (error) {
      console.error("Error fetching transactions for report:", error);
      toast.error(t("reportPage.messages.fetchError"));
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Tính toán report data từ transactions
  const rows = useMemo(() => {
    // Filter transactions theo payment method và date range
    let filteredTransactions = transactions;

    // Filter theo payment method
    const allValue = t("common.all");
    if (paymentMethod !== "All" && paymentMethod !== allValue) {
      filteredTransactions = filteredTransactions.filter((txn) => {
        const method =
          methodMap[txn.method?.toLowerCase()] ||
          (txn.method?.toLowerCase().includes("bank")
            ? "Manual Banking"
            : txn.method) ||
          "-";
        return method === paymentMethod;
      });
    }

    // Filter theo date range
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
        filteredTransactions = filteredTransactions.filter((txn) => {
          const paymentDate = txn.payment_at || txn.created_at;
          if (!paymentDate) return false;
          const date = new Date(paymentDate);
          const dateTs = date.getTime();
          if (fromTs && dateTs < fromTs) return false;
          if (toTs && dateTs > toTs) return false;
          return true;
        });
      }
    }

    // Group by package và tính tổng
    const packageMap = new Map();

    filteredTransactions.forEach((txn) => {
      const pkg = txn.package_id || {};
      const packageName = mapPackageName(pkg.name || "Unknown");

      if (!packageMap.has(packageName)) {
        packageMap.set(packageName, {
          package: packageName,
          totalRevenue: 0,
          numberOfTransactions: 0,
        });
      }

      const report = packageMap.get(packageName);
      report.totalRevenue += txn.amount || 0;
      report.numberOfTransactions += 1;
    });

    // Convert Map to Array và sort theo package name
    return Array.from(packageMap.values()).sort((a, b) =>
      a.package.localeCompare(b.package)
    );
  }, [transactions, paymentMethod, dateRange, t]);

  // Dynamic payment methods list
  const methodsList = useMemo(() => {
    const methods = new Set();
    transactions.forEach((txn) => {
      const method =
        methodMap[txn.method?.toLowerCase()] ||
        (txn.method?.toLowerCase().includes("bank")
          ? "Manual Banking"
          : txn.method) ||
        "-";
      if (method && method !== "-") {
        methods.add(method);
      }
    });
    return [t("common.all"), ...Array.from(methods).sort()];
  }, [transactions, t]);

  // Reset filter khi đổi ngôn ngữ
  useEffect(() => {
    setPaymentMethod(t("common.all"));
  }, [i18n.language, t]);

  // Reset filter nếu giá trị không còn trong list
  useEffect(() => {
    const allValue = t("common.all");
    if (paymentMethod !== "All" && paymentMethod !== allValue && !methodsList.includes(paymentMethod)) {
      setPaymentMethod(allValue);
    }
  }, [methodsList, paymentMethod, t]);

  // Tính tổng
  const totals = useMemo(() => {
    const totalRevenue = rows.reduce((sum, row) => sum + (row.totalRevenue || 0), 0);
    const totalTransactions = rows.reduce(
      (sum, row) => sum + (row.numberOfTransactions || 0),
      0
    );
    return { totalRevenue, totalTransactions };
  }, [rows]);

  return (
    <div className="acc-report-page">
      <div className="acc-report-toolbar">
        <div className="acc-report-toolbar-left">
          <div className="acc-report-filter-group">
            <label className="acc-report-filter-label">{t("reportPage.paymentMethod")}</label>
            <div className="acc-report-select-wrapper">
              <select
                className="acc-report-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {methodsList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="acc-report-select-icon" />
            </div>
          </div>

          <div className="acc-report-filter-group">
            <label className="acc-report-filter-label">{t("reportPage.dateRange")}</label>
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder={t("reportPage.dateRangePlaceholder")}
            />
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          {t("reportPage.messages.loading")}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          {t("reportPage.messages.noData")}
        </div>
      )}

      <div className="acc-report-table">
        <div className="acc-report-row acc-report-header">
          <div className="acc-report-col acc-report-col-package">{t("reportPage.columns.package")}</div>
          <div className="acc-report-col acc-report-col-revenue">{t("reportPage.columns.totalRevenue")}</div>
          <div className="acc-report-col acc-report-col-transactions">{t("reportPage.columns.numberOfTransactions")}</div>
        </div>

        {rows.map((row, index) => (
          <div className="acc-report-row" key={row.package || index}>
            <div className="acc-report-col acc-report-col-package">{row.package}</div>
            <div className="acc-report-col acc-report-col-revenue">
              {formatNumber(row.totalRevenue)} VND
            </div>
            <div className="acc-report-col acc-report-col-transactions">
              {formatNumber(row.numberOfTransactions)}
            </div>
          </div>
        ))}

        {/* Total Row */}
        <div className="acc-report-row acc-report-total">
          <div className="acc-report-col acc-report-col-package">
            <strong>{t("reportPage.total")}</strong>
          </div>
          <div className="acc-report-col acc-report-col-revenue">
            <strong>{formatNumber(totals.totalRevenue)} VND</strong>
          </div>
          <div className="acc-report-col acc-report-col-transactions">
            <strong>{formatNumber(totals.totalTransactions)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

