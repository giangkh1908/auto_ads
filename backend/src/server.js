import express from "express";
import dotenv from "dotenv";
dotenv.config();

import compression from "compression";
import { connectDB } from "./config/db.js";
import redis from "./config/redis.js";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";

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

// ============================================
// CORS CONFIGURATION - MUST BE FIRST
// ============================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://auto-ads-ai.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim().replace(/\/$/, '')] : [])
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow in development for any origin
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Check allowed origins in production
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    console.warn(`CORS blocked for origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Request-ID']
}));

// Handle OPTIONS preflight manually (Express 5 compatible)
app.options((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

// ============================================
// SECURITY MIDDLEWARE (AFTER CORS)
// ============================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
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

// ============================================
// BODY PARSERS
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

//Routes
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/user-roles", userRoleRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/shop-users", shopUserRoutes);
app.use("/api/auth", authRoutes);
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

const startServer = async () => {
  try {
    await connectDB();

    // CHỈ CHẠY CRON JOB NẾU BIẾN CRON_ENABLED = true
    if (process.env.CRON_ENABLED === "true") {
      console.log("--- CRON JOBS STARTED ON THIS INSTANCE ---");
      startAutoRuleScheduler();
      startCancelExpiredPaymentsCron();
      startSyncCronJobs();
      startUserPackageExpiryCron();
    } else {
      console.log("--- CRON JOBS DISABLED ON THIS INSTANCE ---");
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export default app;