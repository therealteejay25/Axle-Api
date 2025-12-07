import IORedis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

// Create a single shared Redis client for the app.
// Accept REDIS_URL in the form `redis://:password@host:port` or `redis://host:port`.
const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("connect", () => {
  logger.info("Redis connecting");
});

redis.on("ready", () => {
  logger.info("Redis ready");
});

redis.on("error", (err) => {
  logger.error("Redis error", err);
});

redis.on("close", () => {
  logger.warn("Redis connection closed");
});

export default redis;
