import express from "express";
import { Request, Response } from "express";
import { protect } from "../middleware/auth";
import {
  getSettings,
  updateSettings,
  completeOnboarding,
} from "../controllers/settings";

const router = express.Router();

// Get user settings
router.get("/", protect, async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    const result = await getSettings(req, res);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update user settings
router.patch("/", protect, async (req: Request, res: Response) => {
  try {
    const result = await updateSettings(req, res);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Complete onboarding
router.post("/onboarding", protect, async (req: Request, res: Response) => {
  try {
    const result = await completeOnboarding(req, res);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
