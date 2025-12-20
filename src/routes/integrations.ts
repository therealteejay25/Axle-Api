import { Router, Request, Response } from "express";
import { Integration } from "../models/Integration";
import { encryptToken, decryptToken } from "../services/crypto";
import { authMiddleware } from "../middleware/auth";

// ============================================
// INTEGRATIONS ROUTES
// ============================================

const router = Router();

router.use(authMiddleware);

// List user's integrations
router.get("/", async (req: Request, res: Response) => {
  try {
    const integrations = await Integration.find({ 
      userId: req.user!.id 
    }).select("-accessToken -refreshToken").lean();
    
    res.json({ integrations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get integration status
router.get("/:provider", async (req: Request, res: Response) => {
  try {
    const integration = await Integration.findOne({
      userId: req.user!.id,
      provider: req.params.provider
    }).select("-accessToken -refreshToken").lean();
    
    if (!integration) {
      return res.json({ 
        connected: false, 
        provider: req.params.provider 
      });
    }
    
    res.json({ 
      connected: true,
      integration 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Connect integration (store tokens from OAuth callback)
router.post("/:provider/connect", async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { accessToken, refreshToken, scopes, metadata, expiresIn } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: "accessToken is required" });
    }
    
    // Encrypt tokens
    const encryptedAccessToken = encryptToken(accessToken);
    const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : undefined;
    
    // Calculate expiry
    const tokenExpiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000)
      : undefined;
    
    // Upsert integration
    const integration = await Integration.findOneAndUpdate(
      { userId: req.user!.id, provider },
      {
        userId: req.user!.id,
        provider,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        scopes: scopes || [],
        metadata: metadata || {},
        status: "connected",
        connectedAt: new Date()
      },
      { upsert: true, new: true }
    ).select("-accessToken -refreshToken");
    
    res.json({ 
      success: true,
      integration 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect integration
router.delete("/:provider", async (req: Request, res: Response) => {
  try {
    const result = await Integration.findOneAndDelete({
      userId: req.user!.id,
      provider: req.params.provider
    });
    
    if (!result) {
      return res.status(404).json({ error: "Integration not found" });
    }
    
    res.json({ 
      disconnected: true, 
      provider: req.params.provider 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke integration (mark as revoked without deleting)
router.post("/:provider/revoke", async (req: Request, res: Response) => {
  try {
    const integration = await Integration.findOneAndUpdate(
      { userId: req.user!.id, provider: req.params.provider },
      { status: "revoked" },
      { new: true }
    ).select("-accessToken -refreshToken");
    
    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }
    
    res.json({ revoked: true, integration });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh integration token
router.post("/:provider/refresh", async (req: Request, res: Response) => {
  try {
    const { accessToken, refreshToken, expiresIn } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: "accessToken is required" });
    }
    
    const encryptedAccessToken = encryptToken(accessToken);
    const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : undefined;
    
    const tokenExpiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000)
      : undefined;
    
    const updateData: any = {
      accessToken: encryptedAccessToken,
      tokenExpiresAt,
      status: "connected"
    };
    
    if (encryptedRefreshToken) {
      updateData.refreshToken = encryptedRefreshToken;
    }
    
    const integration = await Integration.findOneAndUpdate(
      { userId: req.user!.id, provider: req.params.provider },
      updateData,
      { new: true }
    ).select("-accessToken -refreshToken");
    
    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }
    
    res.json({ refreshed: true, integration });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
