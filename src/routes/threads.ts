import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { ContextManagerService } from "../services/ContextManagerService";
import { Thread } from "../models/Thread";

const router = Router();

router.use(authMiddleware);

// List threads for an agent
router.get("/", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.query;
    const ownerId = req.user!.id;

    const query: any = { ownerId };
    if (agentId) {
      query.agentId = agentId;
    }

    const threads = await Thread.find(query)
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    res.json({ threads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { agentId, title, metadata } = req.body || {};

    const thread = await ContextManagerService.createThread({
      ownerId: req.user!.id,
      agentId,
      title,
      metadata,
    });

    res.json({ thread });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const thread = await ContextManagerService.getThread({
      ownerId: req.user!.id,
      threadId: req.params.id,
    });

    if (!thread) return res.status(404).json({ error: "Thread not found" });

    res.json({ thread });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.put("/:id/github-repo", async (req: Request, res: Response) => {
  try {
    const { githubRepo, requestedFiles } = req.body || {};

    if (!githubRepo?.owner || !githubRepo?.repo) {
      return res
        .status(400)
        .json({ error: "githubRepo.owner and githubRepo.repo are required" });
    }

    const thread = await ContextManagerService.setThreadGithubRepo({
      ownerId: req.user!.id,
      threadId: req.params.id,
      githubRepo,
      requestedFiles,
    });

    res.json({ thread });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { title, metadata } = req.body || {};
    const ownerId = req.user!.id;
    const threadId = req.params.id;

    const thread = await Thread.findOne({ _id: threadId, ownerId });
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    if (title !== undefined) {
      thread.title = title;
    }
    if (metadata !== undefined) {
      thread.metadata = { ...thread.metadata, ...metadata };
    }

    await thread.save();
    res.json({ thread });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
