import mongoose from "mongoose";
import dotenv from "dotenv";
import Package from "../models/package.model.js";

dotenv.config();

const PACKAGES = [
  {
    name: "Chatbot",
    description: "Basic Chatbot Package - 3 months",
    price: 299000,
    month_period: 3,
    duration_days: 90,
    planType: "3months",
    pages: 40,
    shops: 20,
    employees: 5,
    conversations: "∞",
    contacts: "∞",
    features: ["analytics_chat_ai"],
    status: "active",
  },
  {
    name: "Chatbot AI",
    description: "Premium Chatbot AI+ Package - 3 months",
    price: 499000,
    month_period: 3,
    duration_days: 90,
    planType: "3months",
    pages: 999,
    shops: 100,
    employees: 10,
    conversations: "∞",
    contacts: "∞",
    features: ["analytics_chat_ai", "content_ai", "ads_auto_run"],
    status: "active",
  },
  {
    name: "Chatbot 6 tháng",
    description: "Gói Chatbot 6 tháng",
    price: 549000,
    month_period: 6,
    duration_days: 180,
    planType: "6months",
    pages: 40,
    shops: 20,
    employees: 5,
    conversations: "∞",
    contacts: "∞",
    features: ["analytics_chat_ai"],
    status: "active",
  },
  {
    name: "Chatbot AI 6 tháng",
    description: "Gói Chatbot AI 6 tháng",
    price: 899000,
    month_period: 6,
    duration_days: 180,
    planType: "6months",
    pages: 999,
    shops: 100,
    employees: 10,
    conversations: "∞",
    contacts: "∞",
    features: ["analytics_chat_ai", "content_ai", "ads_auto_run"],
    status: "active",
  },
];

const connect = async () => {
  const uri =
    process.env.MONGODB_URL ||
    process.env.DATABASE_URL ||
    "mongodb://127.0.0.1:27017/ai-agent-auto-ads";

  await mongoose.connect(uri, {
    maxPoolSize: 5,
  });
};

const seedPackages = async () => {
  try {
    await connect();

    for (const pkg of PACKAGES) {
      await Package.updateOne(
        { name: pkg.name },
        { $set: pkg },
        { upsert: true }
      );
      console.log(`✅ Upserted package: ${pkg.name}`);
    }

    console.log("🎉 Seed packages completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed packages failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seedPackages();

