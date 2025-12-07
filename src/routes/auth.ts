import { Router } from "express";
import { requestMagicLinkController, verifyMagicLinkController, refreshTokenController } from "../controllers/auth";
import { requireAuth } from "../middleware/auth";
import { AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/", requestMagicLinkController);
router.post("/verify", verifyMagicLinkController);
router.post("/refresh", refreshTokenController);

// Get current user info
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: (req as AuthRequest).user });
});

export default router;
