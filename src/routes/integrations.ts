import { Router, Request, Response } from "express";
import * as oauthController from "../controllers/oauth";
import { authMiddleware } from "../middleware/auth";
import { makeGithubRequest } from "../lib/api";

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

// Frontend-friendly alias for starting OAuth flow
// e.g. GET /integrations/google/connect -> { url }
router.get("/:provider/connect", oauthController.getAuthUrl);

// OAuth callback (usually hit by redirect, but can work with code)
router.get("/:provider/callback", oauthController.handleCallback);

// Disconnect integration
router.delete("/:provider", oauthController.disconnectIntegration);

// Refresh integration token
router.post("/:provider/refresh", oauthController.refreshIntegrationToken);

// Get GitHub repositories
router.get("/github/repos", async (req: Request, res: Response) => {
  try {
    const repos = await makeGithubRequest(req.user!.id, "/user/repos?per_page=100&sort=updated");
    res.json({ repos: repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      description: repo.description,
      updated_at: repo.updated_at
    })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
