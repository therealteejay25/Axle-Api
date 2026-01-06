"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const routes_1 = __importDefault(require("./src/routes"));
const health_1 = __importDefault(require("./src/routes/health"));
const db_1 = require("./src/lib/db");
const logger_1 = require("./src/services/logger");
const env_1 = require("./src/config/env");
const executionQueue_1 = require("./src/queue/executionQueue");
const scheduleHandler_1 = require("./src/triggers/scheduleHandler");
const SocketService_1 = require("./src/services/SocketService");
// ============================================
// AXLE AGENT EXECUTION ENGINE
// ============================================
// Event-driven agent runtime.
// Agents are activated by triggers, not continuously running.
// ============================================
const startServer = async () => {
    // Connect to database
    await (0, db_1.connectDB)();
    // Initialize Express
    const app = (0, express_1.default)();
    // Security & Parsing
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, cookie_parser_1.default)());
    // CORS
    app.use((0, cors_1.default)({
        origin: "https://heyaxle.vercel.app",
        credentials: true
    }));
    // Rate limiting
    // app.use(globalRateLimiter);
    // Routes
    const apiVersion = env_1.env.API_VERSION || "v1";
    app.use(`/api/${apiVersion}`, routes_1.default);
    // Health checks (no rate limit)
    app.use("/health", health_1.default);
    // 404 Handler
    app.use((_req, res) => {
        res.status(404).json({ error: "Not Found" });
    });
    // Error Handler
    app.use((err, _req, res, _next) => {
        logger_1.logger.error("Unhandled error:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    });
    // Create HTTP server
    const server = http_1.default.createServer(app);
    // Initialize WebSocket
    SocketService_1.SocketService.getInstance().init(server);
    // Start server
    const PORT = env_1.env.PORT || 9000;
    server.listen(PORT, () => {
        const envLabel = env_1.env.IS_PROD ? "PRODUCTION" : "development";
        logger_1.logger.info(`[${envLabel}] Axle API listening on http://localhost:${PORT}`);
        logger_1.logger.info(`API v${apiVersion}: /api/${apiVersion}/`);
        logger_1.logger.info(`Health: http://localhost:${PORT}/health/live`);
    });
    // Initialize queue scheduler
    await (0, executionQueue_1.initQueueScheduler)();
    logger_1.logger.info("Queue scheduler initialized");
    // Start worker
    const { startWorker } = await Promise.resolve().then(() => __importStar(require("./src/worker")));
    startWorker();
    logger_1.logger.info("Worker started");
    // Initialize schedule triggers
    await (0, scheduleHandler_1.initScheduler)();
    const { initSchedulerWorker } = await Promise.resolve().then(() => __importStar(require("./src/worker/scheduler")));
    initSchedulerWorker(); // Start consumer
    logger_1.logger.info("Scheduler initialized");
    // Graceful shutdown
    const shutdown = async (signal) => {
        logger_1.logger.info(`Received ${signal}, shutting down...`);
        server.close(() => {
            logger_1.logger.info("HTTP server closed");
            process.exit(0);
        });
        // Force exit after 10s
        setTimeout(() => {
            logger_1.logger.error("Forced shutdown after timeout");
            process.exit(1);
        }, 10000);
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
};
// Start
startServer().catch(err => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
