import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Liên kết DB thành công!");
  } catch (error) {
    console.error("Lỗi khi kết nối DB:", error);
    process.exit(1); // exit with error
  }
};