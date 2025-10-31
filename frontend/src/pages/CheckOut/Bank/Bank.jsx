import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Copy, Check } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import "./Bank.css";

function Bank() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const orderData = location.state?.orderData;
  const orderId = location.state?.orderId;
  // Countdown timer (10 minutes = 600 seconds)
  const [timeLeft, setTimeLeft] = useState(600);
  const [copiedField, setCopiedField] = useState("");

   // Get user identifier (phone or username)
   const userIdentifier = user?.phone || user?.username || user?.email || "USER";

  // Bank transfer details
  const bankDetails = {
    bankName: "VPBank",
    accountNumber: "0353383745",
    accountName: "Nguyễn Thành Long",
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
  const handleConfirm = () => {
    // TODO: Implement verification logic
    console.log("User confirmed bank transfer");
    alert("Cảm ơn bạn! Chúng tôi sẽ xác nhận thanh toán trong ít phút.");
    navigate("/dashboard");
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
          <h1 className="bk-title">Đặt hàng thành công</h1>
          <div className="bk-timer">
            Thời gian còn: <strong>{formatTime(timeLeft)}</strong> phút
          </div>
        </div>

        {/* Bank Transfer Info */}
        <div className="bk-info-card">
          <p className="bk-instruction">
            Vui lòng chuyển khoản theo thông tin:
          </p>

          <div className="bk-details">
            {/* Bank Name */}
            <div className="bk-detail-row">
              <span className="bk-detail-label">Ngân hàng</span>
              <span className="bk-detail-value bk-bank-name">
                {bankDetails.bankName}
              </span>
            </div>

            {/* Account Number */}
            <div className="bk-detail-row">
              <span className="bk-detail-label">Số tài khoản</span>
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
                  Copy
                </button>
              </div>
            </div>

            {/* Account Name */}
            <div className="bk-detail-row">
              <span className="bk-detail-label">Tên tài khoản</span>
              <span className="bk-detail-value">{bankDetails.accountName}</span>
            </div>

            {/* Transfer Content */}
            <div className="bk-detail-row">
              <span className="bk-detail-label">Nội dung</span>
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
                  Copy
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="bk-detail-row bk-amount-row">
              <span className="bk-detail-label">Số tiền</span>
              <span className="bk-amount">
                {bankDetails.amount.toLocaleString("vi-VN")} vnd
              </span>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="bk-qr-section">
          <p className="bk-qr-title">Hoặc quét mã QR để thanh toán</p>
          <div className="bk-qr-container">
            <div className="bk-qr-code">
              {/* VietQR image */}
              <img src={qrUrl} alt="VietQR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </div>
        </div>

        {/* Confirmation Section */}
        <div className="bk-confirm-section">
          <p className="bk-confirm-text">
            Sau khi chuyển khoản thành công,
            <br />
            bạn bấm vào nút bên dưới
          </p>
          <button className="bk-confirm-btn" onClick={handleConfirm}>
            TÔI ĐÃ CHUYỂN KHOẢN
          </button>
        </div>
      </div>
    </div>
  );
}

export default Bank;

