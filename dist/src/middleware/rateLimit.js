"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionRateLimiter = exports.perUserRateLimiter = exports.globalRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../config/env");
// ============================================
// RATE LIMIT MIDDLEWARE
// ============================================
// Global rate limiter
exports.globalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: env_1.env.RATE_LIMIT_WINDOW_MS,
    max: env_1.env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many requests, please try again later"
    }
});
// Per-user rate limiter (stricter)
const userLimits = new Map();
const perUserRateLimiter = (req, res, next) => {
    const userId = req.user?.id;
    if (!userId)
        return next();
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
exports.perUserRateLimiter = perUserRateLimiter;
// Execution rate limiter (prevent runaway agents)
exports.executionRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60000, // 1 minute
    max: 30, // 30 executions per minute per IP
    keyGenerator: (req) => req.user?.id || req.ip || "unknown",
    message: {
        error: "Too many execution requests, please slow down"
    }
});
exports.default = { globalRateLimiter: exports.globalRateLimiter, perUserRateLimiter: exports.perUserRateLimiter, executionRateLimiter: exports.executionRateLimiter };
