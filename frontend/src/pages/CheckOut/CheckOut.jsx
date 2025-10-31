import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CreditCard, Building2, Wallet, DollarSign } from "lucide-react";
import bankIcon from "../../assets/cknh.png";
import momoIcon from "../../assets/momo.png";
import "./CheckOut.css";

function CheckOut() {
  const location = useLocation();
  const navigate = useNavigate();
  const orderData = location.state?.orderData;

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState("bank");

  // Generate random order ID
  const [orderId] = useState(() => Math.floor(Math.random() * 900000 + 100000));

  // If no order data, redirect back
  if (!orderData) {
    setTimeout(() => navigate("/order"), 100);
    return null;
  }

  const handlePayment = () => {
    // Navigate to Bank transfer page if payment method is bank
    if (paymentMethod === "bank") {
      navigate("/checkout/bank", {
        state: {
          orderData,
          orderId,
        },
      });
      return;
    }

    // TODO: Implement other payment methods
    console.log("Processing payment with:", {
      orderId,
      paymentMethod,
      orderData,
    });
    alert("Tính năng thanh toán đang được phát triển!");
  };

  return (
    <div className="co-page-wrapper">
      <div className="co-container">
        {/* Order Info Card */}
        <div className="co-order-info">
          <h1 className="co-title">THÔNG TIN ĐƠN HÀNG</h1>
          <div className="co-order-details">
            <div className="co-order-row">
              <span className="co-order-label">Mã đơn:</span>
              <span className="co-order-value">{orderId}</span>
            </div>
            <div className="co-order-row">
              <span className="co-order-label">Tổng tiền:</span>
              <span className="co-order-price">
                {orderData.totalPrice.toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>
        </div>

        {/* Payment Methods Card */}
        <div className="co-payment-card">
          <h2 className="co-payment-title">Phương thức thanh toán</h2>

          <div className="co-payment-methods">
            {/* Bank Transfer */}
            <label className="co-payment-option">
              <input
                type="radio"
                name="payment"
                value="bank"
                checked={paymentMethod === "bank"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="co-payment-content">
                <div className="co-payment-info">
                  <div className="co-payment-name">CHUYỂN KHOẢN NGÂN HÀNG</div>
                  <div className="co-payment-desc">
                    Vui lòng chuyển khoản đúng cú pháp nội dung để được kích hoạt
                    đơn hàng tự động
                  </div>
                </div>
                <div className="co-payment-icon">
                  <img src={bankIcon} alt="Bank Icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            </label>

            {/* Visa/Mastercard */}
            <label className="co-payment-option">
              <input
                type="radio"
                name="payment"
                value="card"
                checked={paymentMethod === "card"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="co-payment-content">
                <div className="co-payment-info">
                  <div className="co-payment-name">Thẻ Visa / Master Việt Nam</div>
                  <div className="co-payment-desc">
                    Hỗ trợ các loại thẻ Visa mở tại Việt Nam
                  </div>
                </div>
                <div className="co-payment-icon co-payment-icon-cards">
                  <CreditCard size={40} />
                </div>
              </div>
            </label>

            {/* MoMo */}
            <label className="co-payment-option">
              <input
                type="radio"
                name="payment"
                value="momo"
                checked={paymentMethod === "momo"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="co-payment-content">
                <div className="co-payment-info">
                  <div className="co-payment-name">VÍ ĐIỆN TỬ MOMO</div>
                  <div className="co-payment-desc">Bạn cần có app Momo</div>
                </div>
                <div className="co-payment-icon co-payment-icon-momo">
                  <img src={momoIcon} alt="Momo Icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            </label>

            {/* PayPal */}
            <label className="co-payment-option">
              <input
                type="radio"
                name="payment"
                value="paypal"
                checked={paymentMethod === "paypal"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="co-payment-content">
                <div className="co-payment-info">
                  <div className="co-payment-name">THANH TOÁN QUA PAYPAL</div>
                  <div className="co-payment-desc">
                    Bạn cần có tài khoản ví điện tử Paypal
                  </div>
                </div>
                <div className="co-payment-icon co-payment-icon-paypal">
                  <DollarSign size={40} />
                </div>
              </div>
            </label>

            {/* Service Wallet */}
            <label className="co-payment-option">
              <input
                type="radio"
                name="payment"
                value="service"
                checked={paymentMethod === "service"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="co-payment-content">
                <div className="co-payment-info">
                  <div className="co-payment-name">VÍ DỊCH VỤ</div>
                  <div className="co-payment-desc">THANH TOÁN QUA VÍ DỊCH VỤ</div>
                </div>
                <div className="co-payment-icon co-payment-icon-service">
                  <Wallet size={40} />
                </div>
              </div>
            </label>
          </div>

          {/* Payment Button */}
          <button className="co-payment-btn" onClick={handlePayment}>
            THANH TOÁN
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckOut;

