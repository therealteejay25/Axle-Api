"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshIntegrationToken = exports.disconnectIntegration = exports.getIntegrationStatus = exports.getIntegrationsStatus = exports.handleCallback = exports.getAuthUrl = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const Integration_1 = require("../models/Integration");
const crypto_2 = require("../services/crypto");
const env_1 = require("../config/env");
const logger_1 = require("../services/logger");
// Provider configurations
const getProviderConfig = (provider) => {
    switch (provider) {
        case "github":
            return {
                clientId: env_1.env.GITHUB_CLIENT_ID,
                clientSecret: env_1.env.GITHUB_CLIENT_SECRET,
                redirectUri: env_1.env.GITHUB_REDIRECT_URI,
                authUrl: "https://github.com/login/oauth/authorize",
                tokenUrl: "https://github.com/login/oauth/access_token",
                scopes: ["repo", "user", "read:org"],
                userInfoUrl: "https://api.github.com/user"
            };
        case "google":
            return env_1.env.GOOGLE_CLIENT_ID ? {
                clientId: env_1.env.GOOGLE_CLIENT_ID,
                clientSecret: env_1.env.GOOGLE_CLIENT_SECRET,
                redirectUri: env_1.env.GOOGLE_REDIRECT_URI,
                authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
                tokenUrl: "https://oauth2.googleapis.com/token",
                scopes: [
                    "https://www.googleapis.com/auth/gmail.send",
                    "https://www.googleapis.com/auth/calendar",
                    "https://www.googleapis.com/auth/userinfo.email",
                    "https://www.googleapis.com/auth/documents",
                    "https://www.googleapis.com/auth/drive.file"
                ],
                userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo"
            } : null;
        case "slack":
            return env_1.env.SLACK_CLIENT_ID ? {
                clientId: env_1.env.SLACK_CLIENT_ID,
                clientSecret: env_1.env.SLACK_CLIENT_SECRET,
                redirectUri: env_1.env.SLACK_REDIRECT_URI,
                authUrl: "https://slack.com/oauth/v2/authorize",
                tokenUrl: "https://slack.com/api/oauth.v2.access",
                scopes: ["chat:write", "channels:read", "users:read"],
                userInfoUrl: "https://slack.com/api/auth.test"
            } : null;
        case "twitter":
        case "x":
            return env_1.env.X_CLIENT_ID ? {
                clientId: env_1.env.X_CLIENT_ID,
                clientSecret: env_1.env.X_CLIENT_SECRET,
                redirectUri: env_1.env.X_REDIRECT_URI,
                authUrl: "https://twitter.com/i/oauth2/authorize",
                tokenUrl: "https://api.twitter.com/2/oauth2/token",
                scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
                userInfoUrl: "https://api.twitter.com/2/users/me"
            } : null;
        case "instagram":
            return env_1.env.INSTAGRAM_CLIENT_ID ? {
                clientId: env_1.env.INSTAGRAM_CLIENT_ID,
                clientSecret: env_1.env.INSTAGRAM_CLIENT_SECRET,
                redirectUri: env_1.env.INSTAGRAM_REDIRECT_URI,
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
const getAuthUrl = async (req, res) => {
    try {
        const { provider } = req.params;
        const config = getProviderConfig(provider);
        if (!config) {
            return res.status(400).json({
                error: `Provider ${provider} not configured`,
                configured: false
            });
        }
        // Generate state for CSRF protection
        // For Twitter, also include code_verifier for PKCE
        let codeVerifier;
        if (provider === "twitter") {
            // Generate random code_verifier (43-128 chars, URL-safe)
            codeVerifier = crypto_1.default.randomBytes(32).toString("base64url");
        }
        const state = Buffer.from(JSON.stringify({
            userId: req.user.id,
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
            const codeChallenge = crypto_1.default
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
    }
    catch (err) {
        logger_1.logger.error("Failed to generate auth URL", { error: err.message });
        res.status(500).json({ error: err.message });
    }
};
exports.getAuthUrl = getAuthUrl;
// Step 2: Handle OAuth callback
const handleCallback = async (req, res) => {
    try {
        let { provider } = req.params;
        // Normalize x to twitter
        if (provider === "x")
            provider = "twitter";
        const { code, state, error } = req.query;
        if (error) {
            return res.status(400).json({ error: `OAuth error: ${error}` });
        }
        if (!code || !state) {
            return res.status(400).json({ error: "Missing code or state" });
        }
        // Decode and verify state
        let stateData;
        try {
            stateData = JSON.parse(Buffer.from(state, "base64").toString());
        }
        catch {
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
        const tokenResponse = await exchangeCodeForTokens(provider, code, config, stateData.codeVerifier // Pass code_verifier for Twitter
        );
        // Get user info if available
        let metadata = {};
        if (config.userInfoUrl && tokenResponse.access_token) {
            try {
                metadata = await getUserInfo(provider, tokenResponse.access_token, config);
            }
            catch (e) {
                logger_1.logger.warn("Failed to get user info", { provider, error: e.message });
            }
        }
        // Encrypt tokens
        const encryptedAccessToken = (0, crypto_2.encryptToken)(tokenResponse.access_token);
        const encryptedRefreshToken = tokenResponse.refresh_token
            ? (0, crypto_2.encryptToken)(tokenResponse.refresh_token)
            : undefined;
        // Save integration
        const integration = await Integration_1.Integration.findOneAndUpdate({ userId: stateData.userId, provider }, {
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
        }, { upsert: true, new: true });
        logger_1.logger.info("OAuth integration connected", {
            userId: stateData.userId,
            provider,
            integrationId: integration._id
        });
        // Redirect to frontend success page
        res.redirect(`https://heyaxle.vercel.app/dashboard/integrations`);
    }
    catch (err) {
        logger_1.logger.error("OAuth callback failed", { error: err.message });
        res.redirect(`https://heyaxle.vercel.app/dashboard/integrations`);
    }
};
exports.handleCallback = handleCallback;
// Exchange authorization code for tokens
const exchangeCodeForTokens = async (provider, code, config, codeVerifier // For Twitter PKCE
) => {
    const params = {
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
    const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
    };
    // Twitter uses Basic auth
    if (provider === "twitter" || provider === "x") {
        const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
        // For Twitter v2 with Basic auth, client_id and client_secret should be removed from body
        delete params.client_secret;
        delete params.client_id;
    }
    try {
        const response = await axios_1.default.post(config.tokenUrl, new URLSearchParams(params).toString(), { headers });
        return response.data;
    }
    catch (error) {
        logger_1.logger.error("Token exchange failed", {
            provider,
            status: error.response?.status,
            data: error.response?.data
        });
        throw new Error(error.response?.data?.error_description || error.message);
    }
};
// Get user info from provider
const getUserInfo = async (provider, accessToken, config) => {
    if (!config.userInfoUrl)
        return {};
    const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
    };
    // GitHub uses different header
    if (provider === "github") {
        headers["Authorization"] = `token ${accessToken}`;
    }
    // Normalize twitter/x
    if (provider === "x")
        provider = "twitter";
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
    const response = await axios_1.default.get(url, { headers });
    return response.data;
};
// ==================== STATUS & MANAGEMENT ====================
// Get all integrations status
const getIntegrationsStatus = async (req, res) => {
    try {
        const integrations = await Integration_1.Integration.find({
            userId: req.user.id
        }).select("-accessToken -refreshToken").lean();
        // Build status for all providers
        const providers = ["github", "google", "slack", "twitter", "instagram"];
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getIntegrationsStatus = getIntegrationsStatus;
// Get single integration status
const getIntegrationStatus = async (req, res) => {
    try {
        const { provider } = req.params;
        const config = getProviderConfig(provider);
        const integration = await Integration_1.Integration.findOne({
            userId: req.user.id,
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getIntegrationStatus = getIntegrationStatus;
// Disconnect integration
const disconnectIntegration = async (req, res) => {
    try {
        const { provider } = req.params;
        const result = await Integration_1.Integration.findOneAndDelete({
            userId: req.user.id,
            provider
        });
        if (!result) {
            return res.status(404).json({ error: "Integration not found" });
        }
        logger_1.logger.info("Integration disconnected", {
            userId: req.user.id,
            provider
        });
        res.json({
            disconnected: true,
            provider,
            status: "disconnected"
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.disconnectIntegration = disconnectIntegration;
// Refresh integration token
const refreshIntegrationToken = async (req, res) => {
    try {
        const { provider } = req.params;
        const integration = await Integration_1.Integration.findOne({
            userId: req.user.id,
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
        const { decryptToken } = await Promise.resolve().then(() => __importStar(require("../services/crypto")));
        const refreshToken = decryptToken(integration.refreshToken);
        // Request new tokens
        const params = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token"
        });
        const response = await axios_1.default.post(config.tokenUrl, params.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        // Update tokens
        integration.accessToken = (0, crypto_2.encryptToken)(response.data.access_token);
        if (response.data.refresh_token) {
            integration.refreshToken = (0, crypto_2.encryptToken)(response.data.refresh_token);
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
    }
    catch (err) {
        logger_1.logger.error("Token refresh failed", { error: err.message });
        res.status(500).json({ error: err.message });
    }
};
exports.refreshIntegrationToken = refreshIntegrationToken;
exports.default = {
    getAuthUrl: exports.getAuthUrl,
    handleCallback: exports.handleCallback,
    getIntegrationsStatus: exports.getIntegrationsStatus,
    getIntegrationStatus: exports.getIntegrationStatus,
    disconnectIntegration: exports.disconnectIntegration,
    refreshIntegrationToken: exports.refreshIntegrationToken
};
