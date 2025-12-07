import { Request, Response } from "express";
import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import redis from "../lib/redis";

/**
 * Liveness probe: returns 200 if service is running.
 */
export const livenessProbeController = (_req: Request, res: Response) => {
  res.json({ status: "alive", timestamp: new Date().toISOString() });
};

/**
 * Readiness probe: checks dependencies (MongoDB, Redis).
 */
export const readinessProbeController = async (
  _req: Request,
  res: Response
) => {
  const checks: Record<string, boolean> = {
    mongodb: mongoose.connection.readyState === 1,
    redis: false,
  };

  try {
    const pingResult = await redis.ping();
    checks.redis = pingResult === "PONG";
  } catch (err) {
    logger.error("Redis health check failed", err);
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

export default {};
