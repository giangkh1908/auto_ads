import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import invoiceService from "../../../services/shop/invoiceService";
import "./Invoice.css";

export default function Invoice({ isOpen, onClose, transactionId }) {
  const { t, i18n } = useTranslation("admin");
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const invoiceRef = useRef(null);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current overflow value
      const originalOverflow = document.body.style.overflow;
      // Disable scroll
      document.body.style.overflow = "hidden";

      // Restore scroll when modal closes
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && transactionId) {
      fetchInvoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, transactionId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await invoiceService.getInvoiceByTransactionId(transactionId);
      if (response.success) {
        setInvoice(response.data);
      } else {
        toast.error(t("invoice.messages.loadError"));
      }
    } catch (error) {
      console.error("Error fetching invoice:", error);
      toast.error(t("invoice.messages.loadErrorGeneric"));
    } finally {
      setLoading(false);
    }
  };


  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;

    try {
      toast.loading(t("invoice.messages.generatingPDF"));

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
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

      const fileName = invoice?.invoice_number || `invoice-${transactionId}`;
      pdf.save(`${fileName}.pdf`);

      toast.dismiss();
      toast.success(t("invoice.messages.downloadSuccess"));
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.dismiss();
      toast.error(t("invoice.messages.downloadError"));
    }
  };

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

    // Map duration từ backend format sang hiển thị
    const durationMap = {
      "3months": {
        vi: "3 tháng",
        en: "3 months"
      },
      "6months": {
        vi: "6 tháng",
        en: "6 months"
      },
      "12months": {
        vi: "1 năm",
        en: "1 year"
      }
    };

    const currentLang = i18n.language || "vi";
    const langKey = currentLang === "en" ? "en" : "vi";

    return durationMap[duration]?.[langKey] || duration;
  };

  if (!isOpen) return null;

  return (
    <div className="invoice-overlay" onClick={onClose}>
      <div className="invoice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="invoice-header">
          <h2>{t("invoice.title")}</h2>
          <div className="invoice-actions">
            {invoice && (
              <button
                className="invoice-download-btn"
                onClick={handleDownloadPDF}
                title={t("invoice.download")}
              >
                <Download size={20} />
                {t("invoice.download")}
              </button>
            )}
            <button className="invoice-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="invoice-body">
          {loading ? (
            <div className="invoice-loading">{t("invoice.loading")}</div>
          ) : !invoice ? (
            <div className="invoice-error">{t("invoice.messages.notFound")}</div>
          ) : (
            <div className="invoice-content" ref={invoiceRef}>
              {/* Header */}
              <div className="invoice-title">
                <h1>{t("invoice.headerTitle")}</h1>
              </div>

              {/* Seller Information */}
              <div className="invoice-section">
                <h3>{t("invoice.sellerInfo.title")}</h3>
                <div className="invoice-info-grid">
                  <div>
                    <label>{t("invoice.sellerInfo.companyName")}</label>
                    <p>{invoice.seller_info?.company_name || "AAMS Platform Co., Ltd"}</p>
                  </div>
                  <div>
                    <label>{t("invoice.sellerInfo.address")}</label>
                    <p>{invoice.seller_info?.address || "Hoa Lac, Hanoi"}</p>
                  </div>
                </div>
              </div>

              {/* Buyer Information */}
              <div className="invoice-section">
                <h3>{t("invoice.buyerInfo.title")}</h3>
                <div className="invoice-info-grid">
                  <div>
                    <label>{t("invoice.buyerInfo.name")}</label>
                    <p>{invoice.buyer_info?.name || "-"}</p>
                  </div>
                  <div>
                    <label>{t("invoice.buyerInfo.email")}</label>
                    <p>{invoice.buyer_info?.email || "-"}</p>
                  </div>
                  <div>
                    <label>{t("invoice.buyerInfo.phone")}</label>
                    <p>{invoice.buyer_info?.phone || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="invoice-section">
                <h3>{t("invoice.invoiceDetails.title")}</h3>
                <div className="invoice-info-grid">
                  <div>
                    <label>{t("invoice.invoiceDetails.invoiceNo")}</label>
                    <p>{invoice.invoice_number || "-"}</p>
                  </div>
                  <div>
                    <label>{t("invoice.invoiceDetails.invoiceDate")}</label>
                    <p>{formatDate(invoice.invoice_details?.invoice_date)}</p>
                  </div>
                  <div>
                    <label>{t("invoice.invoiceDetails.transactionId")}</label>
                    <p>{invoice.transaction_id?.provider_ref || `TXN-${invoice.transaction_id?._id || "-"}`}</p>
                  </div>
                  <div>
                    <label>{t("invoice.invoiceDetails.paymentMethod")}</label>
                    <p>{invoice.invoice_details?.payment_method || "-"}</p>
                  </div>
                  <div>
                    <label>{t("invoice.invoiceDetails.paymentTime")}</label>
                    <p>{formatDateTime(invoice.invoice_details?.payment_time)}</p>
                  </div>
                  <div>
                    <label>{t("invoice.invoiceDetails.status")}</label>
                    <p>{invoice.invoice_details?.status === "PAID" ? t("invoice.status.paid") : invoice.invoice_details?.status}</p>
                  </div>
                </div>
              </div>

              {/* Service Details */}
              <div className="invoice-section">
                <h3>{t("invoice.serviceDetails.title")}</h3>
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>{t("invoice.serviceDetails.package")}</th>
                      <th>{t("invoice.serviceDetails.pages")}</th>
                      <th>{t("invoice.serviceDetails.employees")}</th>
                      <th>{t("invoice.serviceDetails.unitPrice")}</th>
                      <th>{t("invoice.serviceDetails.duration")}</th>
                      <th>{t("invoice.serviceDetails.subtotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{invoice.service_details?.package_name || "-"}</td>
                      <td>{invoice.service_details?.pages || 0}</td>
                      <td>{invoice.service_details?.employees || 0}</td>
                      <td>{formatCurrency(invoice.service_details?.unit_price || 0)} VND</td>
                      <td>{formatDuration(invoice.service_details?.duration)}</td>
                      <td>{formatCurrency(invoice.service_details?.subtotal || 0)} VND</td>
                    </tr>
                  </tbody>
                </table>
                {/* <div className="invoice-total">
                  <div className="invoice-total-row">
                    <span>{t("invoice.serviceDetails.grandTotal")}</span>
                    <span className="invoice-total-amount">
                      {formatCurrency(invoice.service_details?.grand_total || 0)} VND
                    </span>
                  </div>
                </div> */}
              </div>

              {/* Disclaimer */}
              <div className="invoice-disclaimer">
                <p>{t("invoice.disclaimer")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

