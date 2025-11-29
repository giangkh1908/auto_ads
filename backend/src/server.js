import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import cors from "cors";
import path from "path";

import { startAdHourlyInsightsCron } from "./jobs/adHourlyInsights.job.js";
import { startAnalyticsSnapshotCron } from "./jobs/analyticsSnapshot.job.js";
import { startAutoRuleScheduler } from "./services/autoRuleScheduler.js";
import { startCancelExpiredPaymentsCron } from "./jobs/cancelExpiredPayments.job.js";
import { startSyncCronJobs } from "./jobs/cronJobs.js";

//Import Routes
import userRoutes from './routes/userRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import userRoleRoutes from './routes/userRoleRoutes.js';
import shopRoutes from './routes/shops/shopRoutes.js';
import shopUserRoutes from './routes/shops/shopUserRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adsAccountRoutes from "./routes/ads/adsAccountRoutes.js";
import adsWizardRoutes from "./routes/ads/adsWizardRoutes.js";
import adsCampaignRoutes from "./routes/ads/adsCampaignRoutes.js";
import adsSetRoutes from "./routes/ads/adsSetRoutes.js";
import adsRoutes from "./routes/ads/adsRoutes.js";
import creativeRoutes from "./routes/ads/creativeRoutes.js";
import adPerformanceRoutes from "./routes/ads/adPerformanceRoutes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import locationRoutes from "./routes/ads/locationRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import aiRoutes from "./routes/ai/aiRoutes.js";
import chatRoutes from "./routes/ai/chatRoutes.js";
import automationRuleRoutes from "./routes/automationRuleRoutes.js";
import logRoutes from "./routes/logRoutes.js";
import systemLogRoutes from "./routes/systemLogRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import packageRoutes from './routes/packageRoutes.js';
import userPackageRoutes from './routes/package/userPackageRoutes.js';
import paymentTransactionsRoutes from './routes/transaction/paymentTransactionsRoutes.js';
import stripeTransactionsRoutes from './routes/transaction/stripeTransactionsRoutes.js';
import zaloPayTransactionsRoutes from './routes/transaction/zaloPayTransactionsRoutes.js';
import vnPayTransactionsRoutes from './routes/transaction/vnPayTransactionsRoutes.js';
import invoiceRoutes from "./routes/invoice/invoiceRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";

//Load các biến môi trường
dotenv.config();

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

const app = express();

// Bật CORS cho frontend
app.use(cors({ 
  origin: true,
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

    startAutoRuleScheduler();
    // startAdHourlyInsightsCron();
    // startAnalyticsSnapshotCron();
    startCancelExpiredPaymentsCron();
    // startSyncCronJobs();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("🚨 Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export default app;