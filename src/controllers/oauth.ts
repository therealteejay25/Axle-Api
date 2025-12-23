import { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { Integration } from "../models/Integration";
import { encryptToken } from "../services/crypto";
import { env } from "../config/env";
import { logger } from "../services/logger";

// ============================================
// OAUTH CONTROLLER
// ============================================
// Handles OAuth flows for all providers.
// ============================================

type OAuthProvider = "github" | "google" | "slack" | "twitter" | "instagram";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  userInfoUrl?: string;
}

// Provider configurations
const getProviderConfig = (provider: OAuthProvider): OAuthConfig | null => {
  switch (provider) {
    case "github":
      return {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectUri: env.GITHUB_REDIRECT_URI,
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        scopes: ["repo", "user", "read:org"],
        userInfoUrl: "https://api.github.com/user"
      };
    case "google":
      return env.GOOGLE_CLIENT_ID ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        redirectUri: env.GOOGLE_REDIRECT_URI!,
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: [
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/userinfo.email"
        ],
        userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo"
      } : null;
    case "slack":
      return env.SLACK_CLIENT_ID ? {
        clientId: env.SLACK_CLIENT_ID,
        clientSecret: env.SLACK_CLIENT_SECRET!,
        redirectUri: env.SLACK_REDIRECT_URI!,
        authUrl: "https://slack.com/oauth/v2/authorize",
        tokenUrl: "https://slack.com/api/oauth.v2.access",
        scopes: ["chat:write", "channels:read", "users:read"],
        userInfoUrl: "https://slack.com/api/auth.test"
      } : null;
    case "twitter":
    case "x" as any:
      return env.X_CLIENT_ID ? {
        clientId: env.X_CLIENT_ID,
        clientSecret: env.X_CLIENT_SECRET!,
        redirectUri: env.X_REDIRECT_URI!,
        authUrl: "https://twitter.com/i/oauth2/authorize",
        tokenUrl: "https://api.twitter.com/2/oauth2/token",
        scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
        userInfoUrl: "https://api.twitter.com/2/users/me"
      } : null;
    case "instagram":
      return env.INSTAGRAM_CLIENT_ID ? {
        clientId: env.INSTAGRAM_CLIENT_ID,
        clientSecret: env.INSTAGRAM_CLIENT_SECRET!,
        redirectUri: env.INSTAGRAM_REDIRECT_URI!,
        authUrl: "https://api.instagram.com/oauth/authorize",
        tokenUrl: "https://api.instagram.com/oauth/access_token",
        scopes: ["user_profile", "user_media"],
        userInfoUrl: "https://graph.instagram.com/me"
      } : null;
    default:
      return null;
  }
};

// ==================== OAUTH FLOW ====================

// Step 1: Get OAuth authorization URL
export const getAuthUrl = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params as { provider: OAuthProvider };
    const config = getProviderConfig(provider);
    
    if (!config) {
      return res.status(400).json({ 
        error: `Provider ${provider} not configured`,
        configured: false 
      });
    }
    
    // Generate state for CSRF protection
    // For Twitter, also include code_verifier for PKCE
    let codeVerifier: string | undefined;
    if (provider === "twitter") {
      // Generate random code_verifier (43-128 chars, URL-safe)
      codeVerifier = crypto.randomBytes(32).toString("base64url");
    }
    
    const state = Buffer.from(JSON.stringify({
      userId: req.user!.id,
      provider,
      timestamp: Date.now(),
      codeVerifier // Store for Twitter PKCE
    })).toString("base64");
    
    // Build auth URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(" "),
      state,
      response_type: "code"
    });
    
    // Provider-specific params
    if (provider === "google") {
      params.append("access_type", "offline");
      params.append("prompt", "consent");
    }
    if (provider === "twitter" && codeVerifier) {
      // Generate code_challenge from code_verifier using S256
      const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");
      params.append("code_challenge", codeChallenge);
      params.append("code_challenge_method", "S256");
    }
    
    const authUrl = `${config.authUrl}?${params.toString()}`;
    
    res.json({ 
      authUrl,
      provider,
      configured: true
    });
  } catch (err: any) {
    logger.error("Failed to generate auth URL", { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// Step 2: Handle OAuth callback
export const handleCallback = async (req: Request, res: Response) => {
  try {
    let { provider } = req.params as { provider: OAuthProvider };
    
    // Normalize x to twitter
    if (provider as string === "x") provider = "twitter";
    
    const { code, state, error } = req.query;
    
    if (error) {
      return res.status(400).json({ error: `OAuth error: ${error}` });
    }
    
    if (!code || !state) {
      return res.status(400).json({ error: "Missing code or state" });
    }
    
    // Decode and verify state
    let stateData: any;
    try {
      stateData = JSON.parse(Buffer.from(state as string, "base64").toString());
    } catch {
      return res.status(400).json({ error: "Invalid state" });
    }
    
    // Check state freshness (15 min max)
    if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
      return res.status(400).json({ error: "State expired" });
    }
    
    const config = getProviderConfig(provider);
    if (!config) {
      return res.status(400).json({ error: `Provider ${provider} not configured` });
    }
    
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(
      provider, 
      code as string, 
      config,
      stateData.codeVerifier // Pass code_verifier for Twitter
    );
    
    // Get user info if available
    let metadata: Record<string, any> = {};
    if (config.userInfoUrl && tokenResponse.access_token) {
      try {
        metadata = await getUserInfo(provider, tokenResponse.access_token, config);
      } catch (e: any) {
        logger.warn("Failed to get user info", { provider, error: e.message });
      }
    }
    
    // Encrypt tokens
    const encryptedAccessToken = encryptToken(tokenResponse.access_token);
    const encryptedRefreshToken = tokenResponse.refresh_token 
      ? encryptToken(tokenResponse.refresh_token) 
      : undefined;
    
    // Save integration
    const integration = await Integration.findOneAndUpdate(
      { userId: stateData.userId, provider },
      {
        userId: stateData.userId,
        provider,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokenResponse.expires_in 
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : undefined,
        scopes: config.scopes,
        metadata,
        status: "connected",
        connectedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    logger.info("OAuth integration connected", { 
      userId: stateData.userId, 
      provider,
      integrationId: integration._id 
    });
    
    // Redirect to frontend success page
    const frontendUrl = env.ALLOWED_ORIGINS.split(",")[0].trim();
    res.redirect(`${frontendUrl}/integrations/${provider}/success`);
  } catch (err: any) {
    logger.error("OAuth callback failed", { error: err.message });
    const frontendUrl = env.ALLOWED_ORIGINS.split(",")[0].trim();
    res.redirect(`${frontendUrl}/integrations/error?message=${encodeURIComponent(err.message)}`);
  }
};

// Exchange authorization code for tokens
const exchangeCodeForTokens = async (
  provider: OAuthProvider,
  code: string,
  config: OAuthConfig,
  codeVerifier?: string // For Twitter PKCE
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> => {
  const params: Record<string, string> = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code"
  };
  
  // Twitter uses PKCE with code_verifier
  if (provider === "twitter" && codeVerifier) {
    params.code_verifier = codeVerifier;
  }
  
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json"
  };
  
  // Twitter uses Basic auth
  if (provider === "twitter" || provider as string === "x") {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
    // For Twitter v2 with Basic auth, client_id and client_secret should be removed from body
    delete params.client_secret;
    delete params.client_id;
  }
  
  try {
    const response = await axios.post(
      config.tokenUrl,
      new URLSearchParams(params).toString(),
      { headers }
    );
    
    return response.data;
  } catch (error: any) {
    logger.error("Token exchange failed", { 
      provider, 
      status: error.response?.status,
      data: error.response?.data 
    });
    throw new Error(error.response?.data?.error_description || error.message);
  }
};

// Get user info from provider
const getUserInfo = async (
  provider: OAuthProvider,
  accessToken: string,
  config: OAuthConfig
): Promise<Record<string, any>> => {
  if (!config.userInfoUrl) return {};
  
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json"
  };
  
  // GitHub uses different header
  if (provider === "github") {
    headers["Authorization"] = `token ${accessToken}`;
  }
  
  // Normalize twitter/x
  if (provider as string === "x") provider = "twitter";
  
  // Slack needs token as query param
  let url = config.userInfoUrl;
  if (provider === "slack") {
    url += `?token=${accessToken}`;
    delete headers["Authorization"];
  }
  
  // Instagram needs fields
  if (provider === "instagram") {
    url += `?fields=id,username&access_token=${accessToken}`;
    delete headers["Authorization"];
  }
  
  const response = await axios.get(url, { headers });
  return response.data;
};

// ==================== STATUS & MANAGEMENT ====================

// Get all integrations status
export const getIntegrationsStatus = async (req: Request, res: Response) => {
  try {
    const integrations = await Integration.find({ 
      userId: req.user!.id 
    }).select("-accessToken -refreshToken").lean();
    
    // Build status for all providers
    const providers: OAuthProvider[] = ["github", "google", "slack", "twitter", "instagram"];
    const status = providers.map(provider => {
      const config = getProviderConfig(provider);
      const integration = integrations.find(i => i.provider === provider);
      
      return {
        provider,
        configured: !!config,
        connected: integration?.status === "connected",
        status: integration?.status || "disconnected",
        connectedAt: integration?.connectedAt,
        metadata: integration?.metadata,
        scopes: integration?.scopes
      };
    });
    
    res.json({ integrations: status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Get single integration status
export const getIntegrationStatus = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const config = getProviderConfig(provider as OAuthProvider);
    
    const integration = await Integration.findOne({
      userId: req.user!.id,
      provider
    }).select("-accessToken -refreshToken").lean();
    
    res.json({
      provider,
      configured: !!config,
      connected: integration?.status === "connected",
      status: integration?.status || "disconnected",
      connectedAt: integration?.connectedAt,
      metadata: integration?.metadata,
      scopes: integration?.scopes
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Disconnect integration
export const disconnectIntegration = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    
    const result = await Integration.findOneAndDelete({
      userId: req.user!.id,
      provider
    });
    
    if (!result) {
      return res.status(404).json({ error: "Integration not found" });
    }
    
    logger.info("Integration disconnected", { 
      userId: req.user!.id, 
      provider 
    });
    
    res.json({ 
      disconnected: true, 
      provider,
      status: "disconnected"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Refresh integration token
export const refreshIntegrationToken = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params as { provider: OAuthProvider };
    
    const integration = await Integration.findOne({
      userId: req.user!.id,
      provider
    });
    
    if (!integration || !integration.refreshToken) {
      return res.status(400).json({ error: "No refresh token available" });
    }
    
    const config = getProviderConfig(provider);
    if (!config) {
      return res.status(400).json({ error: `Provider ${provider} not configured` });
    }
    
    // Decrypt refresh token
    const { decryptToken } = await import("../services/crypto");
    const refreshToken = decryptToken(integration.refreshToken);
    
    // Request new tokens
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    });
    
    const response = await axios.post(
      config.tokenUrl,
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    
    // Update tokens
    integration.accessToken = encryptToken(response.data.access_token);
    if (response.data.refresh_token) {
      integration.refreshToken = encryptToken(response.data.refresh_token);
    }
    if (response.data.expires_in) {
      integration.tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);
    }
    integration.status = "connected";
    
    await integration.save();
    
    res.json({ 
      refreshed: true,
      provider,
      status: "connected"
    });
  } catch (err: any) {
    logger.error("Token refresh failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

export default {
  getAuthUrl,
  handleCallback,
  getIntegrationsStatus,
  getIntegrationStatus,
  disconnectIntegration,
  refreshIntegrationToken
};
