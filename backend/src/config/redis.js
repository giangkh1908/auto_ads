import Redis from "ioredis";
import logger from "../utils/logger.js";

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  keyPrefix: process.env.REDIS_KEY_PREFIX || "autoads:",
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) {
      logger.error("[Redis] Max retries reached, giving up.");
      return null;
    }
    const delay = Math.min(times * 200, 3000);
    logger.warn(`[Redis] Reconnecting attempt ${times}, delay ${delay}ms`);
    return delay;
  },
  lazyConnect: false,
  enableOfflineQueue: false,
  enableAutoResubscribe: true,
});

let isReady = false;
let redisDownLogged = false;

redis.on("connect", () => {
  logger.info("[Redis] Connected successfully");
});

redis.on("ready", () => {
  isReady = true;
  redisDownLogged = false;
  logger.info("[Redis] Ready for commands");
});

redis.on("error", (err) => {
  isReady = false;
  if (!redisDownLogged) {
    logger.error(`[Redis] Error: ${err.message}`);
    redisDownLogged = true;
  }
});

redis.on("close", () => {
  isReady = false;
  logger.warn("[Redis] Connection closed");
});

redis.on("reconnecting", () => {
  isReady = false;
  logger.warn("[Redis] Reconnecting...");
});

export function isRedisReady() {
  return isReady;
}

export async function closeRedis() {
  try {
    await redis.quit();
    logger.info("[Redis] Connection closed gracefully");
  } catch (err) {
    logger.error(`[Redis] Error during shutdown: ${err.message}`);
  }
}

export default redis;
