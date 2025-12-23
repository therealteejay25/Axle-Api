import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { AxleChatbot } from "../services/axleChatbot";
import { ChatSession } from "../models/ChatSession";

const router = Router();

router.use(authMiddleware);

/**
 * Handle user messages to the chatbot.
 */
router.post("/message", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const result = await AxleChatbot.processMessage(req.user!.id, message);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get chat history for the user.
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const session = await ChatSession.findOne({ userId: req.user!.id }).lean();
    res.json({ messages: session?.messages || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Clear chat history.
 */
router.delete("/history", async (req: Request, res: Response) => {
  try {
    await ChatSession.deleteOne({ userId: req.user!.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
