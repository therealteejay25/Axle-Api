import { Router } from "express";
import * as authController from "../controllers/auth";
import { authMiddleware } from "../middleware/auth";

// ============================================
// AUTH ROUTES
// ============================================

const router = Router();

// Public routes
router.post("/magic-link", authController.requestMagicLink);
router.post("/verify", authController.verifyMagicLink);
router.post("/refresh", authController.refreshTokens);
router.post("/logout", authController.logout);
router.get("/me", authController.getCurrentUser);

// Protected routes
router.patch("/profile", authMiddleware, authController.updateProfile);

export default router;
