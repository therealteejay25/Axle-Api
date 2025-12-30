import { Router, Request, Response } from "express";
import { Integration } from "../models/Integration";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

// List all platforms and their connection status
router.get("/", async (req: Request, res: Response) => {
  try {
    const integrations = await Integration.find({ 
      ownerId: req.user!.id,
      status: "connected"
    }).lean();

    const platforms = [
      { id: "github", name: "GitHub", category: "Code" },
      { id: "slack", name: "Slack", category: "Communication" },
      { id: "x", name: "X (Twitter)", category: "Social" },
      { id: "google", name: "Google Workspace", category: "Tools" },
      { id: "instagram", name: "Instagram", category: "Social" }
    ];

    const platformStatus = platforms.map(p => ({
      ...p,
      connected: integrations.some(i => i.provider === p.id),
      lastUsedAt: integrations.find(i => i.provider === p.id)?.lastUsedAt
    }));

    res.json({ platforms: platformStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync platform endpoint (triggering a refresh/check)
router.post("/:provider/sync", async (req: Request, res: Response) => {
  try {
    // Logic to verify token validity would go here
    res.json({ success: true, status: "connected" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
