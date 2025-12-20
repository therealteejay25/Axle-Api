import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, { Request, Response, NextFunction } from "express";
import http from "http";
import cookieParser from "cookie-parser";

import router from "./src/routes";
import healthRouter from "./src/routes/health";
import { connectDB } from "./src/lib/db";
import { logger } from "./src/services/logger";
import { env } from "./src/config/env";
import { globalRateLimiter } from "./src/middleware/rateLimit";
import { initQueueScheduler } from "./src/queue/executionQueue";
import { startWorker } from "./src/worker";
import { initScheduler } from "./src/triggers/scheduleHandler";

// ============================================
// AXLE AGENT EXECUTION ENGINE
// ============================================
// Event-driven agent runtime.
// Agents are activated by triggers, not continuously running.
// ============================================

const startServer = async () => {
  // Connect to database
  await connectDB();
  
  // Initialize Express
  const app = express();
  
  // Security & Parsing
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  
  // CORS
  app.use(cors({
    origin: env.ALLOWED_ORIGINS.split(",").map(o => o.trim()),
    credentials: true
  }));
  
  // Rate limiting
  app.use(globalRateLimiter);
  
  // Routes
  const apiVersion = env.API_VERSION || "v1";
  app.use(`/api/${apiVersion}`, router);
  
  // Health checks (no rate limit)
  app.use("/health", healthRouter);
  
  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found" });
  });
  
  // Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("Unhandled error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  // Create HTTP server
  const server = http.createServer(app);
  
  // Start server
  const PORT = env.PORT || 9000;
  server.listen(PORT, () => {
    const envLabel = env.IS_PROD ? "PRODUCTION" : "development";
    logger.info(`[${envLabel}] Axle API listening on http://localhost:${PORT}`);
    logger.info(`API v${apiVersion}: /api/${apiVersion}/`);
    logger.info(`Health: http://localhost:${PORT}/health/live`);
  });
  
  // Initialize queue scheduler
  await initQueueScheduler();
  logger.info("Queue scheduler initialized");
  
  // Start worker
  startWorker();
  logger.info("Worker started");
  
  // Initialize schedule triggers
  await initScheduler();
  logger.info("Scheduler initialized");
  
  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
    
    // Force exit after 10s
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
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
