import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import redis from "../lib/redis";

/**
 * Per-user rate limiting using sliding window in Redis.
 * Pricing tiers can override limits.
 */
export const perUserRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userId = (req as any).userId;
  if (!userId) {
    return next(); // Skip if not authenticated
  }

  try {
    // For MVP: fixed limits. In production, fetch from User model based on pricingPlan
    const windowMs = env.RATE_LIMIT_WINDOW_MS;
    const maxRequests = env.RATE_LIMIT_MAX_REQUESTS;

    const key = `rate-limit:${userId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count requests in window
    const count = await redis.zcard(key);

    if (count >= maxRequests) {
      logger.warn(
        `Rate limit exceeded for user ${userId}: ${count} requests in window`
      );
      return res.status(429).json({
        error: "Rate limit exceeded",
        retryAfter: Math.ceil(windowMs / 1000),
      });
    }

    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, Math.ceil(windowMs / 1000));

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", maxRequests - count - 1);

    next();
  } catch (err) {
    logger.error("Rate limit check failed", err);
    // If Redis is down, allow request but log
    next();
  }
};

export default { perUserRateLimitMiddleware };
