"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
// ============================================
// REDIS CONNECTION
// ============================================
exports.redis = new ioredis_1.default(env_1.env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    retryStrategy: (times) => {
        if (times > 3) {
            console.error("Redis connection failed after 3 retries");
            return null;
        }
        return Math.min(times * 200, 2000);
    }
});
exports.redis.on("connect", () => {
    console.log("Redis connected");
});
exports.redis.on("error", (err) => {
    console.error("Redis error:", err.message);
});
exports.default = exports.redis;
