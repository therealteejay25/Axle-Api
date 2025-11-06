import express from "express";
import { Request, Response } from "express";
import { protect } from "../middleware/auth";
import { getHistory, clearHistory } from "../services/historyService";

const router = express.Router();

// Get user's interaction history
router.get("/", protect, async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    const history = await getHistory(userId);
    res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Clear user's history
router.delete("/", protect, async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    await clearHistory(userId);
    res.json({
      success: true,
      message: "History cleared successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
