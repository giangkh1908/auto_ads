import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./PaymentManagement.css";
import { Search, ChevronDown, Check, X, FileText } from "lucide-react";
import DateRangePicker from "../../../../components/common/DateRangePicker/DateRangePicker";
import paymentTransactionService from "../../../../services/paymentTransactionService";
import { toast } from "sonner";
import ConfirmationPopup from "../../../../components/common/ConfirmationPopup/ConfirmationPopup";
import Invoice from "../../../../components/feature/Invoice/Invoice";

// Helper function để map transaction data từ DB sang format UI
// Lưu ý: Hàm này cần được di chuyển vào trong component để có thể sử dụng translation

export default function PaymentManagement() {
  const { t, i18n } = useTranslation("admin");
  const [rawTransactions, setRawTransactions] = useState([]); // Lưu raw data từ API để re-map khi đổi ngôn ngữ
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState(t("common.all"));
  const [methodFilter, setMethodFilter] = useState(t("common.all"));
  const [statusFilter, setStatusFilter] = useState(t("common.all"));
  const [dateRange, setDateRange] = useState("");

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
      rejected: t("paymentManagement.statuses.rejected"),
      initializing: t("paymentManagement.statuses.initializing"),
    };

    // Map method từ DB sang UI
    const methodMap = {
      momo: "Momo",
      vnpay: "VietQR",
      vietqr: "VietQR",
      "manual banking": "Manual Banking",
    };

    // Xác định note: nếu status là canceled/cancelled/rejected và có rejectReason thì hiển thị rejectReason
    const status = (txn.status || "").toLowerCase();
    const isCanceled = status === "canceled" || status === "cancelled" || status === "rejected";
    const note = isCanceled && txn.metadata?.rejectReason 
      ? txn.metadata.rejectReason 
      : txn.metadata?.note || "";

    return {
      id: txn._id,
      userId: user._id || txn.user_id?._id || txn.user_id || "-", // Lấy user_id (ObjectId) từ user đã populate
      name: user.full_name || "-", // Bắt buộc phải có
      phone: user.phone || "", // Có thể để trống
      email: user.email || "", // Có thể để trống
      transactionId: txn.provider_ref || `TXN-${txn._id}`, // Bắt buộc phải có
      package: pkg.name || "-", // Bắt buộc phải có
      amount: formattedAmount, // Bắt buộc phải có
      method: methodMap[txn.method?.toLowerCase()] || 
              (txn.method?.toLowerCase().includes("bank") ? "Manual Banking" : txn.method) || 
              "-", // Có thể để trống - fallback cho các biến thể banking
      paymentTime: formatDate(txn.payment_at || txn.created_at), // Bắt buộc phải có
      status: statusMap[status] || t("paymentManagement.statuses.pending"), // Map với giá trị đã translate
      statusOriginal: status, // Lưu status gốc để filter
      action: txn.status === "pending" ? t("paymentManagement.actions.approveReject") : txn.status === "success" ? t("paymentManagement.actions.viewInvoice") : "-",
      note: note, // Hiển thị rejectReason nếu status là canceled
    };
  }, [t]);

  const STATUSES = useMemo(() => [
    t("common.all"),
    t("paymentManagement.statuses.pending"),
    t("paymentManagement.statuses.success"),
    t("paymentManagement.statuses.failed"),
    t("paymentManagement.statuses.canceled"),
    t("paymentManagement.statuses.rejected"),
    t("paymentManagement.statuses.initializing"),
  ], [t]);
  
  // Get packages and methods lists
  const packagesList = useMemo(() => {
    const packages = new Set(transactions.map((txn) => txn.package).filter(Boolean));
    return [t("common.all"), ...Array.from(packages).sort()];
  }, [transactions, t]);

  const methodsList = useMemo(() => {
    const methods = new Set(transactions.map((txn) => txn.method).filter(Boolean));
    return [t("common.all"), ...Array.from(methods).sort()];
  }, [transactions, t]);
  
  // State cho confirmation popup
  const [confirmationPopup, setConfirmationPopup] = useState({
    isOpen: false,
    type: "approve", // "approve" | "reject"
    title: "",
    message: "",
    transaction: null,
    onConfirm: null,
    isLoading: false,
  });
  
  // State cho reject reason input
  const [rejectReason, setRejectReason] = useState("");
  // Ref để lưu giá trị rejectReason mới nhất (tránh closure issue)
  const rejectReasonRef = useRef("");
  // State cho invoice modal
  const [invoiceModal, setInvoiceModal] = useState({
    isOpen: false,
    transactionId: null,
  });
  
  // Cập nhật ref mỗi khi rejectReason thay đổi
  useEffect(() => {
    rejectReasonRef.current = rejectReason;
  }, [rejectReason]);

  // Fetch payment transactions from API
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      const allValue = t("common.all");
      // Convert translated status back to original status for API
      if (statusFilter !== "All" && statusFilter !== allValue) {
        // Find original status from translated value by comparing with STATUSES
        const statusIndex = STATUSES.indexOf(statusFilter);
        if (statusIndex > 0) {
          // Map index to original status
          const originalStatuses = ["pending", "success", "failed", "canceled", "rejected", "initializing"];
          const originalStatus = originalStatuses[statusIndex - 1]; // -1 because index 0 is "All"
          if (originalStatus) {
            params.status = originalStatus;
          }
        }
      }

      const response = await paymentTransactionService.getPaymentTransactions(
        params
      );

      if (response.success) {
        // Lưu raw data và map với translation hiện tại
        setRawTransactions(response.data);
        const mappedTransactions = response.data.map((txn) => mapTransactionData(txn));
        setTransactions(mappedTransactions);
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
  }, [statusFilter, t, mapTransactionData, STATUSES]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);
  
  // Re-map data khi ngôn ngữ thay đổi
  useEffect(() => {
    if (rawTransactions.length > 0) {
      const mappedTransactions = rawTransactions.map((txn) => mapTransactionData(txn));
      setTransactions(mappedTransactions);
      // Reset filters về "All" khi đổi ngôn ngữ
      setPackageFilter(t("common.all"));
      setMethodFilter(t("common.all"));
      setStatusFilter(t("common.all"));
    }
  }, [i18n.language, rawTransactions, mapTransactionData, t]);

  // Reset filter nếu giá trị không còn trong danh sách
  useEffect(() => {
    const allValue = t("common.all");
    if (packageFilter !== "All" && packageFilter !== allValue && !packagesList.includes(packageFilter)) {
      setPackageFilter(allValue);
    }
  }, [packagesList, packageFilter, t]);

  useEffect(() => {
    const allValue = t("common.all");
    if (methodFilter !== "All" && methodFilter !== allValue && !methodsList.includes(methodFilter)) {
      setMethodFilter(allValue);
    }
  }, [methodsList, methodFilter, t]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const pending = transactions.filter((txn) => txn.status === t("paymentManagement.statuses.pending")).length;
    const approved = transactions.filter((txn) => txn.status === t("paymentManagement.statuses.success")).length;
    const failed = transactions.filter((txn) => txn.status === t("paymentManagement.statuses.failed")).length;
    const cancelled = transactions.filter(
      (txn) => txn.status === t("paymentManagement.statuses.canceled")
    ).length;
    const rejected = transactions.filter(
      (txn) => txn.status === t("paymentManagement.statuses.rejected")
    ).length;
    const initializing = transactions.filter(
      (txn) => txn.status === t("paymentManagement.statuses.initializing")
    ).length;
    const total = transactions.length;
    return { pending, approved, failed, cancelled, rejected, initializing, total };
  }, [transactions, t]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return transactions.filter((txn) => {
      // Search theo ID, Name, Phone, Email, Transaction ID
      const matchSearch =
        !s ||
        txn.userId.toLowerCase().includes(s) ||
        txn.name.toLowerCase().includes(s) ||
        (txn.phone || "").toLowerCase().includes(s) ||
        (txn.email || "").toLowerCase().includes(s) ||
        txn.transactionId.toLowerCase().includes(s);

      // Lọc theo package (so sánh chính xác)
      const allValue = t("common.all");
      const matchPackage =
        packageFilter === "All" || packageFilter === allValue
          ? true 
          : txn.package === packageFilter || txn.package?.trim() === packageFilter?.trim();

      // Lọc theo payment method (so sánh chính xác)
      const matchMethod =
        methodFilter === "All" || methodFilter === allValue
          ? true 
          : txn.method === methodFilter || txn.method?.trim() === methodFilter?.trim();

      // Lọc theo status
      const matchStatus =
        statusFilter === "All" || statusFilter === allValue ? true : txn.status === statusFilter;

      // Lọc theo khoảng ngày
      let matchDate = true;
      if (dateRange.includes("-") && txn.paymentTime !== "-") {
        const [from, to] = dateRange.split("-").map((v) => v.trim());
        // Định dạng: dd/mm/yyyy
        const parse = (d) => {
          const [dd, mm, yyyy] = d.split("/").map((x) => parseInt(x));
          if (!dd || !mm || !yyyy) return null;
          return new Date(yyyy, mm - 1, dd).getTime();
        };
        const fromTs = parse(from);
        const toTs = parse(to);
        if (fromTs || toTs) {
          // So sánh với paymentTime (lấy phần ngày)
          const paymentDate = txn.paymentTime.split(" ")[0];
          const paymentTs = parse(paymentDate);
          if (paymentTs) {
            if (fromTs && paymentTs < fromTs) matchDate = false;
            if (toTs && paymentTs > toTs) matchDate = false;
          }
        }
      }
      return (
        matchSearch && matchPackage && matchMethod && matchStatus && matchDate
      );
    });
  }, [
    search,
    packageFilter,
    methodFilter,
    statusFilter,
    dateRange,
    transactions,
    t,
  ]);

  const handleAction = (transaction, actionType) => {
    if (actionType === "approve") {
      setRejectReason(""); // Reset reject reason
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
      setRejectReason(""); // Reset reject reason
      setConfirmationPopup({
        isOpen: true,
        type: "reject",
        title: t("paymentManagement.messages.confirmReject"),
        message: t("paymentManagement.messages.confirmRejectMessage", { 
          transactionId: transaction.transactionId, 
          name: transaction.name 
        }),
        transaction: transaction,
        onConfirm: () => {
          // Đọc rejectReason mới nhất từ state khi confirm được gọi
          handleRejectConfirm(transaction);
        },
        isLoading: false,
        showInput: true,
        inputLabel: t("paymentManagement.messages.rejectReasonLabel"),
        inputPlaceholder: t("paymentManagement.messages.rejectReasonPlaceholder"),
        inputValue: rejectReason,
        onInputChange: setRejectReason,
        inputRequired: true,
      });
    } else if (actionType === "view-invoice") {
      // Handle view invoice
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
      const response = await paymentTransactionService.approveTransaction(
        transaction.id
      );
      
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
      // Đọc rejectReason mới nhất từ ref (tránh closure issue)
      const note = rejectReasonRef.current || "";
      
      console.log("Rejecting transaction:", {
        transactionId: transaction.id,
        note: note,
        rejectReasonState: rejectReason,
        rejectReasonRef: rejectReasonRef.current,
      });
      
      const response = await paymentTransactionService.rejectTransaction(
        transaction.id,
        note
      );
      
      console.log("Reject response:", response);
      
      if (response.success) {
        toast.success(t("paymentManagement.messages.rejectSuccess"));
        setConfirmationPopup(prev => ({ ...prev, isOpen: false, isLoading: false }));
        setRejectReason(""); // Reset reject reason
        rejectReasonRef.current = ""; // Reset ref
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
      {/* Summary Statistics */}
      <div className="payment-mgmt-summary">
        <span>
          {t("paymentManagement.summary.pending")}: {summary.pending} | {t("paymentManagement.summary.approved")}: {summary.approved} | {t("paymentManagement.summary.failed")}:{" "}
          {summary.failed} | {t("paymentManagement.summary.canceled")}: {summary.cancelled} | {t("paymentManagement.summary.initializing")}:{" "}
          {summary.initializing} | {t("paymentManagement.summary.total")}: {summary.total}
        </span>
      </div>

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
                onChange={(e) => setPackageFilter(e.target.value)}
              >
                {packagesList.map((pkg) => (
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
                onChange={(e) => setMethodFilter(e.target.value)}
              >
                {methodsList.map((method) => (
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
                onChange={(e) => setStatusFilter(e.target.value)}
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
            onChange={(value) => setDateRange(value)}
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
          {/* <div className="payment-mgmt-col payment-mgmt-col-note">{t("paymentManagement.columns.note")}</div> */}
        </div>

        {filtered.map((transaction) => (
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
            {/* <div className="payment-mgmt-col payment-mgmt-col-note">
              {transaction.note || "-"}
            </div> */}
          </div>
        ))}
      </div>

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
        // Input field cho reject
        showInput={confirmationPopup.type === "reject"}
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
