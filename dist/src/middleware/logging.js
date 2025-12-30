"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggingMiddleware = void 0;
const uuid_1 = require("uuid");
const logger_1 = require("../lib/logger");
/**
 * Request logging middleware: adds correlation ID and logs request/response.
 */
const requestLoggingMiddleware = (req, res, next) => {
    const correlationId = req.headers["x-correlation-id"] || (0, uuid_1.v4)();
    req.correlationId = correlationId;
    res.setHeader("X-Correlation-ID", correlationId);
    const startTime = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - startTime;
        const status = res.statusCode;
        const level = status >= 400 ? "warn" : "info";
        logger_1.logger[level](`[${correlationId}] ${req.method} ${req.path} - ${status} (${duration}ms)`);
    });
    next();
};
exports.requestLoggingMiddleware = requestLoggingMiddleware;
exports.default = { requestLoggingMiddleware: exports.requestLoggingMiddleware };
