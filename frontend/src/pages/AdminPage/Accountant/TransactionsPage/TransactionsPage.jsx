import { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./TransactionsPage.css";
import { Search, ChevronDown, Eye, Download } from "lucide-react";
import DateRangePicker from "../../../../components/common/DateRangePicker/DateRangePicker";
import NoteEditor from "../../../../components/common/NoteEditor/NoteEditor";
import { fetchLatestNotesBatch } from "../../../../utils/noteUtils";
import paymentTransactionService from "../../../../services/paymentTransactionService";
import { toast } from "sonner";
import Invoice from "../../../../components/feature/Invoice/Invoice";
import invoiceService from "../../../../services/invoiceService";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function TransactionsPage() {
  const { t, i18n } = useTranslation("admin");
  
  // Helper function để map dữ liệu từ backend sang format UI
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
      pending: t("common.pending"),
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

    // Map package name
    const mapPackageName = (name) => {
      if (!name) return "-";
      const lower = name.toLowerCase();
      if (lower.includes("chatbot ai")) return "Chatbot AI";
      if (lower.includes("chatbot")) return "Chatbot";
      return name;
    };

    const status = (txn.status || "").toLowerCase();
    const remark = txn.metadata?.remark || txn.metadata?.note || "";

    // Xác định action dựa trên status
    const getAction = () => {
      if (status === "success") {
        return "invoice"; // Có invoice actions
      }
      if (status === "pending") {
        return "-";
      }
      return "-";
    };

    return {
      id: txn._id,
      transactionId: txn.provider_ref || `TXN-${txn._id}`,
      name: user.full_name || "-",
      phone: user.phone || "",
      email: user.email || "",
      package: mapPackageName(pkg.name),
      amount: formattedAmount,
      method:
        methodMap[txn.method?.toLowerCase()] ||
        (txn.method?.toLowerCase().includes("bank")
          ? "Manual Banking"
          : txn.method) ||
        "-",
      paymentTime: formatDate(txn.payment_at || txn.created_at),
      status: statusMap[status] || t("common.pending"),
      statusKey: status || "pending", // Lưu status gốc để dùng cho CSS class
      action: getAction(),
      remark: remark,
      note: "", // Sẽ được cập nhật sau khi fetch notes
      noteId: null, // Sẽ được cập nhật sau khi fetch notes
    };
  }, [t]);
  const [rawTransactions, setRawTransactions] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState(t("common.all"));
  const [paymentMethod, setPaymentMethod] = useState(t("common.all"));
  const [status, setStatus] = useState(t("common.all"));
  const [dateRange, setDateRange] = useState("");
  const [invoiceModal, setInvoiceModal] = useState({
    isOpen: false,
    transactionId: null,
  });

  // Function để download PDF trực tiếp mà không cần mở modal
  const handleDownloadInvoicePDF = useCallback(async (transactionId) => {
    try {
      toast.loading(t("invoice.messages.generatingPDF"));
      
      // Fetch invoice data
      const response = await invoiceService.getInvoiceByTransactionId(transactionId);
      if (!response.success || !response.data) {
        toast.error(t("invoice.messages.loadError"));
        return;
      }

      const invoice = response.data;
      
      // Tạo một div ẩn để render invoice
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.width = "900px";
      tempContainer.style.backgroundColor = "white";
      tempContainer.className = "invoice-content";
      document.body.appendChild(tempContainer);

      // Format functions
      const formatDate = (date) => {
        if (!date) return "-";
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const formatDateTime = (date) => {
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

      const formatCurrency = (amount) => {
        if (!amount) return "0";
        return new Intl.NumberFormat("vi-VN").format(amount);
      };

      const formatDuration = (duration) => {
        if (!duration) return "-";
        const durationMap = {
          "3months": { vi: "3 tháng", en: "3 months" },
          "6months": { vi: "6 tháng", en: "6 months" },
          "12months": { vi: "1 năm", en: "1 year" }
        };
        const currentLang = i18n.language || "vi";
        const langKey = currentLang === "en" ? "en" : "vi";
        return durationMap[duration]?.[langKey] || duration;
      };

      // Render invoice HTML
      tempContainer.innerHTML = `
        <div style="padding: 40px; font-family: Arial, sans-serif; color: #333;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
            <h1 style="margin: 0; font-size: 32px; font-weight: bold; text-transform: uppercase;">${t("invoice.headerTitle")}</h1>
          </div>

          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">${t("invoice.sellerInfo.title")}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.sellerInfo.companyName")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.seller_info?.company_name || "AAMS Platform Co., Ltd"}</p>
              </div>
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.sellerInfo.address")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.seller_info?.address || "Hoa Lac, Hanoi"}</p>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">${t("invoice.buyerInfo.title")}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.buyerInfo.name")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.buyer_info?.name || "-"}</p>
              </div>
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.buyerInfo.email")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.buyer_info?.email || "-"}</p>
              </div>
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.buyerInfo.phone")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.buyer_info?.phone || "-"}</p>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">${t("invoice.invoiceDetails.title")}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.invoiceDetails.invoiceNo")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.invoice_number || "-"}</p>
              </div>
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.invoiceDetails.invoiceDate")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${formatDate(invoice.invoice_details?.invoice_date)}</p>
              </div>
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.invoiceDetails.transactionId")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.transaction_id?.provider_ref || `TXN-${invoice.transaction_id?._id || "-"}`}</p>
              </div>
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.invoiceDetails.paymentMethod")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.invoice_details?.payment_method || "-"}</p>
              </div>
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.invoiceDetails.paymentTime")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${formatDateTime(invoice.invoice_details?.payment_time)}</p>
              </div>
              <div>
                <label style="font-weight: 600; margin-bottom: 5px; color: #666; font-size: 14px; display: block;">${t("invoice.invoiceDetails.status")}</label>
                <p style="margin: 0; padding: 8px; background-color: #f9f9f9; border-radius: 4px; min-height: 20px;">${invoice.invoice_details?.status === "PAID" ? t("invoice.status.paid") : invoice.invoice_details?.status}</p>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">${t("invoice.serviceDetails.title")}</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px;">
              <thead style="background-color: #f5f5f5;">
                <tr>
                  <th style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; font-weight: 600; color: #333;">${t("invoice.serviceDetails.package")}</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; font-weight: 600; color: #333;">${t("invoice.serviceDetails.pages")}</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; font-weight: 600; color: #333;">${t("invoice.serviceDetails.employees")}</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; font-weight: 600; color: #333;">${t("invoice.serviceDetails.unitPrice")}</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; font-weight: 600; color: #333;">${t("invoice.serviceDetails.duration")}</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; font-weight: 600; color: #333;">${t("invoice.serviceDetails.subtotal")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; background-color: #fff;">${invoice.service_details?.package_name || "-"}</td>
                  <td style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; background-color: #fff;">${invoice.service_details?.pages || 0}</td>
                  <td style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; background-color: #fff;">${invoice.service_details?.employees || 0}</td>
                  <td style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; background-color: #fff;">${formatCurrency(invoice.service_details?.unit_price || 0)} VND</td>
                  <td style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; background-color: #fff;">${formatDuration(invoice.service_details?.duration)}</td>
                  <td style="padding: 12px; text-align: left; border: 1px solid #e0e0e0; background-color: #fff;">${formatCurrency(invoice.service_details?.subtotal || 0)} VND</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 4px; font-size: 12px; color: #666; text-align: center; border-left: 4px solid #4caf50;">
            <p style="margin: 0;">${t("invoice.disclaimer")}</p>
          </div>
        </div>
      `;

      // Đợi một chút để đảm bảo HTML đã render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Convert to canvas and PDF
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
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
      
      // Cleanup
      document.body.removeChild(tempContainer);
      
      toast.dismiss();
      toast.success(t("invoice.messages.downloadSuccess"));
    } catch (error) {
      console.error("Error downloading invoice PDF:", error);
      toast.dismiss();
      toast.error(t("invoice.messages.downloadError"));
    }
  }, [t, i18n]);

  // Fetch payment transactions from API
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 1000 };
      const allValue = t("common.all");
      // Convert translated status back to original status for API
      if (status !== "All" && status !== allValue) {
        const statusIndex = [t("paymentManagement.statuses.pending"), t("paymentManagement.statuses.success"), t("paymentManagement.statuses.failed"), t("paymentManagement.statuses.canceled"), t("paymentManagement.statuses.rejected"), t("paymentManagement.statuses.initializing")].indexOf(status);
        if (statusIndex >= 0) {
          const originalStatuses = ["pending", "success", "failed", "canceled", "rejected", "initializing"];
          params.status = originalStatuses[statusIndex];
        }
      }

      const response = await paymentTransactionService.getPaymentTransactions(
        params
      );

      if (response.success) {
        setRawTransactions(response.data);
        const mappedTransactions = response.data.map((txn) => mapTransactionData(txn));

        // Fetch notes cho tất cả transactions
        const noteItems = mappedTransactions.map((transaction) => ({
          target_type: "Transaction",
          target_id: transaction.id,
        }));

        if (noteItems.length > 0) {
          const notesMap = await fetchLatestNotesBatch(noteItems);
          // Merge notes vào data
          const transactionsWithNotes = mappedTransactions.map((transaction) => {
            const noteKey = `Transaction_${transaction.id}`;
            const note = notesMap.get(noteKey);
            return {
              ...transaction,
              remark: note?.note || transaction.remark || "",
              note: note?.note || transaction.remark || "",
              noteId: note?._id || null,
            };
          });
          setRows(transactionsWithNotes);
        } else {
          setRows(mappedTransactions);
        }
      } else {
        toast.error(response.message || t("transactionsPage.messages.fetchErrorGeneric"));
        setRows([]);
      }
    } catch (error) {
      console.error("Error fetching payment transactions:", error);
      toast.error(t("transactionsPage.messages.fetchError"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, t, mapTransactionData]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Re-map data khi ngôn ngữ thay đổi
  useEffect(() => {
    if (rawTransactions.length > 0) {
      const mappedTransactions = rawTransactions.map((txn) => mapTransactionData(txn));
      
      // Fetch notes cho tất cả transactions
      const noteItems = mappedTransactions.map((transaction) => ({
        target_type: "Transaction",
        target_id: transaction.id,
      }));
      
      fetchLatestNotesBatch(noteItems).then((notesMap) => {
        const transactionsWithNotes = mappedTransactions.map((transaction) => {
          const noteKey = `Transaction_${transaction.id}`;
          const note = notesMap.get(noteKey);
          return {
            ...transaction,
            remark: note?.note || transaction.remark || "",
            note: note?.note || transaction.remark || "",
            noteId: note?._id || null,
          };
        });
        setRows(transactionsWithNotes);
      });
      
      // Reset filters về "All" khi đổi ngôn ngữ
      setPackageFilter(t("common.all"));
      setPaymentMethod(t("common.all"));
      setStatus(t("common.all"));
    }
  }, [i18n.language, rawTransactions, mapTransactionData, t]);

  // Dynamic filters
  const packagesList = useMemo(() => {
    const packages = new Set(rows.map((r) => r.package).filter(Boolean));
    return [t("common.all"), ...Array.from(packages).sort()];
  }, [rows, t]);

  const methodsList = useMemo(() => {
    const methods = new Set(rows.map((r) => r.method).filter(Boolean));
    return [t("common.all"), ...Array.from(methods).sort()];
  }, [rows, t]);

  const statusesList = useMemo(() => {
    const statuses = new Set(rows.map((r) => r.status).filter(Boolean));
    return [t("common.all"), ...Array.from(statuses).sort()];
  }, [rows, t]);

  // Reset filters nếu giá trị không còn trong list
  useEffect(() => {
    const allValue = t("common.all");
    if (packageFilter !== "All" && packageFilter !== allValue && !packagesList.includes(packageFilter)) {
      setPackageFilter(allValue);
    }
  }, [packagesList, packageFilter, t]);

  useEffect(() => {
    const allValue = t("common.all");
    if (paymentMethod !== "All" && paymentMethod !== allValue && !methodsList.includes(paymentMethod)) {
      setPaymentMethod(allValue);
    }
  }, [methodsList, paymentMethod, t]);

  useEffect(() => {
    const allValue = t("common.all");
    if (status !== "All" && status !== allValue && !statusesList.includes(status)) {
      setStatus(allValue);
    }
  }, [statusesList, status, t]);

  // Tính toán counters
  const counters = useMemo(() => {
    const pending = rows.filter((r) => r.status === t("common.pending")).length;
    const approved = rows.filter((r) => r.status === t("paymentManagement.statuses.success")).length;
    const rejected = rows.filter((r) => r.status === t("paymentManagement.statuses.rejected")).length;
    const failed = rows.filter((r) => r.status === t("paymentManagement.statuses.failed")).length;
    const cancelled = rows.filter((r) => r.status === t("paymentManagement.statuses.canceled")).length;
    const total = rows.length;
    return { pending, approved, rejected, failed, cancelled, total };
  }, [rows, t]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((row) => {
      // Search theo ID, name, phone, email, transaction ID
      const matchSearch =
        !s ||
        (row.id || "").toLowerCase().includes(s) ||
        (row.transactionId || "").toLowerCase().includes(s) ||
        (row.name || "").toLowerCase().includes(s) ||
        (row.phone || "").toLowerCase().includes(s) ||
        (row.email || "").toLowerCase().includes(s);

      // Lọc theo package
      const allValue = t("common.all");
      const matchPackage = packageFilter === "All" || packageFilter === allValue ? true : row.package === packageFilter;

      // Lọc theo payment method
      const matchMethod = paymentMethod === "All" || paymentMethod === allValue ? true : row.method === paymentMethod;

      // Lọc theo status
      const matchStatus = status === "All" || status === allValue ? true : row.status === status;

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
  }, [search, packageFilter, paymentMethod, status, dateRange, rows, t]);

  return (
    <div className="acc-trans-page">
      <div className="acc-trans-toolbar">
        <div className="acc-trans-toolbar-left">
          <div className="acc-trans-filter-group">
            <label className="acc-trans-filter-label">{t("transactionsPage.search")}</label>
            <div className="acc-trans-search">
              <input
                className="acc-trans-search-input"
                placeholder={t("transactionsPage.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="acc-trans-search-icon">
                <Search size={16} />
              </span>
            </div>
          </div>

          <div className="acc-trans-filter-group">
            <label className="acc-trans-filter-label">{t("transactionsPage.package")}</label>
            <div className="acc-trans-select-wrapper">
              <select
                className="acc-trans-select"
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value)}
              >
                {packagesList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="acc-trans-select-icon" />
            </div>
          </div>

          <div className="acc-trans-filter-group">
            <label className="acc-trans-filter-label">{t("transactionsPage.paymentMethod")}</label>
            <div className="acc-trans-select-wrapper">
              <select
                className="acc-trans-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {methodsList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="acc-trans-select-icon" />
            </div>
          </div>

          <div className="acc-trans-filter-group">
            <label className="acc-trans-filter-label">{t("transactionsPage.status")}</label>
            <div className="acc-trans-select-wrapper">
              <select
                className="acc-trans-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {statusesList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="acc-trans-select-icon" />
            </div>
          </div>

          <div className="acc-trans-filter-group">
            <label className="acc-trans-filter-label">{t("transactionsPage.dateRange")}</label>
            <DateRangePicker
              value={dateRange}
              onChange={(value) => setDateRange(value)}
              placeholder={t("transactionsPage.dateRangePlaceholder")}
            />
          </div>
        </div>

        <div className="acc-trans-toolbar-right">
          <div className="acc-trans-summary">
            <span className="acc-trans-summary-item">
              {t("transactionsPage.summary.pending")}: <strong>{counters.pending}</strong>
            </span>
            <span className="acc-trans-summary-separator">|</span>
            <span className="acc-trans-summary-item">
              {t("transactionsPage.summary.approved")}: <strong>{counters.approved}</strong>
            </span>
            <span className="acc-trans-summary-separator">|</span>
            <span className="acc-trans-summary-item">
              {t("transactionsPage.summary.rejected")}: <strong>{counters.rejected}</strong>
            </span>
            <span className="acc-trans-summary-separator">|</span>
            <span className="acc-trans-summary-item">
              {t("transactionsPage.summary.failed")}: <strong>{counters.failed}</strong>
            </span>
            <span className="acc-trans-summary-separator">|</span>
            <span className="acc-trans-summary-item">
              {t("transactionsPage.summary.cancelled")}: <strong>{counters.cancelled}</strong>
            </span>
            <span className="acc-trans-summary-separator">|</span>
            <span className="acc-trans-summary-item">
              {t("transactionsPage.summary.total")}: <strong>{counters.total}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          {t("transactionsPage.messages.loading")}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          {t("transactionsPage.messages.noData")}
        </div>
      )}

      <div className="acc-trans-table">
        <div className="acc-trans-row acc-trans-header">
          <div className="acc-trans-col acc-trans-col-name">{t("transactionsPage.columns.name")}</div>
          <div className="acc-trans-col acc-trans-col-phone">{t("transactionsPage.columns.phone")}</div>
          <div className="acc-trans-col acc-trans-col-email">{t("transactionsPage.columns.email")}</div>
          <div className="acc-trans-col acc-trans-col-transaction-id">{t("transactionsPage.columns.transactionId")}</div>
          <div className="acc-trans-col acc-trans-col-package">{t("transactionsPage.columns.package")}</div>
          <div className="acc-trans-col acc-trans-col-amount">{t("transactionsPage.columns.amount")}</div>
          <div className="acc-trans-col acc-trans-col-method">{t("transactionsPage.columns.method")}</div>
          <div className="acc-trans-col acc-trans-col-payment-time">{t("transactionsPage.columns.paymentTime")}</div>
          <div className="acc-trans-col acc-trans-col-status">{t("transactionsPage.columns.status")}</div>
          <div className="acc-trans-col acc-trans-col-action">{t("transactionsPage.columns.action")}</div>
          {/* <div className="acc-trans-col acc-trans-col-remark">{t("transactionsPage.columns.remark")}</div> */}
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
              <span className={`acc-trans-badge acc-trans-badge-${row.statusKey}`}>
                {row.status}
              </span>
            </div>
            <div className="acc-trans-col acc-trans-col-action">
              {row.action === "invoice" ? (
                <div className="acc-trans-action-buttons">
                  <button
                    className="acc-trans-action-btn acc-trans-action-view"
                    onClick={() => {
                      setInvoiceModal({
                        isOpen: true,
                        transactionId: row.id,
                        autoDownload: false,
                      });
                    }}
                    title={t("transactionsPage.actions.viewInvoice")}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    className="acc-trans-action-btn acc-trans-action-download"
                    onClick={() => handleDownloadInvoicePDF(row.id)}
                    title={t("transactionsPage.actions.download")}
                  >
                    <Download size={16} />
                  </button>
                </div>
              ) : row.action && row.action !== "-" ? (
                <span className="acc-trans-action-text">{row.action}</span>
              ) : (
                "-"
              )}
            </div>
            {/* <div className="acc-trans-col acc-trans-col-remark">
              <NoteEditor
                targetType="Transaction"
                targetId={row.id}
                initialNote={row.note || row.remark || ""}
                noteId={row.noteId}
                placeholder="Click để thêm ghi chú..."
                onNoteSaved={() => {
                  fetchTransactions();
                }}
              />
            </div> */}
          </div>
        ))}
      </div>

      {/* Invoice Modal */}
      <Invoice
        isOpen={invoiceModal.isOpen}
        onClose={() => setInvoiceModal({ isOpen: false, transactionId: null })}
        transactionId={invoiceModal.transactionId}
      />
    </div>
  );
}

