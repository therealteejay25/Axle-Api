import { Router } from "express";
import { requestMagicLinkController, verifyMagicLinkController, refreshTokenController, logoutController } from "../controllers/auth";
import { requireAuth } from "../middleware/auth";
import { AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/", requestMagicLinkController);
router.post("/verify", verifyMagicLinkController);
router.post("/refresh", refreshTokenController);
router.post("/logout", requireAuth, logoutController);

// Get current user info
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: (req as AuthRequest).user });
});

export default router;
