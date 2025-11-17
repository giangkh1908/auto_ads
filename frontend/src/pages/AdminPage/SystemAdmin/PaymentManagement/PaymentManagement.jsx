import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import "./PaymentManagement.css";
import { Search, ChevronDown, Check, X, FileText } from "lucide-react";
import DateRangePicker from "../../../../components/common/DateRangePicker/DateRangePicker";
import paymentTransactionService from "../../../../services/paymentTransactionService";
import { toast } from "sonner";
import ConfirmationPopup from "../../../../components/common/ConfirmationPopup/ConfirmationPopup";

const STATUSES = [
  "All",
  "Pending",
  "Success",
  "Failed",
  "Canceled",
  "Initializing",
];

// Helper function để map transaction data từ DB sang format UI
const mapTransactionData = (txn) => {
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

  // Map status từ lowercase sang uppercase với format đúng
  const statusMap = {
    pending: "Pending",
    success: "Success",
    failed: "Failed",
    canceled: "Canceled",
    cancelled: "Canceled",
    initializing: "Initializing",
  };

  // Map method từ DB sang UI
  const methodMap = {
    momo: "Momo",
    vnpay: "VietQR",
    vietqr: "VietQR",
    "manual banking": "Manual Banking",
  };

  // Xác định note: nếu status là canceled/cancelled và có rejectReason thì hiển thị rejectReason
  const status = (txn.status || "").toLowerCase();
  const isCanceled = status === "canceled" || status === "cancelled";
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
    status: statusMap[status] || txn.status || "Pending", // Bắt buộc phải có
    action: txn.status === "pending" ? "Approve/Reject" : txn.status === "success" ? "View Invoice" : "-",
    note: note, // Hiển thị rejectReason nếu status là canceled
  };
};

export default function PaymentManagement() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateRange, setDateRange] = useState(""); // format: "dd/mm/yyyy - dd/mm/yyyy"
  
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
  
  // Cập nhật ref mỗi khi rejectReason thay đổi
  useEffect(() => {
    rejectReasonRef.current = rejectReason;
  }, [rejectReason]);

  // Fetch payment transactions from API
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== "All") {
        params.status = statusFilter.toLowerCase();
      }

      const response = await paymentTransactionService.getPaymentTransactions(
        params
      );

      if (response.success) {
        // Map dữ liệu từ DB sang format UI
        const mappedTransactions = response.data.map(mapTransactionData);
        setTransactions(mappedTransactions);
      } else {
        toast.error(response.message || "Không thể tải danh sách giao dịch");
        setTransactions([]);
      }
    } catch (error) {
      console.error("Error fetching payment transactions:", error);
      toast.error("Lỗi khi tải danh sách giao dịch");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Lấy danh sách packages và methods động từ transactions
  const packagesList = useMemo(() => {
    const packages = new Set(transactions.map((t) => t.package).filter(Boolean));
    return ["All", ...Array.from(packages).sort()];
  }, [transactions]);

  const methodsList = useMemo(() => {
    const methods = new Set(transactions.map((t) => t.method).filter(Boolean));
    return ["All", ...Array.from(methods).sort()];
  }, [transactions]);

  // Reset filter nếu giá trị không còn trong danh sách
  useEffect(() => {
    if (packageFilter !== "All" && !packagesList.includes(packageFilter)) {
      setPackageFilter("All");
    }
  }, [packagesList, packageFilter]);

  useEffect(() => {
    if (methodFilter !== "All" && !methodsList.includes(methodFilter)) {
      setMethodFilter("All");
    }
  }, [methodsList, methodFilter]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const pending = transactions.filter((t) => t.status === "Pending").length;
    const approved = transactions.filter((t) => t.status === "Success").length;
    const failed = transactions.filter((t) => t.status === "Failed").length;
    const cancelled = transactions.filter(
      (t) => t.status === "Canceled"
    ).length;
    const initializing = transactions.filter(
      (t) => t.status === "Initializing"
    ).length;
    const total = transactions.length;
    return { pending, approved, failed, cancelled, initializing, total };
  }, [transactions]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return transactions.filter((t) => {
      // Search theo ID, Name, Phone, Email, Transaction ID
      const matchSearch =
        !s ||
        t.userId.toLowerCase().includes(s) ||
        t.name.toLowerCase().includes(s) ||
        (t.phone || "").toLowerCase().includes(s) ||
        (t.email || "").toLowerCase().includes(s) ||
        t.transactionId.toLowerCase().includes(s);

      // Lọc theo package (so sánh chính xác)
      const matchPackage =
        packageFilter === "All" 
          ? true 
          : t.package === packageFilter || t.package?.trim() === packageFilter?.trim();

      // Lọc theo payment method (so sánh chính xác)
      const matchMethod =
        methodFilter === "All" 
          ? true 
          : t.method === methodFilter || t.method?.trim() === methodFilter?.trim();

      // Lọc theo status
      const matchStatus =
        statusFilter === "All" ? true : t.status === statusFilter;

      // Lọc theo khoảng ngày
      let matchDate = true;
      if (dateRange.includes("-") && t.paymentTime !== "-") {
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
          const paymentDate = t.paymentTime.split(" ")[0];
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
  ]);

  const handleAction = (transaction, actionType) => {
    if (actionType === "approve") {
      setRejectReason(""); // Reset reject reason
      setConfirmationPopup({
        isOpen: true,
        type: "approve",
        title: "Xác nhận duyệt giao dịch",
        message: `Bạn có chắc chắn muốn duyệt giao dịch ${transaction.transactionId} của ${transaction.name}?`,
        transaction: transaction,
        onConfirm: () => handleApproveConfirm(transaction),
        isLoading: false,
      });
    } else if (actionType === "reject") {
      setRejectReason(""); // Reset reject reason
      setConfirmationPopup({
        isOpen: true,
        type: "reject",
        title: "Xác nhận từ chối giao dịch",
        message: `Bạn có chắc chắn muốn từ chối giao dịch ${transaction.transactionId} của ${transaction.name}?`,
        transaction: transaction,
        onConfirm: () => {
          // Đọc rejectReason mới nhất từ state khi confirm được gọi
          handleRejectConfirm(transaction);
        },
        isLoading: false,
      });
    } else if (actionType === "view-invoice") {
      // Handle view invoice
      console.log("Viewing invoice for transaction:", transaction.id);
      // TODO: Implement view invoice functionality
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
        toast.success("Đã duyệt giao dịch thành công");
        setConfirmationPopup(prev => ({ ...prev, isOpen: false, isLoading: false }));
        await fetchTransactions();
      } else {
        toast.error(response.message || "Không thể duyệt giao dịch");
        setConfirmationPopup(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Error approving transaction:", error);
      toast.error("Có lỗi xảy ra khi duyệt giao dịch");
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
        toast.success("Đã từ chối giao dịch");
        setConfirmationPopup(prev => ({ ...prev, isOpen: false, isLoading: false }));
        setRejectReason(""); // Reset reject reason
        rejectReasonRef.current = ""; // Reset ref
        await fetchTransactions();
      } else {
        toast.error(response.message || "Không thể từ chối giao dịch");
        setConfirmationPopup(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Error rejecting transaction:", error);
      toast.error("Có lỗi xảy ra khi từ chối giao dịch");
      setConfirmationPopup(prev => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <div className="payment-mgmt">
      {/* Summary Statistics */}
      <div className="payment-mgmt-summary">
        <span>
          Pending: {summary.pending} | Approved: {summary.approved} | Failed:{" "}
          {summary.failed} | Canceled: {summary.cancelled} | Initializing:{" "}
          {summary.initializing} | Total: {summary.total}
        </span>
      </div>

      {/* Toolbar */}
      <div className="payment-mgmt-toolbar">
        <div className="payment-mgmt-toolbar-left">
          <div className="payment-mgmt-filter-group">
            <label className="payment-mgmt-filter-label">Search</label>
            <div className="payment-mgmt-search">
              <input
                className="payment-mgmt-search-input"
                placeholder="Name, Phone, Email, Transaction ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="payment-mgmt-search-icon">
                <Search size={16} />
              </span>
            </div>
          </div>
          <div className="payment-mgmt-filter-group">
            <label className="payment-mgmt-filter-label">Package</label>
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
            <label className="payment-mgmt-filter-label">Payment Method</label>
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
            <label className="payment-mgmt-filter-label">Status</label>
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
            placeholder="dd/mm/yyyy - dd/mm/yyyy"
          />
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          Đang tải dữ liệu...
        </div>
      )}

      {/* Table */}
      <div className="payment-mgmt-table">
        <div className="payment-mgmt-row payment-mgmt-header">
          <div className="payment-mgmt-col payment-mgmt-col-userid">User ID</div>
          <div className="payment-mgmt-col payment-mgmt-col-name">Name</div>
          <div className="payment-mgmt-col payment-mgmt-col-phone">Phone</div>
          <div className="payment-mgmt-col payment-mgmt-col-email">Email</div>
          <div className="payment-mgmt-col payment-mgmt-col-transactionid">
            Transaction ID
          </div>
          <div className="payment-mgmt-col payment-mgmt-col-package">
            Package
          </div>
          <div className="payment-mgmt-col payment-mgmt-col-amount">Amount</div>
          <div className="payment-mgmt-col payment-mgmt-col-method">Method</div>
          <div className="payment-mgmt-col payment-mgmt-col-paymenttime">
            Payment Time
          </div>
          <div className="payment-mgmt-col payment-mgmt-col-status">Status</div>
          <div className="payment-mgmt-col payment-mgmt-col-action">Action</div>
          <div className="payment-mgmt-col payment-mgmt-col-note">Note</div>
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
                className={`payment-mgmt-badge payment-mgmt-badge-${transaction.status.toLowerCase()}`}
              >
                {transaction.status}
              </span>
            </div>
            <div className="payment-mgmt-col payment-mgmt-col-action">
              {transaction.status === "Pending" ? (
                <div className="payment-mgmt-action-buttons">
                  <button
                    className="payment-mgmt-action-btn payment-mgmt-action-approve"
                    onClick={() => handleAction(transaction, "approve")}
                    title="Approve"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    className="payment-mgmt-action-btn payment-mgmt-action-reject"
                    onClick={() => handleAction(transaction, "reject")}
                    title="Reject"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : transaction.status === "Success" ? (
                <button
                  className="payment-mgmt-action-btn payment-mgmt-action-view"
                  onClick={() => handleAction(transaction, "view-invoice")}
                  title="View Invoice"
                >
                  <FileText size={16} />
                </button>
              ) : (
                "-"
              )}
            </div>
            <div className="payment-mgmt-col payment-mgmt-col-note">
              {transaction.note || "-"}
            </div>
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
    </div>
  );
}
