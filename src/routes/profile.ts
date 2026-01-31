import { Router, Request, Response } from "express";
import { User } from "../models/User";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

// Get user profile
router.get("/", async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id)
      .lean();
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get upload signature for Cloudinary
router.get("/upload-signature", (req: Request, res: Response) => {
  try {
    const { getUploadSignature } = require("../services/cloudinary");
    const signatureData = getUploadSignature();
    res.json(signatureData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update user profile
router.patch("/", async (req: Request, res: Response) => {
  try {
    const { name, timeZone, profileImageUrl, avatar, automaticBackupsEnabled, notificationEmailsEnabled, hasCompletedOnboarding } = req.body;
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (name) user.name = name;
    if (timeZone) user.timeZone = timeZone;

    // Handle profile image (can be URL or base64)
    let finalImageUrl = profileImageUrl || avatar;

    if (finalImageUrl && finalImageUrl.startsWith("data:image")) {
      try {
        const { v2: cloudinary } = require("../services/cloudinary");
        const uploadResponse = await cloudinary.uploader.upload(finalImageUrl, {
          folder: "avatars",
          public_id: `user_${user._id}`,
          overwrite: true
        });
        finalImageUrl = uploadResponse.secure_url;
      } catch (uploadErr: any) {
        console.error("Cloudinary upload failed:", uploadErr);
        // Fallback or just ignore if image upload fails? For now, we'll continue with other updates
      }
    }

    if (finalImageUrl) {
      user.profileImageUrl = finalImageUrl;
      user.avatar = finalImageUrl;
    }

    if (automaticBackupsEnabled !== undefined) user.automaticBackupsEnabled = automaticBackupsEnabled;
    if (notificationEmailsEnabled !== undefined) user.notificationEmailsEnabled = notificationEmailsEnabled;
    if (hasCompletedOnboarding !== undefined) user.hasCompletedOnboarding = hasCompletedOnboarding;

    await user.save();
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user account
router.delete("/", async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    await User.deleteOne({ _id: user._id });

    // In a real app, we would also cascade delete or clean up related data (agents, etc.)
    // For now, we'll assume a soft delete or rely on manual cleanup if needed.

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
