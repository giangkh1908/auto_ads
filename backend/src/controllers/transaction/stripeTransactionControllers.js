import stripe from 'stripe'; // ES6 import
import PaymentTransaction from '../../models/transaction/paymentTransaction.model.js'; // Model của bạn
import UserPackage from '../../models/package/userPackage.model.js'; // Để tạo gói sau thanh toán
import Package from '../../models/package/package.model.js'; // Model package gốc

// Khởi tạo Stripe (dùng env)
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

// Tạo Checkout Session
export const createCheckoutSession = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderData, successUrl, cancelUrl } = req.body;
    console.log("Creating checkout session for orderId:", orderId);
    console.log("Order Data:", orderData);

    // 1. Kiểm tra req.user (auth middleware)
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Không xác thực được người dùng",
      });
    }

    // 2. Tìm transaction + populate package_id
    const transaction = await PaymentTransaction.findById(orderId)
      .populate("package_id");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch",
      });
    }

    if (!transaction.package_id) {
      return res.status(400).json({
        success: false,
        message: "Gói dịch vụ không hợp lệ (package_id null)",
      });
    }

    if (transaction.status !== "initializing") {
      return res.status(400).json({
        success: false,
        message: "Giao dịch đã được xử lý",
      });
    }

    // 3. Tạo line_items – DÙNG transaction.package_id._id
    const lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: orderData.name || transaction.package_id.name,
            description: `Gói ${orderData.duration === "yearly" ? "12 tháng" : "1 tháng"}`,
            metadata: {
              package_id: transaction.package_id._id.toString(),
              user_id: req.user._id.toString(),
              pages: orderData.pages?.toString() || "0",
              employees: orderData.employees?.toString() || "0",
            },
          },
          unit_amount: Math.round(orderData.packagePricing / 27405.966327400 * 100), // cent
        },
        quantity: 1,
      },
    ];

    // 4. Tạo session
    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: req.user.email,
      metadata: {
        order_id: orderId,
        user_id: req.user._id.toString(),
      },
    });

    // 5. Cập nhật transaction
    transaction.stripe_session_id = session.id;
    transaction.status = "pending";
    await transaction.save();

    res.json({
      success: true,
      data: { url: session.url },
    });
  } catch (error) {
    console.error("Stripe create session error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi tạo phiên thanh toán",
      error: error.message,
    });
  }
};

// Webhook để xử lý sau thanh toán (tạo UserPackage)
export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  // 1. Xác thực chữ ký từ Stripe
  try {
    event = stripeInstance.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. Chỉ xử lý event cần thiết
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Lấy thông tin từ metadata (bắt buộc có khi tạo session)
    const orderId = session.metadata?.order_id;
    const userId = session.metadata?.user_id;

    if (!orderId || !userId) {
      console.error("Thiếu order_id hoặc user_id trong metadata");
      return res.status(400).send("Missing metadata");
    }

    // CHỐNG TRÙNG LẶP: Dùng event.id làm idempotency key
    const eventId = event.id;

    try {
      // Kiểm tra đã xử lý event này chưa (chống gọi 2 lần)
      const alreadyProcessed = await PaymentTransaction.findOne({
        _id: orderId,
        webhook_events: eventId,
      });

      if (alreadyProcessed) {
        console.log(`Event ${eventId} đã được xử lý trước đó (idempotent)`);
        return res.json({ received: true });
      }

      // Kiểm tra thanh toán thực sự thành công
      if (session.payment_status !== "paid") {
        console.log("Thanh toán chưa hoàn tất:", session.payment_status);
        return res.json({ received: true });
      }

      // Lấy transaction + populate package
      const transaction = await PaymentTransaction.findById(orderId)
        .populate("package_id");

      if (!transaction) {
        console.error("Không tìm thấy transaction:", orderId);
        return res.json({ received: true });
      }

      // Kiểm tra trạng thái (chỉ xử lý nếu đang pending)
      if (transaction.status === "completed") {
        console.log("Transaction đã hoàn tất trước đó");
        return res.json({ received: true });
      }

      // Tạo UserPackage (gói dịch vụ cho người dùng)
      const packageOrigin = transaction.package_id;

      const newUserPackage = new UserPackage({
        user_id: userId,
        package_id: packageOrigin._id,
        pages: packageOrigin.pages,
        employees: packageOrigin.employees,
        shops: packageOrigin.shops || 1,
        from_date: new Date(),
        // Tính ngày hết hạn theo duration_days trong package
        to_date: new Date(Date.now() + packageOrigin.duration_days * 24 * 60 * 60 * 1000),
        status: "active",
        created_by: userId,
        payment_method: "stripe",
        payment_transaction_id: orderId,
      });

      await newUserPackage.save();

      // Cập nhật transaction
      await PaymentTransaction.findByIdAndUpdate(orderId, {
        status: "completed",
        payment_at: new Date(),
        stripe_payment_intent: session.payment_intent,
        stripe_session_id: session.id,
        $addToSet: { webhook_events: eventId }, // Ghi lại event đã xử lý
        updated_by: userId,
      });

      console.log(`Kích hoạt gói thành công cho user ${userId} - Order: ${orderId}`);
    } catch (error) {
      console.error("Lỗi xử lý webhook:", error);
      // Không trả lỗi 500 → Stripe sẽ retry → flood server
      // Chỉ log + trả 200
    }
  }

  // Luôn trả 200 để Stripe không retry
  res.json({ received: true });
};