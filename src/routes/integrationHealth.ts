import { Router, Request, Response } from "express";
import { Integration } from "../models/Integration";
import { authMiddleware } from "../middleware/auth";

// ============================================
// INTEGRATION HEALTH ROUTES
// ============================================
// Check status of user's integrations,
// token expiry, missing scopes, etc.
// ============================================

const router = Router();

router.use(authMiddleware);

// Get health status of all integrations
router.get("/", async (req: Request, res: Response) => {
  try {
    const integrations = await Integration.find({ userId: req.user!.id }).lean();

    const healthChecks = integrations.map(int => {
      const now = Date.now();
      const expiresAt = int.tokenExpiresAt ? new Date(int.tokenExpiresAt).getTime() : null;

      let status: "healthy" | "warning" | "expired" = "healthy";
      let message = "Integration is healthy";

      if (expiresAt) {
        const timeUntilExpiry = expiresAt - now;
        const daysUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60 * 24));

        if (timeUntilExpiry <= 0) {
          status = "expired";
          message = "Token has expired. Reconnect this integration.";
        } else if (daysUntilExpiry <= 7) {
          status = "warning";
          message = `Token expires in ${daysUntilExpiry} day(s). Consider reconnecting soon.`;
        }
      }

      // Check for common missing scopes
      const commonScopes: Record<string, string[]> = {
        github: ["repo", "read:org", "user"],
        google: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/gmail.send"],
        slack: ["chat:write", "channels:read"],
        twitter: ["tweet.read", "tweet.write"],
        instagram: ["instagram_basic", "instagram_content_publish"]
      };

      const expectedScopes = commonScopes[int.provider] || [];
      const missingScopes = expectedScopes.filter(scope =>
        !int.scopes.some(s => s.includes(scope) || scope.includes(s))
      );

      if (missingScopes.length > 0 && status === "healthy") {
        status = "warning";
        message = `Some recommended scopes are missing: ${missingScopes.join(", ")}`;
      }

      return {
        provider: int.provider,
        connected: true,
        status,
        message,
        expiresAt: int.tokenExpiresAt,
        expiresInDays: expiresAt ? Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24)) : null,
        scopes: int.scopes,
        missingRecommendedScopes: missingScopes,
        lastUsed: int.lastUsedAt || int.createdAt
      };
    });

    const summary = {
      total: healthChecks.length,
      healthy: healthChecks.filter(h => h.status === "healthy").length,
      warnings: healthChecks.filter(h => h.status === "warning").length,
      expired: healthChecks.filter(h => h.status === "expired").length
    };

    res.json({
      summary,
      integrations: healthChecks
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get health for a specific integration
router.get("/:provider", async (req: Request, res: Response) => {
  try {
    const integration = await Integration.findOne({
      userId: req.user!.id,
      provider: req.params.provider
    }).lean();

    if (!integration) {
      return res.status(404).json({
        error: `${req.params.provider} integration not found`,
        connected: false
      });
    }

    res.json({
      provider: integration.provider,
      connected: true,
      scopes: integration.scopes,
      expiresAt: integration.tokenExpiresAt,
      createdAt: integration.createdAt,
      lastUsed: integration.lastUsedAt
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
