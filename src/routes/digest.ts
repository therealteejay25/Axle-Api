import { Router, Request, Response } from "express";
import { Queue } from "bullmq";
import { redis } from "../config/redis";
import { DailyDigest } from "../models/DailyDigest";
import { authMiddleware } from "../middleware/auth";
import { logger } from "../services/logger";

const router = Router();
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Create digest generation queue
const digestQueue = new Queue("digest-generation", {
  connection: redis,
});

router.use(authMiddleware);

// GET /api/digest - Get or generate digest
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check for cached digest
    const cached = await DailyDigest.findOne({ user: userId });
    if (cached) {
      const age = Date.now() - cached.createdAt.getTime();
      if (age < CACHE_DURATION_MS) {
        return res.json({
          digest: cached.data,
          cached: true,
        });
      }
    }

    // No fresh cache, enqueue generation job
    await digestQueue.add(
      "generate",
      { userId },
      {
        jobId: `digest-${userId}`,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    logger.info(`Enqueued digest generation for user ${userId}`);

    res.status(202).json({
      status: "generating",
    });
  } catch (err: any) {
    logger.error("Digest GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/digest/status - Check digest status
router.get("/status", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check for fresh digest
    const cached = await DailyDigest.findOne({ user: userId });
    if (cached) {
      const age = Date.now() - cached.createdAt.getTime();
      if (age < CACHE_DURATION_MS) {
        return res.json({
          ready: true,
          digest: cached.data,
        });
      }
    }

    res.json({
      ready: false,
    });
  } catch (err: any) {
    logger.error("Digest status error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/digest/refresh - Force refresh digest
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Delete existing digest
    await DailyDigest.deleteOne({ user: userId });

    // Enqueue fresh generation job
    await digestQueue.add(
      "generate",
      { userId },
      {
        jobId: `digest-${userId}`,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    logger.info(`Enqueued digest refresh for user ${userId}`);

    res.json({
      status: "refreshing",
    });
  } catch (err: any) {
    logger.error("Digest refresh error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
