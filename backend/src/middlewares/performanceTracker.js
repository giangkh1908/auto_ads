import logger from "../utils/logger.js";

// Ngưỡng cảnh báo hiệu năng (Response time)
const WARNING_THRESHOLD_MS = 1000;

export const performanceTracker = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationNs = end - start;
    const durationMs = Number(durationNs) / 1e6; // Đổi sang mili-giây (ms)

    const logPayload = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: parseFloat(durationMs.toFixed(2)),
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      },
    };

    if (durationMs >= WARNING_THRESHOLD_MS) {
      logger.warn(`⚠️ Slow Response Detected: ${req.method} ${logPayload.url} took ${logPayload.duration_ms}ms`, logPayload);
    } else {
      logger.info(`Performance check: ${req.method} ${logPayload.url} took ${logPayload.duration_ms}ms`, logPayload);
    }
  });

  next();
};
