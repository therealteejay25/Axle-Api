import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { AxleChatbot } from "../services/axleChatbot";
import { ChatSession } from "../models/ChatSession";

const router = Router();

router.use(authMiddleware);

/**
 * Handle user messages to the chatbot with STREAMING (SSE).
 */
router.post("/stream", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = AxleChatbot.processMessageStream(req.user!.id, message);

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
       res.status(500).json({ error: err.message });
    } else {
       res.write(`data: ${JSON.stringify({ type: "error", data: err.message })}\n\n`);
       res.end();
    }
  }
});


/**
 * Handle user messages to the chatbot (Legacy non-stream).
 */
router.post("/message", async (req: Request, res: Response) => {
  try {
    // Legacy support or fallback
    return res.status(400).json({ error: "Use /stream for this version" });
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
