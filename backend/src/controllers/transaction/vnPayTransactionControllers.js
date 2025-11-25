// src/controllers/vnpayController.js
import crypto from "crypto";
import querystring from "qs";
import axios from "axios";
import PaymentTransaction from "../../models/paymentTransaction.model.js";
import UserPackage from "../../models/userPackage.model.js";
import Package from "../../models/package.model.js";

const config = {
  vnp_TmnCode: process.env.VNPAY_TMN_CODE || "Y4DJ13B6",
  vnp_HashSecret: process.env.VNPAY_HASH_SECRET || "BIYMKPJPKLOEPMWRKCRWIXJLOIETVDUN",
  vnp_Url: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  vnp_ReturnUrl: `http://auto-ads-ai.vercel.app/dashboard`,
  vnp_QueryUrl: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
  vnp_IpAddr: process.env.VNPAY_IP_ADDR || "127.0.0.1",
};

/* ============== HÀM TẠO CHỮ KÝ CHUẨN MỚI 2025 ============== */
function createSecureHash(dataString) {
  return crypto.createHash("sha512").update(dataString, "utf8").digest("hex");
}

/* ============== TẠO URL THANH TOÁN ============== */
export const createVnpayPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderData } = req.body;

    const transaction = await PaymentTransaction.findById(orderId).populate("package_id");
    if (!transaction || transaction.status !== "initializing") {
      return res.status(400).json({ success: false, message: "Giao dịch không hợp lệ" });
    }

    const now = new Date();
    const vnp_CreateDate = getVnpDateTime(); // GMT+7
    const vnp_ExpireDate = new Date(Date.now() + 15 * 60 * 1000 + 7 * 60 * 60 * 1000) // +15 phút + 7h (đảm bảo GMT+7)
      .toISOString()
      .replace(/[-:T.Z]/g, "")
      .slice(0, 14);
    const vnp_TxnRef = `${vnp_CreateDate}_${orderId}`;

    // DỮ LIỆU KÝ THEO THỨ TỰ MỚI (nối bằng |)
    const signData = [
      "2.1.0",                                  // vnp_Version
      "pay",                                    // vnp_Command
      config.vnp_TmnCode,                       // vnp_TmnCode
      orderData.packagePricing * 100,           // vnp_Amount
      vnp_CreateDate,                           // vnp_CreateDate
      "VND",                                    // vnp_CurrCode
      config.vnp_IpAddr,                        // vnp_IpAddr
      "vn",                                     // vnp_Locale
      `Thanh toan goi ${orderData.name || "Chatbot AI"}`, // vnp_OrderInfo
      "250000",                                 // vnp_OrderType
      config.vnp_ReturnUrl,                     // vnp_ReturnUrl
      vnp_ExpireDate,                         // vnp_ExpireDate
      vnp_TxnRef,                               // vnp_TxnRef
    ].join("|");

    console.log("VNPay sign data:", signData);

    const vnp_SecureHash = createSecureHash(signData);

    const vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: config.vnp_TmnCode,
      vnp_Amount: orderData.packagePricing * 100,
      vnp_CreateDate: vnp_CreateDate,
      vnp_CurrCode: "VND",
      vnp_IpAddr: config.vnp_IpAddr,
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toan goi ${orderData.name || "Chatbot AI"}`,
      vnp_OrderType: "250000",
      vnp_ReturnUrl: config.vnp_ReturnUrl,
      vnp_ExpireDate: vnp_ExpireDate,
      vnp_TxnRef: vnp_TxnRef,
      vnp_SecureHash: vnp_SecureHash,
    };
    console.log("VNPay params:", vnp_Params);

    const paymentUrl = config.vnp_Url + "?" + querystring.stringify(vnp_Params, { encode: false });

    await PaymentTransaction.findByIdAndUpdate(orderId, {
      vnp_txn_ref: vnp_TxnRef,
      status: "pending",
      payment_method: "vnpay",
    });

    res.json({ success: true, data: { paymentUrl } });
  } catch (error) {
    console.error("VNPay create error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/* ============== RETURN URL ============== */
export const vnpayReturn = async (req, res) => {
  const vnp_Params = req.query;
  const secureHash = vnp_Params.vnp_SecureHash;

  // Tái tạo chữ ký từ dữ liệu nhận được
  const signData = [
    vnp_Params.vnp_Amount,
    vnp_Params.vnp_BankCode || "",
    vnp_Params.vnp_BankTranNo || "",
    vnp_Params.vnp_CardType || "",
    vnp_Params.vnp_OrderInfo,
    vnp_Params.vnp_PayDate,
    vnp_Params.vnp_ResponseCode,
    vnp_Params.vnp_TmnCode,
    vnp_Params.vnp_TransactionNo,
    vnp_Params.vnp_TransactionStatus,
    vnp_Params.vnp_TxnRef,
  ].join("|");

  const calculatedHash = createSecureHash(signData);

  if (secureHash !== calculatedHash) {
    return res.redirect(`${process.env.CLIENT_URL}/checkout?payment=failed&msg=checksum`);
  }

  if (vnp_Params.vnp_ResponseCode === "00" && vnp_Params.vnp_TransactionStatus === "00") {
    const realOrderId = vnp_Params.vnp_TxnRef.split("_")[1];
    // ... xử lý kích hoạt gói như cũ
    return res.redirect(`${process.env.CLIENT_URL}/dashboard?payment=success`);
  } else {
    return res.redirect(`${process.env.CLIENT_URL}/checkout?payment=failed`);
  }
};

/* ============== QUERYDR CHUẨN MỚI 2025 ============== */
export async function queryVnpayTransaction(txnRef, transactionDate) {
  try {
    const vnp_RequestId = Date.now().toString();
    const vnp_CreateDate = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);

    const rawData = [
      vnp_RequestId,
      "2.1.0",
      "querydr",
      config.vnp_TmnCode,
      txnRef,
      transactionDate,
      vnp_CreateDate,
      process.env.VNPAY_IP_ADDR || "127.0.0.1",
      "Kiem tra giao dich VNPAY",
    ].join("|");

    const vnp_SecureHash = createSecureHash(rawData);

    const payload = {
      vnp_RequestId,
      vnp_Version: "2.1.0",
      vnp_Command: "querydr",
      vnp_TmnCode: config.vnp_TmnCode,
      vnp_TxnRef: txnRef,
      vnp_TransactionDate: transactionDate,
      vnp_CreateDate,
      vnp_IpAddr: process.env.VNPAY_IP_ADDR || req.ip || "127.0.0.1",
      vnp_OrderInfo: "Kiem tra giao dich VNPAY",
      vnp_SecureHash,
    };

    const response = await axios.post(config.vnp_QueryUrl, payload, {
      headers: { "Content-Type": "application/json" },
    });

    return {
      success: response.data.vnp_ResponseCode === "00",
      data: response.data,
      message: response.data.vnp_Message,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

const getVnpDateTime = () => {
  const now = new Date();

  // Cách đúng: Dùng getTimezoneOffset + thủ công cộng 7 tiếng (Việt Nam = UTC+7)
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);

  const year = vnTime.getUTCFullYear();
  const month = String(vnTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(vnTime.getUTCDate()).padStart(2, "0");
  const hours = String(vnTime.getUTCHours()).padStart(2, "0");
  const minutes = String(vnTime.getUTCMinutes()).padStart(2, "0");
  const seconds = String(vnTime.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};