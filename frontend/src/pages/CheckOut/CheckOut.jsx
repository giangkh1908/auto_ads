import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CreditCard, Building2, Wallet, DollarSign } from "lucide-react";
import bankIcon from "../../assets/cknh.png";
import momoIcon from "../../assets/momo.png";
import "./CheckOut.css";
import axiosInstance from "../../utils/axios.js";
import { STORAGE_KEYS } from "../../constants/app.constants";

function CheckOut() {
  const location = useLocation();
  const navigate = useNavigate();
  const orderData = location.state?.orderData;

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState("bank");

  const orderId = location.state?.orderId;

  // If no order data, redirect back
  if (!orderData) {
    setTimeout(() => navigate("/order"), 100);
    return null;
  }

  const handlePayment = async () => {
    try {
      // // 1. Gửi API tạo payment transaction
      // const response = await fetch("http://localhost:5001/api/payment-transactions", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     Authorization: `Bearer ${localStorage.getItem("token")}`,
      //   },
      //   body: JSON.stringify({
      //     package_id: orderData.packageId,
      //     amount: orderData.totalPrice,
      //     currency: "VND",
      //   }),
      // });

      // const result = await response.json();

      // if (!result.success) {
      //   alert("Không thể tạo giao dịch thanh toán!");
      //   return;
      // }

      // const paymentId = result.data._id; // ⬅ Chính là orderId thực tế trong DB

      // 2. Nếu payment method = bank → cập nhật method trong DB
      if (paymentMethod === "bank") {
        const res = await axiosInstance.patch(
          `http://localhost:5001/api/payment-transactions/${orderId}/set-method`,
          { method: "manual banking" },   // BODY
          // {
          //   headers: {
          //     Authorization: `Bearer ${localStorage.getItem("token")}`,
          //   },
          // }
        );
        const data = res.data;
        if (data.success) {
          // 3. Điều hướng sang trang bank kèm paymentId
          navigate("/checkout/bank", {
            state: {
              orderData,
              orderId, // ⬅ DÙNG ID THẬT TRONG DATABASE
            },
          });
        }

        return;
      }

      alert("Phương thức này đang được phát triển!");
    } catch (error) {
      console.error("Payment error:", error);
      alert("Có lỗi xảy ra khi xử lý thanh toán!");
    }
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
