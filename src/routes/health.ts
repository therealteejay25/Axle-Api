import { Router, Request, Response } from "express";

// ============================================
// HEALTH ROUTES
// ============================================

const router = Router();

// Liveness check
router.get("/live", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness check
router.get("/ready", async (req: Request, res: Response) => {
  try {
    // Check database
    const mongoose = await import("mongoose");
    const dbReady = mongoose.connection.readyState === 1;
    
    // Check Redis
    const { redis } = await import("../lib/redis");
    const redisReady = redis.status === "ready";
    
    if (dbReady && redisReady) {
      res.json({ 
        status: "ready",
        db: "connected",
        redis: "connected"
      });
    } else {
      res.status(503).json({
        status: "not ready",
        db: dbReady ? "connected" : "disconnected",
        redis: redisReady ? "connected" : "disconnected"
      });
    }
  } catch (err: any) {
    res.status(503).json({ 
      status: "error", 
      error: err.message 
    });
  }
});

export default router;
