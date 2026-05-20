import mongoose from "mongoose";
import dns from "node:dns";
import logger from "../utils/logger.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      maxPoolSize: 1500,
    });
    logger.info("DB connected successfully!");
  } catch (error) {
    logger.error("DB connection error:", error);
    process.exit(1);
  }
};