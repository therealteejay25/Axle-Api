import { Router } from "express";
import * as oauthController from "../controllers/oauth";
import { authMiddleware } from "../middleware/auth";

// ============================================
// INTEGRATIONS ROUTES
// ============================================
// OAuth flows and integration management.
// ============================================

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all integrations status
router.get("/", oauthController.getIntegrationsStatus);

// Get single integration status
router.get("/:provider", oauthController.getIntegrationStatus);

// Start OAuth flow - returns auth URL
router.get("/:provider/auth", oauthController.getAuthUrl);

// OAuth callback (usually hit by redirect, but can work with code)
router.get("/:provider/callback", oauthController.handleCallback);

// Disconnect integration
router.delete("/:provider", oauthController.disconnectIntegration);

// Refresh integration token
router.post("/:provider/refresh", oauthController.refreshIntegrationToken);

export default router;
