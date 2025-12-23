import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CreditCard, Building2, Wallet, DollarSign } from "lucide-react";
import bankIcon from "../../assets/cknh.png";
import vnpayIcon from "../../assets/vnpay.jpg";
import "./CheckOut.css";
import axiosInstance from "../../utils/api/axios.js";
import { STORAGE_KEYS } from "../../constants/app.constants";
import { toast } from "sonner";

function CheckOut() {
  const { t } = useTranslation();
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
      if (paymentMethod === "vnpay") {
        const methodRes = await axiosInstance.patch(
          `/api/payment-transactions/${orderId}/set-method`,
          { method: "vnpay" }
        );

        if (!methodRes.data.success) {
          alert("Không thể chọn VNPay");
          return;
        }

        const vnpayRes = await axiosInstance.post(
          `/api/vnpay/${orderId}/create`,
          {
            orderData: {
              name: orderData.packageType,
              shops: orderData.shops,
              pages: orderData.pages,
              employees: orderData.employees,
              packagePricing: orderData.totalPrice,
              duration: orderData.duration,
            },
          }
        );

        if (vnpayRes.data?.success && vnpayRes.data?.paymentUrl) {
          window.location.href = vnpayRes.data.paymentUrl;
        } else {
          alert("Không thể tạo thanh toán VNPay");
        }
        return;
      }

      if (paymentMethod === "stripe") {
        const res = await axiosInstance.patch(
          `/api/payment-transactions/${orderId}/set-method`,
          { method: "stripe" },
        );
        const data = res.data;

        if (!data.success) {
          alert("Không thể cập nhật phương thức thanh toán");
          return;
        }

        // Gọi sang stripe để tạo session
        const sessionRes = await axiosInstance.post(
          `/api/stripe-transactions/${orderId}/create-checkout-session`,
          {
            orderData: {
              name: orderData.packageType,
              pages: orderData.pages,
              employees: orderData.employees,
              packagePricing: orderData.totalPrice,
              duration: orderData.duration,
            },
            successUrl: `${window.location.origin}/dashboard`,
            cancelUrl: `${window.location.origin}/dashboard`,
          },
        );
        const sessionData = sessionRes.data;
        if (sessionData.success && sessionData.data?.url) {
          // Chuyển hướng người dùng đến Stripe Checkout
          window.location.href = sessionData.data.url;
        } else {
          alert(sessionData.message || "Không thể tạo phiên thanh toán Stripe");
        }
        return;
      }

      //       if (paymentMethod === "zalopay") {
      //         // 1. Cập nhật method
      //         const methodRes = await axiosInstance.patch(
      //           `/api/payment-transactions/${orderId}/set-method`,
      //           { method: "zalopay" }
      //         );

      //         if (!methodRes.data.success) {
      //           alert("Không thể cập nhật phương thức");
      //           return;
      //         }

      //         // 2. Tạo ZaloPay order
      //         const zaloRes = await axiosInstance.post(
      //           `/api/zalo-pay/${orderId}/create`,
      //           {
      //             orderData: {
      //               name: orderData.packageType,
      //               pages: orderData.pages,
      //               employees: orderData.employees,
      //               packagePricing: orderData.totalPrice,
      // duration: orderData.duration,
      //             },
      //           }
      //         );

      //         const zaloData = zaloRes.data;
      //         if (zaloData.success && zaloData.data?.orderUrl) {
      //           // Redirect đến ZaloPay
      //           window.location.href = zaloData.data.orderUrl;
      //         } else {
      //           alert(zaloData.message || "Không thể tạo thanh toán ZaloPay");
      //         }
      //         return;
      //       }

      if (paymentMethod === "bank") {
        const res = await axiosInstance.patch(
          `/api/payment-transactions/${orderId}/set-method`,
          { method: "manual banking" }
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
      toast.error(t("checkout.messages.methodInDevelopment"));
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(t("checkout.messages.paymentError"));
    }
  };

  return (
    <div className="co-page-wrapper">
      <div className="co-container">
        {/* Order Info Card */}
        <div className="co-order-info">
          <h1 className="co-title">{t("checkout.title")}</h1>
          <div className="co-order-details">
            <div className="co-order-row">
              <span className="co-order-label">{t("checkout.orderId")}</span>
              <span className="co-order-value">{orderId}</span>
            </div>
            <div className="co-order-row">
              <span className="co-order-label">{t("checkout.total")}</span>
              <span className="co-order-price">
                {orderData.totalPrice.toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>
        </div>

        {/* Payment Methods Card */}
        <div className="co-payment-card">
          <h2 className="co-payment-title">{t("checkout.paymentTitle")}</h2>

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
                  <div className="co-payment-name">
                    {t("checkout.methods.bank.name")}
                  </div>
                  <div className="co-payment-desc">
                    {t("checkout.methods.bank.description")}
                  </div>
                </div>
                <div className="co-payment-icon">
                  <img
                    src={bankIcon}
                    alt="Bank Icon"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>
              </div>
            </label>

            <label className="co-payment-option">
              <input
                type="radio"
                name="payment"
                value="vnpay"
                checked={paymentMethod === "vnpay"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="co-payment-content">
                <div className="co-payment-info">
                  <div className="co-payment-name">{t("checkout.methods.vnpay.name")}</div>
                  <div className="co-payment-desc">{t("checkout.methods.vnpay.description")}</div>
                </div>
                <div className="co-payment-icon co-payment-icon-vnpay">
                  <img
                    src={vnpayIcon}
                    alt="VNPay Icon"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: "12px",
                    }}
                  />
                </div>
              </div>
            </label>

            {/* Stripe */}
            {/* <label className="co-payment-option">
              <input
                type="radio"
                name="payment"
                value="stripe"
                checked={paymentMethod === "stripe"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="co-payment-content">
                <div className="co-payment-info">
                  <div className="co-payment-name">THANH TOÁN QUA STRIPE</div>
                  <div className="co-payment-desc">
                    Bạn cần có tài khoản ví điện tử Stripe
                  </div>
                </div>
                <div className="co-payment-icon co-payment-icon-paypal">
                  <DollarSign size={40} />
                </div>
              </div>
            </label> */}

            {/* Service Wallet */}
            {/* <label className="co-payment-option">
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
                  <div className="co-payment-desc">
                    THANH TOÁN QUA VÍ DỊCH VỤ
                  </div>
                </div>
                <div className="co-payment-icon co-payment-icon-service">
                  <Wallet size={40} />
                </div>
              </div>
            </label> */}

            {/* Payment Button */}
            <button className="co-payment-btn" onClick={handlePayment}>
              {t("checkout.buttons.pay")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckOut;