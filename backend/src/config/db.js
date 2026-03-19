import mongoose from "mongoose";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      maxPoolSize: 1500,
    });
    console.log("Liên kết DB thành công!");
  } catch (error) {
    console.error("Lỗi khi kết nối DB:", error);
    process.exit(1);
  }
};