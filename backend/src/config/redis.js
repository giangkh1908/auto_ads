// src/config/redis.js
import Redis from "ioredis";

// Kết nối với Redis Server đang chạy trên WSL2
const redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
});

redis.on("connect", () => {
    console.log("🚀 Đã kết nối Redis thành công!");
});

redis.on("error", (err) => {
    console.error("❌ Lỗi kết nối Redis:", err.message);
});

export default redis;