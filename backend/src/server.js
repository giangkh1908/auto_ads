import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
dotenv.config();

import compression from "compression";
import { connectDB } from "./config/db.js";
import redis, { closeRedis } from "./config/redis.js";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";

// Import Logging & Performance Middlewares
import logger from "./utils/logger.js";
import requestLogger from "./middlewares/requestLogger.js";
import { performanceTracker } from "./middlewares/performanceTracker.js";

// import { startAnalyticsSnapshotCron } from "./jobs/analyticsSnapshot.job.js"; // Deprecated: Now using AdPerformance from cronJobs.js
import { startAutoRuleScheduler } from "./services/auto/autoRuleScheduler.js";
import { startCancelExpiredPaymentsCron } from "./jobs/cancelExpiredPayments.job.js";
import { startSyncCronJobs } from "./jobs/cronJobs.js";
import { startUserPackageExpiryCron } from "./jobs/userPackageExpiry.job.js";

//Import Routes
import userRoutes from './routes/user/userRoutes.js';
import roleRoutes from './routes/admin/roleRoutes.js';
import userRoleRoutes from './routes/user/userRoleRoutes.js';
import shopRoutes from './routes/shops/shopRoutes.js';
import shopUserRoutes from './routes/shops/shopUserRoutes.js';
import authRoutes from './routes/user/authRoutes.js';
import sessionRoutes from './routes/user/sessionRoutes.js';
import adsAccountRoutes from "./routes/ads/adsAccountRoutes.js";
import adsWizardRoutes from "./routes/ads/adsWizardRoutes.js";
import adsCampaignRoutes from "./routes/ads/adsCampaignRoutes.js";
import adsSetRoutes from "./routes/ads/adsSetRoutes.js";
import adsRoutes from "./routes/ads/adsRoutes.js";
import creativeRoutes from "./routes/ads/creativeRoutes.js";
import adPerformanceRoutes from "./routes/ads/adPerformanceRoutes.js";
import analyticsRoutes from "./routes/analytics/analytics.routes.js";
import locationRoutes from "./routes/ads/locationRoutes.js";
import targetingRoutes from "./routes/ads/targetingRoutes.js";
import uploadRoutes from "./routes/ads/uploadRoutes.js";
import aiRoutes from "./routes/ai/aiRoutes.js";
import chatRoutes from "./routes/ai/chatRoutes.js";
import automationRuleRoutes from "./routes/auto/automationRuleRoutes.js";
import logRoutes from "./routes/admin/logRoutes.js";
import systemLogRoutes from "./routes/admin/systemLogRoutes.js";
import noteRoutes from "./routes/admin/noteRoutes.js";
import leadRoutes from "./routes/admin/leadRoutes.js";
import packageRoutes from './routes/admin/packageRoutes.js';
import userPackageRoutes from './routes/package/userPackageRoutes.js';
import paymentTransactionsRoutes from './routes/transaction/paymentTransactionsRoutes.js';
import stripeTransactionsRoutes from './routes/transaction/stripeTransactionsRoutes.js';
import zaloPayTransactionsRoutes from './routes/transaction/zaloPayTransactionsRoutes.js';
import vnPayTransactionsRoutes from './routes/transaction/vnPayTransactionsRoutes.js';
import invoiceRoutes from "./routes/invoice/invoiceRoutes.js";
import syncRoutes from "./routes/ads/syncRoutes.js";

//Load các biến môi trường
// dotenv.config(); // Moved to top

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

const app = express();

// Apply Logging and Performance tracking at the absolute top
app.use(requestLogger);
app.use(performanceTracker);

app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now if it interferes with some integrations, or configure it carefully
  crossOriginEmbedderPolicy: false,
}));

// Fix for express-mongo-sanitize in Express 5 (req.query is getter-only by default)
app.use((req, res, next) => {
  if (req.query) {
    Object.defineProperty(req, 'query', {
      value: { ...req.query },
      writable: true,
      enumerable: true,
      configurable: true
    });
  }
  next();
});

app.use(mongoSanitize());
app.use(compression());

// Bật CORS cho frontend
// Chuẩn hóa FRONTEND_URL: xóa dấu cách thừa và dấu / ở cuối
const frontendUrl = (process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");

const allowedOrigins = [
  frontendUrl,
  'http://localhost:3000',
  'http://localhost:5173',
  'https://auto-ads-ai.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Cho phép các request không có origin (như mobile apps hoặc curl)
    if (!origin) return callback(null, true);

    // Kiểm tra xem origin có nằm trong danh sách cho phép không
    const isAllowed = allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(null, false); // Trả về false thay vì Error để tránh làm sập request preflight một cách im lặng
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

//Routes
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/user-roles", userRoleRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/shop-users", shopUserRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auth/sessions", sessionRoutes);
app.use("/api/ads-accounts", adsAccountRoutes);
app.use("/api/campaigns", adsCampaignRoutes);
app.use("/api/adsets", adsSetRoutes);
app.use("/api/ads", adsRoutes);
app.use("/api/ads/performance", adPerformanceRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/creatives", creativeRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/targeting", targetingRoutes);
app.use("/api/ads-wizard", adsWizardRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/ai/chat", chatRoutes);
app.use("/api/automation-rules", automationRuleRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/system-logs", systemLogRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/package", packageRoutes);
app.use("/api/user-package", userPackageRoutes);
app.use("/api/payment-transactions", paymentTransactionsRoutes);
app.use("/api/stripe-transactions", stripeTransactionsRoutes);
app.use('/api/zalo-pay', zaloPayTransactionsRoutes);
app.use('/api/vnpay', vnPayTransactionsRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/sync", syncRoutes);

// Add a root route to check deployment status
app.get("/", (req, res) => {
  res.send("Backend deployed successfully!");
});

app.get("/heavy", (req, res) => {
  // Tăng lên 100 triệu hoặc 1 tỷ vòng lặp để kéo dài thời gian xử lý khoảng 500ms - 1s
  const iterations = 100_000_000;
  const start = Date.now();

  let result = 0;
  for (let i = 0; i < iterations; i++) {
    // Thực hiện phép toán phức tạp hơn một chút để CPU phải làm việc thực sự
    result += Math.sqrt(i) * Math.tan(i);
  }

  const elapsed = Date.now() - start;
  res.json({
    message: "CPU was blocked!",
    elapsedMs: elapsed,
    result: result.toFixed(2)
  });
});

// Health check endpoint cho monitoring services (UptimeRobot, Cron-Job, etc.)
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    message: "Server is running"
  });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled Error Caught By Global Middleware:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? {} : err,
  });
});

const startServer = async () => {
  try {
    await connectDB();

    // CHỈ CHẠY CRON JOB NẾU BIẾN CRON_ENABLED = true
    if (process.env.CRON_ENABLED === "true") {
      logger.info("--- CRON JOBS STARTED ON THIS INSTANCE ---");
      startAutoRuleScheduler();
      startCancelExpiredPaymentsCron();
      startSyncCronJobs();
      startUserPackageExpiryCron();
    } else {
      logger.info("--- CRON JOBS DISABLED ON THIS INSTANCE ---");
    }

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

async function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
  try {
    await closeRedis();
    console.log("[Server] Graceful shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("[Server] Error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;