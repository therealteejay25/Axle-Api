import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import router from "./src/routes";
import healthRouter from "./src/routes/health";
import { connectDB } from "./src/lib/db";
import { logger } from "./src/lib/logger";
import { env } from "./src/config/env";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { requestLoggingMiddleware } from "./src/middleware/logging";
import { perUserRateLimitMiddleware } from "./src/middleware/rateLimitPerUser";

dotenv.config();

connectDB();

const apiVersion = env.API_VERSION;

const app = express();

// Request logging middleware
app.use(requestLoggingMiddleware);

// Security: Parse JSON with size limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS with strict origin validation in production
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  })
);

// Global rate limiting (IP-based)
const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
});

app.use(`/api/${apiVersion}/`, apiLimiter, perUserRateLimitMiddleware, router);

// Health checks (outside API limiter)
app.use("/health", healthRouter);

// 404 Handler
app.use((_req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({ error: "Endpoint Not Found" });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = env.PORT || 9000;

import http from "http";
import { initRealtime } from "./src/services/realtime";
import { startScheduler } from "./src/services/scheduler";

const server = http.createServer(app);

// initialize realtime socket.io server
initRealtime(server);

server.listen(PORT, () => {
  const env_label = env.IS_PROD ? "PRODUCTION" : "development";
  logger.info(
    `[${env_label}] Express server listening on http://localhost:${PORT}`
  );
  logger.info(`API v${apiVersion}: /api/${apiVersion}/`);
  logger.info(`Health checks: http://localhost:${PORT}/health/live`);
});

// Start persistent scheduler (BullMQ) to process scheduled agent runs
startScheduler().catch((err) => {
  logger.error("Failed to start scheduler", err);
});
