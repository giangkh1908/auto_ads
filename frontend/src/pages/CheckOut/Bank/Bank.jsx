import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Copy, Check } from "lucide-react";
import { useAuth } from "../../../hooks/auth/useAuth";
import "./Bank.css";
import axiosInstance from "../../../utils/api/axios.js";
import { toast } from "sonner";
import paymentTransactionService from "../../../services/shop/paymentTransactionService";
// import { STORAGE_KEYS } from "../../constants/app.constants";

function Bank() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const orderData = location.state?.orderData;
  const orderId = location.state?.orderId;
  // Countdown timer (10 minutes = 600 seconds)
  const [timeLeft, setTimeLeft] = useState(600);
  const [copiedField, setCopiedField] = useState("");
  const [isCanceled, setIsCanceled] = useState(false);
  const pollIntervalRef = useRef(null);
  const hasNavigatedRef = useRef(false);

  // Get user identifier (phone or username)
  const userIdentifier = user?.phone || user?.username || user?.email || "USER";

  // Bank transfer details
  const bankDetails = {
    bankName: "VPBank",
    accountNumber: "0353383745",
    accountName: "NGUYEN THANH LONG",
    transferContent: `FCHAT ${orderId} ${userIdentifier}`,
    amount: orderData?.totalPrice || 0,
  };

  // VietQR image URL (VPBank acqId: 970432)
  const bankId = "970432";
  const template = "compact"; // other options: 'qr_only', 'print'
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankDetails.accountNumber}-${template}.png?amount=${bankDetails.amount}&addInfo=${encodeURIComponent(
    bankDetails.transferContent
  )}&accountName=${encodeURIComponent(bankDetails.accountName)}`;

  // If no order data, redirect back
  useEffect(() => {
    if (!orderData || !orderId) {
      navigate("/order");
    }
  }, [orderData, orderId, navigate]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Poll transaction status to check if order was canceled
  useEffect(() => {
    if (!orderId || isCanceled || hasNavigatedRef.current) return;

    // Poll every 5 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await paymentTransactionService.getPaymentTransactionById(orderId);

        if (response.success && response.data) {
          const status = response.data.status;

          // If order is canceled, show toast and navigate
          if (status === "canceled" && !hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
            setIsCanceled(true);

            // Clear polling interval
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }

            // Show toast notification
            toast.error(
              t("bank.messages.timeout") ||
              "Đơn hàng đã bị hủy do hết thời gian thanh toán"
            );

            // Navigate to service-package page after 2 seconds
            setTimeout(() => {
              navigate("/service-package");
            }, 2000);
          }
        }
      } catch (error) {
        console.error("Error polling transaction status:", error);
        // Continue polling even if there's an error
      }
    }, 5000); // Check every 5 seconds

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [orderId, isCanceled, navigate, t]);

  // Format time (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Copy to clipboard
  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
  };

  // Handle confirmation
  const handleConfirm = async () => {
    try {
      // Gọi API xác nhận chuyển khoản
      const res = await axiosInstance.patch(
        `/api/payment-transactions/${orderId}/confirm-transfer`,
        {}, // body rỗng
        // {
        //   headers: {
        //     Authorization: `Bearer ${localStorage.getItem("token")}`,
        //   },
        // }
      );

      if (res.data.success) {
        toast.success(t("bank.messages.success"));
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Lỗi xác nhận chuyển khoản:", error);
      if (error.response?.status === 404) {
        toast.error(t("bank.messages.transactionNotFound"));
      } else if (error.response?.status === 401) {
        toast.error(t("bank.messages.sessionExpired"));
        navigate("/login");
      } else {
        toast.error(t("bank.messages.error"));
      }
    }
  };

  if (!orderData) return null;

  return (
    <div className="bk-page-wrapper">
      <div className="bk-container">
        {/* Success Header */}
        <div className="bk-header">
          <div className="bk-success-icon">
            <CheckCircle2 size={60} />
          </div>
          <h1 className="bk-title">{t("bank.title")}</h1>
          <div className="bk-timer">
            {t("bank.timer")} <strong>{formatTime(timeLeft)}</strong> {t("bank.timerUnit")}
          </div>
        </div>

        {/* Bank Transfer Info */}
        <div className="bk-info-card">
          <p className="bk-instruction">
            {t("bank.instruction")}
          </p>

          <div className="bk-details">
            {/* Bank Name */}
            <div className="bk-detail-row">
              <span className="bk-detail-label">{t("bank.labels.bankName")}</span>
              <span className="bk-detail-value bk-bank-name">
                {bankDetails.bankName}
              </span>
            </div>

            {/* Account Number */}
            <div className="bk-detail-row">
              <span className="bk-detail-label">{t("bank.labels.accountNumber")}</span>
              <div className="bk-detail-value-copy">
                <span className="bk-detail-value">
                  {bankDetails.accountNumber}
                </span>
                <button
                  className="bk-copy-btn"
                  onClick={() =>
                    handleCopy(bankDetails.accountNumber, "account")
                  }
                >
                  {copiedField === "account" ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                  {t("bank.buttons.copy")}
                </button>
              </div>
            </div>

            {/* Account Name */}
            <div className="bk-detail-row">
              <span className="bk-detail-label">{t("bank.labels.accountName")}</span>
              <span className="bk-detail-value">{bankDetails.accountName}</span>
            </div>

            {/* Transfer Content */}
            <div className="bk-detail-row">
              <span className="bk-detail-label">{t("bank.labels.content")}</span>
              <div className="bk-detail-value-copy">
                <span className="bk-detail-value bk-content-highlight">
                  {bankDetails.transferContent}
                </span>
                <button
                  className="bk-copy-btn"
                  onClick={() =>
                    handleCopy(bankDetails.transferContent, "content")
                  }
                >
                  {copiedField === "content" ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                  {t("bank.buttons.copy")}
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="bk-detail-row bk-amount-row">
              <span className="bk-detail-label">{t("bank.labels.amount")}</span>
              <span className="bk-amount">
                {bankDetails.amount.toLocaleString("vi-VN")} vnd
              </span>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="bk-qr-section">
          <p className="bk-qr-title">{t("bank.qr.title")}</p>
          <div className="bk-qr-container">
            <div className="bk-qr-code">
              {/* VietQR image */}
              <img src={qrUrl} alt="VietQR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </div>
        </div>

        {/* Confirmation Section */}
        <div className="bk-confirm-section">
          <p className="bk-confirm-text" dangerouslySetInnerHTML={{ __html: t("bank.confirm.text") }} />
          <button className="bk-confirm-btn" onClick={handleConfirm}>
            {t("bank.buttons.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Bank;
