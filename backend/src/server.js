import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import cors from "cors";
import path from "path";

import { startAdPerformanceCron } from "./jobs/adPerformance.job.js";
import { startAdHourlyInsightsCron } from "./jobs/adHourlyInsights.job.js";

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
import uploadRoutes from "./routes/uploadRoutes.js";
import aiRoutes from "./routes/ai/aiRoutes.js"; 

//Load các biến môi trường
dotenv.config();

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

const app = express();

// Bật CORS cho frontend
app.use(cors({ 
  origin: true, // 👈 Tạm thời cho phép tất cả
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
app.use("/api/creatives", creativeRoutes);
app.use("/api/ads-wizard", adsWizardRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/ai", aiRoutes);

// Connect database & start server
connectDB();

// Add a root route to check deployment status
app.get("/", (req, res) => {
  res.send("Backend deployed successfully!");
});

startAdPerformanceCron();
startAdHourlyInsightsCron();

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;