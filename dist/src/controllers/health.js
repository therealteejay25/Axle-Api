"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readinessProbeController = exports.livenessProbeController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../lib/logger");
const redis_1 = __importDefault(require("../lib/redis"));
/**
 * Liveness probe: returns 200 if service is running.
 */
const livenessProbeController = (_req, res) => {
    res.json({ status: "alive", timestamp: new Date().toISOString() });
};
exports.livenessProbeController = livenessProbeController;
/**
 * Readiness probe: checks dependencies (MongoDB, Redis).
 */
const readinessProbeController = async (_req, res) => {
    const checks = {
        mongodb: mongoose_1.default.connection.readyState === 1,
        redis: false,
    };
    try {
        const pingResult = await redis_1.default.ping();
        checks.redis = pingResult === "PONG";
    }
    catch (err) {
        logger_1.logger.error("Redis health check failed", err);
        checks.redis = false;
    }
    const allReady = Object.values(checks).every((v) => v);
    const status = allReady ? 200 : 503;
    res.status(status).json({
        ready: allReady,
        checks,
        timestamp: new Date().toISOString(),
    });
};
exports.readinessProbeController = readinessProbeController;
exports.default = {};
