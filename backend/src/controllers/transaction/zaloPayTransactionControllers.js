import crypto from 'crypto-js';
import axios from 'axios';
import PaymentTransaction from '../../models/transaction/paymentTransaction.model.js';
import UserPackage from '../../models/package/userPackage.model.js';
import Package from '../../models/package/package.model.js';

// Config sandbox (thay bằng env vars)
const config = {
  appId: '554',  // e.g., 2553
  key1: '8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn',    // e.g., f2e... (32 chars)
  key2: '	uUfsWgfLkRLzq6W2uNXTCxrfxs51auny',    // e.g., Iyz2hab... (32 chars)
  endpoint: 'https://sandbox.zalopay.com.vn/v001/tpe/createorder',  // Sandbox URL
  callbackUrl: `${process.env.SERVER_URL}/api/zalo-pay/callback`,    // e.g., http://localhost:5001/api/zalo-pay/callback
};

// Tạo ZaloPay order (FE gọi POST /api/zalo-pay/:orderId/create)
export const createZaloPayOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderData } = req.body;

    // 1. Tìm transaction
    const transaction = await PaymentTransaction.findById(orderId).populate('package_id');
    if (!transaction || transaction.status !== 'initializing') {
      return res.status(400).json({ success: false, message: 'Giao dịch không hợp lệ' });
    }

    // 2. Tạo params cho ZaloPay
    const order = {
      appid: config.appId,
      apptransid: `${Date.now()}_${orderId}`,  // Unique ID
      apptime: Date.now(),
      appuser: req.user.email || 'user',
      itemid: transaction.package_id._id.toString(),
      itemname: orderData.name || 'Gói Chatbot AI',
      itemprice: orderData.packagePricing,
      itemquantity: 1,
      itemset: 1,
      amount: orderData.packagePricing,  // VND
      description: `Gói ${orderData.duration === "yearly" ? "12 tháng" : "1 tháng"}`,
      bankcode: '',  // '' = ZaloPay tự chọn
      mac: '',  // Tạo sau
    };

    // 3. Tạo mac (HMAC SHA256 với key1)
    const embeddata = JSON.stringify({ orderId });  // Gửi orderId về callback
    const dataToSign = `${order.appid}|${order.apptransid}|${order.appuser}|${order.amount}|${order.apptime}|${order.itemid}|${order.itemprice}|${order.itemquantity}|${order.itemset}|${order.appid}|${embeddata}`;
    order.mac = crypto.HmacSHA256(dataToSign, config.key1).toString(crypto.enc.Hex);
    console.log('ZaloPay order data:', order);
    // 4. Gọi ZaloPay API tạo order
    const response = await axios.post(config.endpoint, order, {
      headers: { 'Content-Type': 'application/json' },
    });

    const zaloData = response;
    if (zaloData.returncode !== 1) {
      return res.status(400).json({ success: false, message: zaloData.returnmessage || 'Lỗi tạo order ZaloPay' });
    }

    // 5. Cập nhật transaction với zalo_order_id
    await PaymentTransaction.findByIdAndUpdate(orderId, {
      zalo_order_id: order.apptransid,
      status: 'pending',
    });

    res.json({
      success: true,
      data: {
        orderUrl: zaloData.order_url,  // URL redirect đến ZaloPay
        apptransid: order.apptransid,
      },
    });
  } catch (error) {
    console.error('ZaloPay create order error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Callback từ ZaloPay (GET /api/zalo-pay/callback)
export const zaloPayCallback = async (req, res) => {
  try {
    const query = req.query;
    console.log('ZaloPay callback received:', query);

    const { apptransid, status, embeddata } = query;

    if (!apptransid) {
      return res.status(400).send('Missing apptransid');
    }

    // 1. Verify checksum (bắt buộc)
    const checksumData = `${query.appid}|${apptransid}|${query.pmcid}|${query.bankcode}|${query.amount}|${query.discountamount}|${status}`;
    const checksum = crypto.HmacSHA256(checksumData, config.key2).toString(crypto.enc.Hex);

    if (checksum !== query.checksum) {
      console.error('Invalid checksum');
      return res.status(400).send('Invalid checksum');
    }

    // 2. Parse embeddata (chứa orderId)
    let orderId;
    try {
      const embed = JSON.parse(embeddata);
      orderId = embed.orderId;
    } catch (e) {
      return res.status(400).send('Invalid embeddata');
    }

    // 3. Query status từ ZaloPay để xác nhận (vì callback chỉ là notify)
    const statusRes = await axios.get(`https://sandbox.zalopay.com.vn/v001/tpe/getstatusbyapptransid`, {
      params: { appid: config.appId, apptransid },
      headers: { 'Content-Type': 'application/json' },
    });

    const zaloStatus = statusRes.data;
    if (zaloStatus.return_code !== 1 || zaloStatus.data?.status !== 1) {
      console.log('Payment not confirmed:', zaloStatus);
      return res.redirect('/checkout/zalo/cancel');  // Redirect về trang hủy
    }

    // 4. Tìm transaction
    const transaction = await PaymentTransaction.findById(orderId);
    if (!transaction || transaction.status === 'completed') {
      return res.redirect('/dashboard');  // Đã xử lý
    }

    // 5. Tạo UserPackage (tương tự Stripe webhook)
    const packageOrigin = await Package.findById(transaction.package_id);
    const newUserPackage = new UserPackage({
      user_id: transaction.user_id,
      package_id: packageOrigin._id,
      pages: packageOrigin.pages,
      employees: packageOrigin.employees,
      shops: packageOrigin.shops,
      from_date: new Date(),
      to_date: new Date(Date.now() + packageOrigin.duration_days * 24 * 60 * 60 * 1000),
      status: 'active',
      created_by: transaction.user_id,
      payment_method: 'zalopay',
      payment_transaction_id: orderId,
    });

    await newUserPackage.save();

    // 6. Cập nhật transaction
    await PaymentTransaction.findByIdAndUpdate(orderId, {
      status: 'completed',
      payment_at: new Date(),
      zalo_status: zaloStatus.data.status,
      updated_by: transaction.user_id,
    });

    console.log(`ZaloPay thanh toán thành công: ${apptransid}`);
    res.redirect('/dashboard');  // Redirect về dashboard thành công
  } catch (error) {
    console.error('ZaloPay callback error:', error);
    res.redirect('/checkout/zalo/cancel');
  }
};