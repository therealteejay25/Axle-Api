import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";

// ============================================
// RATE LIMIT MIDDLEWARE
// ============================================

// Global rate limiter
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later"
  }
});

// Per-user rate limiter (stricter)
const userLimits = new Map<string, { count: number; resetAt: number }>();

export const perUserRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userId = req.user?.id;
  if (!userId) return next();
  
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;
  
  let userLimit = userLimits.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    userLimit = { count: 0, resetAt: now + windowMs };
    userLimits.set(userId, userLimit);
  }
  
  userLimit.count++;
  
  if (userLimit.count > maxRequests) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: Math.ceil((userLimit.resetAt - now) / 1000)
    });
  }
  
  next();
};

// Execution rate limiter (prevent runaway agents)
export const executionRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30, // 30 executions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many execution requests, please slow down"
  }
});

export default { globalRateLimiter, perUserRateLimiter, executionRateLimiter };
