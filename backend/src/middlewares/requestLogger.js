import morgan from "morgan";
import logger from "../utils/logger.js";

// Khai báo các custom tokens cho Morgan
morgan.token("ip", (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "Unknown"
  );
});

morgan.token("user", (req) => {
  return req.user?.id || req.user?._id || "Guest";
});

// Stream để đẩy morgan logs vào winston
const stream = {
  write: (message) => {
    // Loại bỏ ký tự xuống dòng dư thừa ở cuối message từ morgan
    logger.info(message.trim());
  },
};

// Định dạng log HTTP request
const format = (tokens, req, res) => {
  return JSON.stringify({
    ip: tokens.ip(req, res),
    user_id: tokens.user(req, res),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: Number(tokens.status(req, res)),
    response_time_ms: Number(tokens["response-time"](req, res)),
    content_length: tokens.res(req, res, "content-length") || "0",
    user_agent: tokens["user-agent"](req, res),
  });
};

const requestLogger = morgan(format, { stream });

export default requestLogger;
