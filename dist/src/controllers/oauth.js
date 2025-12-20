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
exports.xCallbackController = exports.getXUrlController = exports.instagramCallbackController = exports.getInstagramUrlController = exports.slackCallbackController = exports.getSlackUrlController = exports.googleCallbackController = exports.githubCallbackController = exports.getGoogleUrlController = exports.getGitHubUrlController = exports.pkceStore = void 0;
const githubapis_1 = require("../lib/githubapis");
const crypto_1 = __importDefault(require("crypto"));
// import qs from "querystring";
const pkce_1 = require("../lib/pkce");
// import { pkceStore } from "./pkceStore";
const googleapis_1 = require("../lib/googleapis");
const axios_1 = __importDefault(require("axios"));
const Integration_1 = require("../models/Integration");
const env_1 = require("../config/env");
const querystring_1 = __importDefault(require("querystring"));
exports.pkceStore = new Map();
const getGitHubUrlController = async (req, res) => {
    // Comprehensive GitHub scopes for all tools
    const defaultScopes = [
        "repo", // Full control of private repositories (read/write code, issues, PRs, commits, branches, releases)
        "user", // Read user profile data
        "notifications", // Access notifications (list_notifications, mark_notification_read)
        "read:org", // Read org and team membership (for organization repositories)
        "workflow", // Update GitHub Action workflows (list_workflows, get_workflow_runs)
    ];
    const scopes = req.query.scopes
        ? String(req.query.scopes).split(",")
        : defaultScopes;
    try {
        const url = await (0, githubapis_1.getGitHubOAuthUrl)(scopes);
        res.redirect(url);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: "Unable to get GitHub OAuth url", err: err.message });
    }
};
exports.getGitHubUrlController = getGitHubUrlController;
const getGoogleUrlController = async (_req, res) => {
    try {
        const url = (0, googleapis_1.getGoogleOAuthUrl)();
        res.redirect(url);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: "Unable to get Google OAuth url", err: err.message });
    }
};
exports.getGoogleUrlController = getGoogleUrlController;
const githubCallbackController = async (req, res) => {
    const code = req.query.code || req.body.code;
    const userId = req.userId || req.body.userId;
    if (!code || !userId)
        return res.status(400).json({ message: "Missing code or userId" });
    try {
        const tokenRes = await (0, githubapis_1.getGitHubToken)(String(code));
        // encrypt tokens before storing
        const { encrypt } = await Promise.resolve().then(() => __importStar(require("../lib/crypto")));
        const integration = await Integration_1.Integration.create({
            name: "github",
            userId,
            accessToken: encrypt(tokenRes.accessToken),
            scope: tokenRes.scope,
        });
        res.json({ integration });
    }
    catch (err) {
        res.status(500).json({ message: "GitHub OAuth failed", err: err.message });
    }
};
exports.githubCallbackController = githubCallbackController;
const googleCallbackController = async (req, res) => {
    const code = req.query.code || req.body.code;
    const userId = req.userId || req.body.userId;
    if (!code || !userId)
        return res.status(400).json({ message: "Missing code or userId" });
    try {
        const tokens = await (0, googleapis_1.exchangeGoogleCode)(String(code));
        if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
            return res.status(400).json({
                message: "Google OAuth failed",
                error: "No tokens received from Google. Please try again."
            });
        }
        const { encrypt } = await Promise.resolve().then(() => __importStar(require("../lib/crypto")));
        // Check if integration already exists and update it, otherwise create new
        let integration = await Integration_1.Integration.findOne({ name: "google", userId });
        const integrationData = {
            name: "google",
            userId,
            accessToken: tokens.access_token
                ? encrypt(tokens.access_token)
                : undefined,
            refreshToken: tokens.refresh_token
                ? encrypt(tokens.refresh_token)
                : undefined,
            expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
            scope: tokens.scope,
        };
        if (integration) {
            // Update existing integration
            Object.assign(integration, integrationData);
            await integration.save();
        }
        else {
            // Create new integration
            integration = await Integration_1.Integration.create(integrationData);
        }
        res.json({ integration });
    }
    catch (err) {
        // Handle specific Google OAuth errors
        if (err.message?.includes("TokenExpiredError") || err.message?.includes("invalid_grant")) {
            return res.status(400).json({
                message: "Google OAuth failed",
                error: "The authorization code has expired or already been used. Please try connecting again.",
                details: err.message
            });
        }
        res.status(500).json({
            message: "Google OAuth failed",
            error: err.message || "Unknown error occurred"
        });
    }
};
exports.googleCallbackController = googleCallbackController;
const getSlackUrlController = async (req, res) => {
    // Comprehensive Slack scopes for all tools
    const scopes = [
        "chat:write", // Send messages (send_slack_message)
        "channels:read", // View basic public channel info (list_channels)
        "channels:history", // View messages in public channels (get_channel_history)
        "groups:read", // View basic private channel info
        "groups:history", // View messages in private channels
        "im:read", // View basic DM info (open_dm)
        "im:history", // View DM history
        "mpim:read", // View basic group DM info
        "mpim:history", // View group DM history
        "users:read", // View people in workspace (list_slack_users, get_slack_user_info)
        "users:read.email", // View email addresses of people in workspace
        "files:read", // View files shared in channels (list_files, list_slack_files)
        "files:write", // Upload files (upload_slack_file)
        "search:read", // Search messages and files (search_messages, search_slack_messages)
    ];
    const params = new URLSearchParams({
        client_id: env_1.env.SLACK_CLIENT_ID || "",
        scope: scopes.join(","),
        redirect_uri: env_1.env.SLACK_REDIRECT_URI || "",
    });
    res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
};
exports.getSlackUrlController = getSlackUrlController;
const slackCallbackController = async (req, res) => {
    const code = req.query.code || req.body.code;
    const userId = req.userId || req.body.userId;
    if (!code || !userId)
        return res.status(400).json({ message: "Missing code or userId" });
    try {
        const response = await axios_1.default.post("https://slack.com/api/oauth.v2.access", new URLSearchParams({
            client_id: env_1.env.SLACK_CLIENT_ID || "",
            client_secret: env_1.env.SLACK_CLIENT_SECRET || "",
            code: String(code),
            redirect_uri: env_1.env.SLACK_REDIRECT_URI || "",
        }).toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        if (!response.data || !response.data.ok)
            throw new Error(response.data.error || "Slack OAuth error");
        const token = response.data.access_token;
        const { encrypt } = await Promise.resolve().then(() => __importStar(require("../lib/crypto")));
        const integration = await Integration_1.Integration.create({
            name: "slack",
            userId,
            accessToken: encrypt(token),
        });
        res.json({ integration });
    }
    catch (err) {
        res.status(500).json({ message: "Slack OAuth failed", err: err.message });
    }
};
exports.slackCallbackController = slackCallbackController;
exports.default = {};
const getInstagramUrlController = async (_req, res) => {
    try {
        // Comprehensive Instagram (Meta/Facebook) scopes for all tools
        const scopes = [
            "instagram_basic", // Basic Instagram account info (get_instagram_profile)
            "instagram_content_publish", // Publish content (post_instagram_media)
            "pages_read_engagement", // Read page engagement metrics
            "pages_show_list", // List Instagram accounts connected to Facebook pages
            "instagram_manage_comments", // Manage comments (comment_on_post)
            "instagram_manage_messages", // Send DMs (send_instagram_dm)
            "pages_read_user_content", // Read user content (get_instagram_stories, list_posts)
        ];
        const params = new URLSearchParams({
            client_id: env_1.env.INSTAGRAM_CLIENT_ID || "",
            redirect_uri: env_1.env.INSTAGRAM_REDIRECT_URI || "",
            scope: scopes.join(","),
            response_type: "code",
        });
        const url = `https://www.facebook.com/v17.0/dialog/oauth?${params.toString()}`;
        res.redirect(url);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: "Unable to get Instagram OAuth url", err: err.message });
    }
};
exports.getInstagramUrlController = getInstagramUrlController;
const instagramCallbackController = async (req, res) => {
    const code = req.query.code || req.body.code;
    const userId = req.userId || req.body.userId;
    if (!code || !userId)
        return res.status(400).json({ message: "Missing code or userId" });
    try {
        const tokenRes = await axios_1.default.get(`https://graph.facebook.com/v17.0/oauth/access_token?client_id=${env_1.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(env_1.env.INSTAGRAM_REDIRECT_URI || "")}&client_secret=${env_1.env.INSTAGRAM_CLIENT_SECRET}&code=${String(code)}`);
        const accessToken = tokenRes.data.access_token;
        const { encrypt } = await Promise.resolve().then(() => __importStar(require("../lib/crypto")));
        const integration = await Integration_1.Integration.create({
            name: "instagram",
            userId,
            accessToken: encrypt(accessToken),
            scope: tokenRes.data.scope,
        });
        res.json({ integration });
    }
    catch (err) {
        res
            .status(500)
            .json({ message: "Instagram OAuth failed", err: err.message });
    }
};
exports.instagramCallbackController = instagramCallbackController;
// let codeVerifier: string;
const getXUrlController = async (_req, res) => {
    const codeVerifier = (0, pkce_1.generatePKCE)();
    const codeChallenge = (0, pkce_1.generatePKCE)();
    const state = crypto_1.default.randomBytes(16).toString("hex");
    // Store verifier using state as key
    exports.pkceStore.set(state, codeVerifier);
    const scopes = [
        "tweet.read",
        "users.read",
        "offline.access",
    ];
    const params = {
        response_type: "code",
        client_id: env_1.env.X_CLIENT_ID,
        redirect_uri: env_1.env.X_REDIRECT_URI,
        scope: scopes.join(" "),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
    };
    const url = `https://twitter.com/i/oauth2/authorize?${querystring_1.default.stringify(params)}`;
    res.redirect(url);
};
exports.getXUrlController = getXUrlController;
const xCallbackController = async (req, res) => {
    const code = req.query.code || req.body.code;
    const { state } = req.query.state || req.body.state;
    const code_verifier = exports.pkceStore.get(state);
    const userId = req.userId || req.body.userId;
    console.log(code);
    console.log(code_verifier);
    console.log(userId);
    console.log(state);
    if (!code || !userId || !code_verifier)
        return res
            .status(400)
            .json({ message: "Missing code, code_verifier or userId" });
    try {
        const tokenUrl = "https://api.twitter.com/2/oauth2/token";
        const body = querystring_1.default.stringify({
            code: String(code),
            grant_type: "authorization_code",
            client_id: env_1.env.X_CLIENT_ID,
            redirect_uri: env_1.env.X_REDIRECT_URI,
            code_verifier: String(code_verifier),
        });
        const response = await axios_1.default.post(tokenUrl, body, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (!response.data || !response.data.access_token)
            throw new Error("X token exchange failed");
        const { encrypt } = await Promise.resolve().then(() => __importStar(require("../lib/crypto")));
        const integration = await Integration_1.Integration.create({
            name: "x",
            userId,
            accessToken: encrypt(response.data.access_token),
            refreshToken: response.data.refresh_token
                ? encrypt(response.data.refresh_token)
                : undefined,
            expiresAt: response.data.expires_in
                ? new Date(Date.now() + response.data.expires_in * 1000)
                : undefined,
            scope: response.data.scope,
        });
        res.json({ integration });
    }
    catch (err) {
        res.status(500).json({ message: "X OAuth failed", err: err.message });
    }
};
exports.xCallbackController = xCallbackController;
