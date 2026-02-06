import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "../services/logger";

// ============================================
// REDIS CONNECTION
// ============================================

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`[Redis] Retrying connection in ${delay}ms... (Attempt ${times})`);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      // Only reconnect when the error starts with "READONLY"
      return true;
    }
    return false;
  }
});

redis.on("connect", () => {
  logger.info("[Redis] Connected successfully");
});

redis.on("error", (err) => {
  logger.error("[Redis] Connection error:", err.message);
});

redis.on("ready", () => {
  logger.info("[Redis] Client is ready");
});

redis.on("reconnecting", () => {
  logger.info("[Redis] Reconnecting...");
});

export default redis;
