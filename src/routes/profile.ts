import { Router, Request, Response } from "express";
import { User } from "../models/User";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

// Get user profile
router.get("/profile", async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id)
      .lean();
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update user profile
router.patch("/profile", async (req: Request, res: Response) => {
  try {
    const { name, timeZone, profileImageUrl } = req.body;
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (name) user.name = name;
    if (timeZone) user.timeZone = timeZone;
    if (profileImageUrl) user.profileImageUrl = profileImageUrl;

    await user.save();
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
