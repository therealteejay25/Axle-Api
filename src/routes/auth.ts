import { Router } from "express";
import * as authController from "../controllers/auth";
import { authMiddleware } from "../middleware/auth";

// ============================================
// AUTH ROUTES
// ============================================

const router = Router();

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/magic-link", authController.requestMagicLink);
router.post("/verify", authController.verifyMagicLink);
router.post("/refresh", authController.refreshTokens);
router.post("/logout", authController.logout);
router.get("/me", authController.getCurrentUser);

// Google OAuth authentication
router.get("/google", authController.getGoogleAuthUrl);
router.get("/google/callback", authController.handleGoogleAuthCallback);

// Protected routes
router.patch("/profile", authMiddleware, authController.updateProfile);
router.post("/change-password", authMiddleware, authController.changePassword);

export default router;
