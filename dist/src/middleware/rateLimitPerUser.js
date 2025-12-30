"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.perUserRateLimitMiddleware = void 0;
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const redis_1 = __importDefault(require("../lib/redis"));
/**
 * Per-user rate limiting using sliding window in Redis.
 * Pricing tiers can override limits.
 */
const perUserRateLimitMiddleware = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return next(); // Skip if not authenticated
    }
    try {
        // For MVP: fixed limits. In production, fetch from User model based on pricingPlan
        const windowMs = env_1.env.RATE_LIMIT_WINDOW_MS;
        const maxRequests = env_1.env.RATE_LIMIT_MAX_REQUESTS;
        const key = `rate-limit:${userId}`;
        const now = Date.now();
        const windowStart = now - windowMs;
        // Remove old entries
        await redis_1.default.zremrangebyscore(key, 0, windowStart);
        // Count requests in window
        const count = await redis_1.default.zcard(key);
        if (count >= maxRequests) {
            logger_1.logger.warn(`Rate limit exceeded for user ${userId}: ${count} requests in window`);
            return res.status(429).json({
                error: "Rate limit exceeded",
                retryAfter: Math.ceil(windowMs / 1000),
            });
        }
        // Add current request
        await redis_1.default.zadd(key, now, `${now}-${Math.random()}`);
        await redis_1.default.expire(key, Math.ceil(windowMs / 1000));
        res.setHeader("X-RateLimit-Limit", maxRequests);
        res.setHeader("X-RateLimit-Remaining", maxRequests - count - 1);
        next();
    }
    catch (err) {
        logger_1.logger.error("Rate limit check failed", err);
        // If Redis is down, allow request but log
        next();
    }
};
exports.perUserRateLimitMiddleware = perUserRateLimitMiddleware;
exports.default = { perUserRateLimitMiddleware: exports.perUserRateLimitMiddleware };
