import { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./TransactionHistory.css";
import { Search, Download, Eye } from "lucide-react";
import DateRangePicker from "../../components/common/DateRangePicker/DateRangePicker";
import Pagination from "../../components/common/Pagination/Pagination";
import paymentTransactionService from "../../services/shop/paymentTransactionService";
import invoiceService from "../../services/shop/invoiceService";
import { toast } from "sonner";
import { useAuth } from "../../hooks/auth/useAuth";
import Invoice from "../../components/feature/Invoice/Invoice";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function TransactionHistory() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  // Helper function để map dữ liệu từ backend sang format UI
  const mapTransactionData = useCallback((txn) => {
    const pkg = txn.package_id || {};

    // Format amount
    const formattedAmount = txn.amount
      ? new Intl.NumberFormat("vi-VN").format(txn.amount) + " VND"
      : "-";

    // Format payment time
    const formatDate = (date) => {
      if (!date) return "-";
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    // Map status từ lowercase sang translated format
    const statusMap = {
      pending: t("common.pending"),
      success: t("paymentManagement.statuses.success") || "Success",
      failed: t("paymentManagement.statuses.failed") || "Failed",
      canceled: t("paymentManagement.statuses.canceled") || "Cancelled",
      cancelled: t("paymentManagement.statuses.canceled") || "Cancelled",
      rejected: t("paymentManagement.statuses.rejected") || "Rejected",
      initializing: t("paymentManagement.statuses.initializing") || "Initializing",
    };

    // Map method từ DB sang UI
    const methodMap = {
      momo: "Momo",
      vnpay: "VNPay",
      vietqr: "VietQR",
      stripe: "Stripe",
      zalopay: "ZaloPay",
      "manual banking": "Manual Banking",
    };

    // Map package name
    const mapPackageName = (name) => {
      if (!name) return "-";
      const lower = name.toLowerCase();
      if (lower.includes("chatbot ai")) return "Chatbot AI";
      if (lower.includes("chatbot")) return "Chatbot";
      return name;
    };

    const status = (txn.status || "").toLowerCase();

    return {
      id: txn._id,
      transactionId: txn.provider_ref || `TXN-${txn._id}`,
      package: mapPackageName(pkg.name),
      amount: formattedAmount,
      rawAmount: txn.amount || 0,
      method:
        methodMap[txn.method?.toLowerCase()] ||
        (txn.method?.toLowerCase()?.includes("bank")
          ? "Manual Banking"
          : txn.method) ||
        "-",
      createdAt: formatDate(txn.created_at),
      paymentTime: formatDate(txn.payment_at || txn.created_at),
      status: statusMap[status] || t("common.pending"),
      statusKey: status || "pending",
      canViewInvoice: status === "success",
    };
  }, [t]);

  const [rawTransactions, setRawTransactions] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [filterOptions, setFilterOptions] = useState({
    packages: [],
    methods: [],
    statuses: [],
  });
  const [invoiceModal, setInvoiceModal] = useState({
    isOpen: false,
    transactionId: null,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // Constants
  const STATUS_MAP = useMemo(() => ({
    pending: t("common.pending"),
    success: t("paymentManagement.statuses.success"),
    failed: t("paymentManagement.statuses.failed"),
    canceled: t("paymentManagement.statuses.canceled"),
    rejected: t("paymentManagement.statuses.rejected"),
    initializing: t("paymentManagement.statuses.initializing"),
  }), [t]);

  const METHOD_MAP = useMemo(() => ({
    momo: "Momo",
    vnpay: "VNPay",
    vietqr: "VietQR",
    stripe: "Stripe",
    zalopay: "ZaloPay",
    "manual banking": "Manual Banking",
  }), []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Tính toán summary statistics từ dữ liệu đã được filter từ server
  const summary = useMemo(() => {
    const pending = rows.filter((r) => r.status === STATUS_MAP.pending).length;
    const success = rows.filter((r) => r.status === STATUS_MAP.success).length;
    const rejected = rows.filter((r) => r.status === STATUS_MAP.rejected).length;
    const failed = rows.filter((r) => r.status === STATUS_MAP.failed).length;
    const cancelled = rows.filter((r) => r.status === STATUS_MAP.canceled).length;
    const total = pagination.total; // Sử dụng total từ server
    return { pending, success, rejected, failed, cancelled, total };
  }, [rows, pagination.total, STATUS_MAP]);

  // Map methods từ server sang UI format cho dropdown
  const methodsList = useMemo(() => {
    if (!filterOptions.methods || filterOptions.methods.length === 0) {
      return [];
    }
    return filterOptions.methods.map((m) => ({
      value: m,
      label: METHOD_MAP[(m || "").toLowerCase()] || m,
    }));
  }, [filterOptions.methods, METHOD_MAP]);

  // Function để download PDF
  const handleDownloadInvoicePDF = useCallback(async (transactionId) => {
    try {
      toast.loading(t("invoice.messages.generatingPDF") || "Đang tạo PDF...");

      const response = await invoiceService.getInvoiceByTransactionId(transactionId);
      if (!response.success || !response.data) {
        toast.error(t("invoice.messages.loadError") || "Không thể tải hóa đơn");
        return;
      }

      const invoice = response.data;

      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.width = "900px";
      tempContainer.style.backgroundColor = "white";
      tempContainer.className = "invoice-content";
      document.body.appendChild(tempContainer);

      tempContainer.innerHTML = `
        <div style="padding: 40px; font-family: Arial, sans-serif; color: #333;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
            <h1 style="margin: 0; font-size: 32px; font-weight: bold; text-transform: uppercase;">${t("invoice.headerTitle") || "HÓA ĐƠN"}</h1>
          </div>
          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">${t("invoice.buyerInfo.title") || "Thông tin người mua"}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.buyerInfo.name") || "Tên"}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.buyer_info?.name || "-"}</p>
              </div>
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.buyerInfo.email") || "Email"}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.buyer_info?.email || "-"}</p>
              </div>
            </div>
          </div>
          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">${t("invoice.invoiceDetails.title") || "Chi tiết hóa đơn"}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.invoiceDetails.invoiceNo") || "Số hóa đơn"}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.invoice_number || "-"}</p>
              </div>
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.invoiceDetails.transactionId") || "Mã giao dịch"}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.transaction_id?.provider_ref || `TXN-${invoice.transaction_id?._id || "-"}`}</p>
              </div>
            </div>
          </div>
        </div>
      `;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = invoice.invoice_number || `invoice-${transactionId}`;
      pdf.save(`${fileName}.pdf`);

      document.body.removeChild(tempContainer);

      toast.dismiss();
      toast.success(t("invoice.messages.downloadSuccess") || "Tải xuống thành công!");
    } catch (error) {
      console.error("Error downloading invoice PDF:", error);
      toast.dismiss();
      toast.error(t("invoice.messages.downloadError") || "Lỗi khi tải xuống");
    }
  }, [t]);

  // Fetch filter options từ API
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await paymentTransactionService.getFilterOptions();
        if (response.success) {
          setFilterOptions(response.data);
        }
      } catch (error) {
        console.error("Error fetching filter options:", error);
      }
    };
    fetchFilterOptions();
  }, []);

  // Fetch payment transactions from API
  const fetchTransactions = useCallback(async () => {
    if (!user?._id) {
      setRows([]);
      return;
    }

    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        user_id: user._id, // Filter theo user hiện tại
        search: debouncedSearch.trim() || undefined,
        package_id: packageFilter || undefined,
        status: statusFilter || undefined,
      };

      // Method filter - Map UI value to DB value
      if (paymentMethod) {
        const methodMapToDB = {
          "VNPay": "vnpay",
          "Stripe": "stripe",
          "Manual Banking": "manual banking",
          "Momo": "momo",
          "VietQR": "vietqr",
          "ZaloPay": "zalopay"
        };
        params.method = methodMapToDB[paymentMethod] || paymentMethod.toLowerCase();
      }

      // Date range filter
      if (dateRange && dateRange.includes("-")) {
        const [startDate, endDate] = dateRange.split("-").map(d => d?.trim()).filter(Boolean);
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const response = await paymentTransactionService.getPaymentTransactions(params);

      if (response.success) {
        // Filter out transactions with status "initializing" (Đang khởi tạo)
        const filteredData = response.data.filter(
          (txn) => (txn.status || "").toLowerCase() !== "initializing"
        );

        setRawTransactions(filteredData);
        const mappedTransactions = filteredData.map((txn) => mapTransactionData(txn));
        setRows(mappedTransactions);

        // Tính lại total và pages sau khi filter
        const filteredTotal = filteredData.length;
        setPagination(prev => ({
          ...prev,
          total: filteredTotal,
          totalPages: Math.ceil(filteredTotal / prev.limit)
        }));
      } else {
        toast.error(response.message || "Không thể tải lịch sử giao dịch");
        setRows([]);
      }
    } catch (error) {
      console.error("Error fetching payment transactions:", error);
      toast.error("Lỗi khi tải lịch sử giao dịch");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user, pagination.page, pagination.limit, debouncedSearch, packageFilter, paymentMethod, statusFilter, dateRange, mapTransactionData]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Re-map data khi ngôn ngữ thay đổi (không reset filters)
  useEffect(() => {
    if (rawTransactions.length > 0) {
      const mappedTransactions = rawTransactions.map((txn) => mapTransactionData(txn));
      setRows(mappedTransactions);
    }
  }, [i18n.language, mapTransactionData, rawTransactions]);

  return (
    <div className="transaction-history-page">
      <div className="transaction-history-header">
        <h1>{t("header.user_transaction") || "Lịch sử giao dịch"}</h1>
        <div className="transaction-summary">
          <span className="summary-item">
            {t("common.pending") || "Pending"}: <strong>{summary.pending}</strong>
          </span>
          <span className="summary-item">
            {t("paymentManagement.statuses.success") || "Success"}: <strong>{summary.success}</strong>
          </span>
          <span className="summary-item">
            {t("paymentManagement.statuses.rejected") || "Rejected"}: <strong>{summary.rejected}</strong>
          </span>
          <span className="summary-item">
            {t("paymentManagement.statuses.failed") || "Failed"}: <strong>{summary.failed}</strong>
          </span>
          <span className="summary-item">
            {t("paymentManagement.statuses.canceled") || "Cancelled"}: <strong>{summary.cancelled}</strong>
          </span>
          <span className="summary-item total">
            {t("common.total") || "Total"}: <strong>{summary.total}</strong>
          </span>
        </div>
      </div>

      <div className="transaction-filters">
        <div className="filter-group">
          <label className="filter-label">{t("transactionHistory.search")}</label>
          <div className="filter-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={t("transactionHistory.transactionId") || "Mã giao dịch"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="filter-input-transactions"
            />
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t("transactionHistory.packageName")}</label>
          <div className="filter-select-wrapper">
            <select
              value={packageFilter}
              onChange={(e) => {
                setPackageFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="filter-select-transactions"
            >
              <option value="">{t("common.all") || "All"}</option>
              {filterOptions.packages.map((pkg) => (
                <option key={pkg} value={pkg}>
                  {pkg}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t("transactionHistory.paymentMethod")}</label>
          <div className="filter-select-wrapper">
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="filter-select-transactions"
            >
              <option value="">{t("common.all") || "All"}</option>
              {methodsList.map((m) => (
                <option key={m.value} value={m.label}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t("transactionHistory.status")}</label>
          <div className="filter-select-wrapper">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="filter-select-transactions"
            >
              <option value="">{t("common.all") || "All"}</option>
              {filterOptions.statuses
                .filter((s) => s !== "initializing") // Ẩn status "initializing" khỏi dropdown
                .map((s) => {
                  const displayText = STATUS_MAP[s] || s;
                  return (
                    <option key={s} value={s}>
                      {displayText}
                    </option>
                  );
                })}
            </select>
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t("common.dateRange")}</label>
          <DateRangePicker
            value={dateRange}
            onChange={(value) => {
              setDateRange(value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            placeholder={"dd/mm/yyyy - dd/mm/yyyy"}
          />
        </div>
      </div>

      <div className="transaction-table-container">
        {loading ? (
          <div className="loading-state">
            <p>{t("common.loading") || "Đang tải..."}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <p>{t("common.noData") || "Không có dữ liệu"}</p>
          </div>
        ) : (
          <table className="transaction-table">
            <thead>
              <tr>
                <th>{t("transactionHistory.transactionId") || "Transaction ID"}</th>
                <th>{t("transactionHistory.packageName") || "Package Name"}</th>
                <th>{t("transactionHistory.amount") || "Amount"}</th>
                <th>{t("transactionHistory.paymentMethod") || "Payment Method"}</th>
                <th>{t("transactionHistory.status") || "Status"}</th>
                <th>{t("transactionHistory.createdAt") || "Created At"}</th>
                <th>{t("transactionHistory.action") || "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.transactionId}</td>
                  <td>{row.package}</td>
                  <td>{row.amount}</td>
                  <td>{row.method}</td>
                  <td>
                    <span className={`status-badge-transactions status-${row.statusKey}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.createdAt}</td>
                  <td>
                    {row.canViewInvoice ? (
                      <div className="action-buttons-transactions">
                        <button
                          className="action-btn-transactions view"
                          onClick={() => {
                            setInvoiceModal({
                              isOpen: true,
                              transactionId: row.id,
                            });
                          }}
                          title={t("transactionHistory.viewInvoice")}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="action-btn-transactions download"
                          onClick={() => handleDownloadInvoicePDF(row.id)}
                          title={t("transactionHistory.download")}
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* Invoice Modal */}
      <Invoice
        isOpen={invoiceModal.isOpen}
        onClose={() => setInvoiceModal({ isOpen: false, transactionId: null })}
        transactionId={invoiceModal.transactionId}
      />
    </div>
  );
}

