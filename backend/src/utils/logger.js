import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";

const logDir = path.join(process.cwd(), "logs");

// Định dạng log chuẩn
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format đẹp mắt cho môi trường dev
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    if (stack) {
      return `[${timestamp}] ${level}: ${message}\nStack: ${stack}`;
    }
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Khởi tạo Winston Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "auto-ads-backend" },
  transports: [
    // Xoay vòng file log lỗi
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "14d",
      maxSize: "20m",
      zippedArchive: true,
    }),
    // Xoay vòng file log chung
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "application-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      maxSize: "20m",
      zippedArchive: true,
    }),
  ],
});

// Nếu không phải là production thì in ra console với định dạng đẹp
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

export default logger;
