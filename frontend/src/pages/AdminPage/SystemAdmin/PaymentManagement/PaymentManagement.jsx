
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./PaymentManagement.css";
import { Search, ChevronDown, Check, X, FileText } from "lucide-react";
import DateRangePicker from "../../../../components/common/DateRangePicker/DateRangePicker";
import paymentTransactionService from "../../../../services/paymentTransactionService";
import { toast } from "sonner";
import ConfirmationPopup from "../../../../components/common/ConfirmationPopup/ConfirmationPopup";
import Invoice from "../../../../components/feature/Invoice/Invoice";
import Pagination from "../../../../components/common/Pagination/Pagination";

export default function PaymentManagement() {
  const { t, i18n } = useTranslation("admin");
  const [rawTransactions, setRawTransactions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState(t("common.all"));
  const [methodFilter, setMethodFilter] = useState(t("common.all"));
  const [statusFilter, setStatusFilter] = useState(t("common.all"));
  const [dateRange, setDateRange] = useState("");

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Helper function để map transaction data từ DB sang format UI
  const mapTransactionData = useCallback((txn) => {
    const user = txn.user_id || {};
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
      const seconds = String(d.getSeconds()).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    // Map status từ lowercase sang translated format
    const statusMap = {
      pending: t("paymentManagement.statuses.pending"),
      success: t("paymentManagement.statuses.success"),
      failed: t("paymentManagement.statuses.failed"),
      canceled: t("paymentManagement.statuses.canceled"),
      cancelled: t("paymentManagement.statuses.canceled"),
      initializing: t("paymentManagement.statuses.initializing"),
    };

    // Map method từ DB sang UI
    const methodMap = {
      momo: "Momo",
      vnpay: "VNPay",
      vietqr: "VietQR",
      stripe: "Stripe",
      "manual banking": "Manual Banking",
    };

    const status = (txn.status || "").toLowerCase();
    const isCanceled = status === "canceled" || status === "cancelled";
    const note = isCanceled && txn.metadata?.rejectReason
      ? txn.metadata.rejectReason
      : txn.metadata?.note || "";

    return {
      id: txn._id,
      userId: user._id || txn.user_id?._id || txn.user_id || "-",
      name: user.full_name || "-",
      phone: user.phone || "",
      email: user.email || "",
      transactionId: txn.provider_ref || `TXN-${txn._id}`,
      package: pkg.name || "-",
      amount: formattedAmount,
      method: methodMap[txn.method?.toLowerCase()] ||
        (txn.method?.toLowerCase().includes("bank") ? "Manual Banking" : txn.method) ||
        "-",
      paymentTime: formatDate(txn.payment_at || txn.created_at),
      status: statusMap[status] || t("paymentManagement.statuses.pending"),
      statusOriginal: status,
      action: txn.status === "pending" ? t("paymentManagement.actions.approveReject") : txn.status === "success" ? t("paymentManagement.actions.viewInvoice") : "-",
      note: note,
    };
  }, [t]);

  const STATUSES = useMemo(() => [
    t("common.all"),
    t("paymentManagement.statuses.pending"),
    t("paymentManagement.statuses.success"),
    t("paymentManagement.statuses.failed"),
    t("paymentManagement.statuses.canceled"),
    t("paymentManagement.statuses.initializing"),
  ], [t]);

  // Hardcoded lists for filters (since we are doing server-side pagination, we can't derive from all data)
  // In a real app, these might come from another API endpoint
  const PACKAGES_LIST = [t("common.all"), "Chatbot", "Chatbot AI"];
  const METHODS_LIST = [t("common.all"), "VNPay", "Stripe", "Manual Banking"];

  // State cho confirmation popup
  const [confirmationPopup, setConfirmationPopup] = useState({
    isOpen: false,
    type: "approve",
    title: "",
    message: "",
    transaction: null,
    onConfirm: null,
    isLoading: false,
  });

  const [rejectReason, setRejectReason] = useState("");
  const rejectReasonRef = useRef("");
  const [invoiceModal, setInvoiceModal] = useState({
    isOpen: false,
    transactionId: null,
  });

  useEffect(() => {
    rejectReasonRef.current = rejectReason;
  }, [rejectReason]);

  // Fetch payment transactions from API
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
      };

      // Date range filter
      if (dateRange && dateRange.includes("-")) {
        const [startDate, endDate] = dateRange.split("-").map(d => d?.trim()).filter(Boolean);
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const allValue = t("common.all");

      // Status filter - Map translated status back to DB value
      if (statusFilter && statusFilter !== "All" && statusFilter !== allValue) {
        const statusMap = {
          [t("paymentManagement.statuses.pending")]: "pending",
          [t("paymentManagement.statuses.success")]: "success",
          [t("paymentManagement.statuses.failed")]: "failed",
          [t("paymentManagement.statuses.canceled")]: "canceled",
          [t("paymentManagement.statuses.initializing")]: "initializing",
        };
        const dbStatus = statusMap[statusFilter];
        if (dbStatus) {
          params.status = dbStatus;
        }
      }

      // Package filter - Send package name, backend will search by name
      if (packageFilter && packageFilter !== "All" && packageFilter !== allValue) {
        params.package_id = packageFilter; // Backend will handle name search (case-insensitive)
      }

      // Method filter - Map UI value to DB value
      if (methodFilter && methodFilter !== "All" && methodFilter !== allValue) {
        const methodMapToDB = {
          "VNPay": "vnpay",
          "Stripe": "stripe",
          "Manual Banking": "manual banking",
          "Momo": "momo",
          "VietQR": "vietqr"
        };
        params.method = methodMapToDB[methodFilter] || methodFilter.toLowerCase();
      }

      const response = await paymentTransactionService.getPaymentTransactions(params);

      if (response.success) {
        setRawTransactions(response.data);
        const mappedTransactions = response.data.map((txn) => mapTransactionData(txn));
        setTransactions(mappedTransactions);
        setPagination(prev => ({
          ...prev,
          total: response.total,
          totalPages: response.pages
        }));
      } else {
        toast.error(response.message || t("paymentManagement.messages.fetchErrorGeneric"));
        setTransactions([]);
      }
    } catch (error) {
      console.error("Error fetching payment transactions:", error);
      toast.error(t("paymentManagement.messages.fetchError"));
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter, packageFilter, methodFilter, dateRange, t, mapTransactionData]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Re-map data khi ngôn ngữ thay đổi (không reset filters để tránh ghi đè lựa chọn của người dùng)
  useEffect(() => {
    if (rawTransactions.length > 0) {
      const mappedTransactions = rawTransactions.map((txn) => mapTransactionData(txn));
      setTransactions(mappedTransactions);
      // Chỉ reset filters nếu chúng đang là giá trị mặc định (all)
      // Điều này tránh việc reset filters khi người dùng đang filter
    }
  }, [i18n.language, rawTransactions, mapTransactionData, t]);

  const handleAction = (transaction, actionType) => {
    if (actionType === "approve") {
      setRejectReason("");
      setConfirmationPopup({
        isOpen: true,
        type: "approve",
        title: t("paymentManagement.messages.confirmApprove"),
        message: t("paymentManagement.messages.confirmApproveMessage", {
          transactionId: transaction.transactionId,
          name: transaction.name
        }),
        transaction: transaction,
        onConfirm: () => handleApproveConfirm(transaction),
        isLoading: false,
      });
    } else if (actionType === "reject") {
      setRejectReason("");
      setConfirmationPopup({
        isOpen: true,
        type: "reject",
        title: t("paymentManagement.messages.confirmReject"),
        message: t("paymentManagement.messages.confirmRejectMessage", {
          transactionId: transaction.transactionId,
          name: transaction.name
        }),
        transaction: transaction,
        onConfirm: () => handleRejectConfirm(transaction),
        isLoading: false,
        showInput: true,
        inputLabel: t("paymentManagement.messages.rejectReasonLabel"),
        inputPlaceholder: t("paymentManagement.messages.rejectReasonPlaceholder"),
        inputValue: rejectReason,
        onInputChange: setRejectReason,
        inputRequired: true,
      });
    } else if (actionType === "view-invoice") {
      setInvoiceModal({
        isOpen: true,
        transactionId: transaction.id,
      });
    }
  };

  const handleApproveConfirm = async (transaction) => {
    if (!transaction) return;
    setConfirmationPopup(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await paymentTransactionService.approveTransaction(transaction.id);
      if (response.success) {
        toast.success(t("paymentManagement.messages.approveSuccess"));
        setConfirmationPopup(prev => ({ ...prev, isOpen: false, isLoading: false }));
        await fetchTransactions();
      } else {
        toast.error(response.message || t("paymentManagement.messages.approveError"));
        setConfirmationPopup(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Error approving transaction:", error);
      toast.error(t("paymentManagement.messages.approveErrorGeneric"));
      setConfirmationPopup(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRejectConfirm = async (transaction) => {
    if (!transaction) return;
    setConfirmationPopup(prev => ({ ...prev, isLoading: true }));
    try {
      const note = rejectReasonRef.current || "";
      const response = await paymentTransactionService.rejectTransaction(transaction.id, note);
      if (response.success) {
        toast.success(t("paymentManagement.messages.rejectSuccess"));
        setConfirmationPopup(prev => ({ ...prev, isOpen: false, isLoading: false }));
        setRejectReason("");
        rejectReasonRef.current = "";
        await fetchTransactions();
      } else {
        toast.error(response.message || t("paymentManagement.messages.rejectError"));
        setConfirmationPopup(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Error rejecting transaction:", error);
      toast.error(t("paymentManagement.messages.rejectErrorGeneric"));
      setConfirmationPopup(prev => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <div className="payment-mgmt">
      {/* Summary Statistics - Note: These are now only for the current page/filter or need a separate API for global stats */}
      {/* <div className="payment-mgmt-summary">
         Summary logic needs to be updated to fetch global stats from backend 
      </div> */}

      {/* Toolbar */}
      <div className="payment-mgmt-toolbar">
        <div className="payment-mgmt-toolbar-left">
          <div className="payment-mgmt-filter-group">
            <label className="payment-mgmt-filter-label">{t("paymentManagement.search")}</label>
            <div className="payment-mgmt-search">
              <input
                className="payment-mgmt-search-input"
                placeholder={t("paymentManagement.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="payment-mgmt-search-icon">
                <Search size={16} />
              </span>
            </div>
          </div>
          <div className="payment-mgmt-filter-group">
            <label className="payment-mgmt-filter-label">{t("paymentManagement.package")}</label>
            <div className="payment-mgmt-select-wrapper">
              <select
                className="payment-mgmt-select"
                value={packageFilter}
                onChange={(e) => {
                  setPackageFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                {PACKAGES_LIST.map((pkg) => (
                  <option key={pkg} value={pkg}>
                    {pkg}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="payment-mgmt-select-icon" />
            </div>
          </div>

          <div className="payment-mgmt-filter-group">
            <label className="payment-mgmt-filter-label">{t("paymentManagement.paymentMethod")}</label>
            <div className="payment-mgmt-select-wrapper">
              <select
                className="payment-mgmt-select"
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                {METHODS_LIST.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="payment-mgmt-select-icon" />
            </div>
          </div>

          <div className="payment-mgmt-filter-group">
            <label className="payment-mgmt-filter-label">{t("paymentManagement.status")}</label>
            <div className="payment-mgmt-select-wrapper">
              <select
                className="payment-mgmt-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="payment-mgmt-select-icon" />
            </div>
          </div>
        </div>

        <div className="payment-mgmt-toolbar-right">
          <DateRangePicker
            value={dateRange}
            onChange={(value) => {
              setDateRange(value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            placeholder={t("paymentManagement.dateRangePlaceholder")}
          />
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          {t("paymentManagement.messages.loading")}
        </div>
      )}

      {/* Table */}
      <div className="payment-mgmt-table">
        <div className="payment-mgmt-row payment-mgmt-header">
          <div className="payment-mgmt-col payment-mgmt-col-userid">{t("paymentManagement.columns.userId")}</div>
          <div className="payment-mgmt-col payment-mgmt-col-name">{t("paymentManagement.columns.name")}</div>
          <div className="payment-mgmt-col payment-mgmt-col-phone">{t("paymentManagement.columns.phone")}</div>
          <div className="payment-mgmt-col payment-mgmt-col-email">{t("paymentManagement.columns.email")}</div>
          <div className="payment-mgmt-col payment-mgmt-col-transactionid">
            {t("paymentManagement.columns.transactionId")}
          </div>
          <div className="payment-mgmt-col payment-mgmt-col-package">
            {t("paymentManagement.columns.package")}
          </div>
          <div className="payment-mgmt-col payment-mgmt-col-amount">{t("paymentManagement.columns.amount")}</div>
          <div className="payment-mgmt-col payment-mgmt-col-method">{t("paymentManagement.columns.method")}</div>
          <div className="payment-mgmt-col payment-mgmt-col-paymenttime">
            {t("paymentManagement.columns.paymentTime")}
          </div>
          <div className="payment-mgmt-col payment-mgmt-col-status">{t("paymentManagement.columns.status")}</div>
          <div className="payment-mgmt-col payment-mgmt-col-action">{t("paymentManagement.columns.action")}</div>
        </div>

        {!loading && transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            {t("paymentManagement.messages.noData")}
          </div>
        ) : (
          transactions.map((transaction) => (
            <div className="payment-mgmt-row" key={transaction.id}>
              <div className="payment-mgmt-col payment-mgmt-col-userid">
                {transaction.userId}
              </div>
              <div className="payment-mgmt-col payment-mgmt-col-name">
                {transaction.name}
              </div>
              <div className="payment-mgmt-col payment-mgmt-col-phone">
                {transaction.phone || "-"}
              </div>
              <div className="payment-mgmt-col payment-mgmt-col-email">
                {transaction.email || "-"}
              </div>
              <div className="payment-mgmt-col payment-mgmt-col-transactionid">
                {transaction.transactionId}
              </div>
              <div className="payment-mgmt-col payment-mgmt-col-package">
                {transaction.package || "-"}
              </div>
              <div className="payment-mgmt-col payment-mgmt-col-amount">
                {transaction.amount}
              </div>
              <div className="payment-mgmt-col payment-mgmt-col-method">
                {transaction.method}
              </div>
              <div className="payment-mgmt-col payment-mgmt-col-paymenttime">
                {transaction.paymentTime}
              </div>
              <div className="payment-mgmt-col payment-mgmt-col-status">
                <span
                  className={`payment-mgmt-badge payment-mgmt-badge-${transaction.statusOriginal || "pending"}`}
                >
                  {transaction.status}
                </span>
              </div>
              <div className="payment-mgmt-col payment-mgmt-col-action">
                {transaction.status === t("paymentManagement.statuses.pending") ? (
                  <div className="payment-mgmt-action-buttons">
                    <button
                      className="payment-mgmt-action-btn payment-mgmt-action-approve"
                      onClick={() => handleAction(transaction, "approve")}
                      title={t("paymentManagement.actions.approve")}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      className="payment-mgmt-action-btn payment-mgmt-action-reject"
                      onClick={() => handleAction(transaction, "reject")}
                      title={t("paymentManagement.actions.reject")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : transaction.status === t("paymentManagement.statuses.success") ? (
                  <button
                    className="payment-mgmt-action-btn payment-mgmt-action-view"
                    onClick={() => handleAction(transaction, "view-invoice")}
                    title={t("paymentManagement.actions.viewInvoice")}
                  >
                    <FileText size={16} />
                  </button>
                ) : (
                  "-"
                )}
              </div>
            </div>
          ))
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

      {/* Confirmation Popup */}
      <ConfirmationPopup
        isOpen={confirmationPopup.isOpen}
        onClose={() => {
          setConfirmationPopup(prev => ({ ...prev, isOpen: false }));
          setRejectReason("");
          rejectReasonRef.current = "";
        }}
        onConfirm={confirmationPopup.onConfirm}
        title={confirmationPopup.title}
        message={confirmationPopup.message}
        type={confirmationPopup.type}
        isLoading={confirmationPopup.isLoading}
        confirmText={confirmationPopup.type === "approve" ? "Duyệt" : "Từ chối"}
        cancelText="Hủy"
        // showInput={confirmationPopup.type === "reject"}
        inputLabel="Lý do từ chối"
        inputPlaceholder="Nhập lý do từ chối (tùy chọn)"
        inputValue={rejectReason}
        onInputChange={setRejectReason}
        inputRequired={false}
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