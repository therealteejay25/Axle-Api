"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logExecution = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const env_1 = require("../config/env");
// ============================================
// LOGGER SERVICE
// ============================================
// Structured logging for all execution logs.
// ============================================
const { combine, timestamp, printf, colorize, errors } = winston_1.default.format;
// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : "";
    return `${timestamp} [${level}]: ${message}${metaStr}`;
});
// JSON format for production
const prodFormat = printf(({ level, message, timestamp, ...meta }) => {
    return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta
    });
});
exports.logger = winston_1.default.createLogger({
    level: env_1.env.IS_PROD ? "info" : "debug",
    format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), errors({ stack: true })),
    transports: [
        new winston_1.default.transports.Console({
            format: combine(colorize(), env_1.env.IS_PROD ? prodFormat : devFormat)
        })
    ]
});
// Add file transport in production
if (env_1.env.IS_PROD) {
    exports.logger.add(new winston_1.default.transports.File({
        filename: "logs/error.log",
        level: "error",
        format: prodFormat
    }));
    exports.logger.add(new winston_1.default.transports.File({
        filename: "logs/combined.log",
        format: prodFormat
    }));
}
// Execution-specific logging helper
const logExecution = (executionId, event, data) => {
    exports.logger.info(`[Execution:${executionId}] ${event}`, {
        executionId,
        ...data
    });
};
exports.logExecution = logExecution;
exports.default = exports.logger;
