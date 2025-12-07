import { Request, Response } from "express";
import { getGitHubOAuthUrl, getGitHubToken } from "../lib/githubapis";
import { getGoogleOAuthUrl, exchangeGoogleCode } from "../lib/googleapis";
import axios from "axios";
import { Integration } from "../models/Integration";
import { env } from "../config/env";
import qs from "querystring";

export const getGitHubUrlController = async (req: Request, res: Response) => {
  // Comprehensive GitHub scopes for all tools
  const defaultScopes = [
    "repo",              // Full control of private repositories (read/write code, issues, PRs, commits, branches, releases)
    "user",              // Read user profile data
    "notifications",     // Access notifications (list_notifications, mark_notification_read)
    "read:org",          // Read org and team membership (for organization repositories)
    "workflow",          // Update GitHub Action workflows (list_workflows, get_workflow_runs)
  ];
  
  const scopes = req.query.scopes
    ? String(req.query.scopes).split(",")
    : defaultScopes;
  try {
    const url = await getGitHubOAuthUrl(scopes);
    res.redirect(url);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Unable to get GitHub OAuth url", err: err.message });
  }
};

export const getGoogleUrlController = async (_req: Request, res: Response) => {
  try {
    const url = getGoogleOAuthUrl();
    res.redirect(url);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Unable to get Google OAuth url", err: err.message });
  }
};

export const githubCallbackController = async (req: Request, res: Response) => {
  const code = req.query.code || req.body.code;
  const userId = (req as any).userId || req.body.userId;

  if (!code || !userId)
    return res.status(400).json({ message: "Missing code or userId" });

  try {
    const tokenRes = await getGitHubToken(String(code));
    // encrypt tokens before storing
    const { encrypt } = await import("../lib/crypto");
    const integration = await Integration.create({
      name: "github",
      userId,
      accessToken: encrypt(tokenRes.accessToken),
      scope: tokenRes.scope,
    } as any);

    res.json({ integration });
  } catch (err) {
    res.status(500).json({ message: "GitHub OAuth failed", err: err.message });
  }
};

export const googleCallbackController = async (req: Request, res: Response) => {
  const code = req.query.code || req.body.code;
  const userId = (req as any).userId || req.body.userId;

  if (!code || !userId)
    return res.status(400).json({ message: "Missing code or userId" });

  try {
    const tokens = await exchangeGoogleCode(String(code));
    
    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
      return res.status(400).json({ 
        message: "Google OAuth failed", 
        error: "No tokens received from Google. Please try again." 
      });
    }

    const { encrypt } = await import("../lib/crypto");
    
    // Check if integration already exists and update it, otherwise create new
    let integration = await Integration.findOne({ name: "google", userId });
    
    const integrationData: any = {
      name: "google",
      userId,
      accessToken: tokens.access_token
        ? encrypt(tokens.access_token as string)
        : undefined,
      refreshToken: tokens.refresh_token
        ? encrypt(tokens.refresh_token as string)
        : undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scope: tokens.scope,
    };

    if (integration) {
      // Update existing integration
      Object.assign(integration, integrationData);
      await integration.save();
    } else {
      // Create new integration
      integration = await Integration.create(integrationData);
    }

    res.json({ integration });
  } catch (err: any) {
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

export const getSlackUrlController = async (req: Request, res: Response) => {
  // Comprehensive Slack scopes for all tools
  const scopes = [
    "chat:write",           // Send messages (send_slack_message)
    "channels:read",        // View basic public channel info (list_channels)
    "channels:history",     // View messages in public channels (get_channel_history)
    "groups:read",          // View basic private channel info
    "groups:history",       // View messages in private channels
    "im:read",              // View basic DM info (open_dm)
    "im:history",           // View DM history
    "mpim:read",            // View basic group DM info
    "mpim:history",         // View group DM history
    "users:read",           // View people in workspace (list_slack_users, get_slack_user_info)
    "users:read.email",     // View email addresses of people in workspace
    "files:read",           // View files shared in channels (list_files, list_slack_files)
    "files:write",          // Upload files (upload_slack_file)
    "search:read",          // Search messages and files (search_messages, search_slack_messages)
  ];
  
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID || "",
    scope: scopes.join(","),
    redirect_uri: env.SLACK_REDIRECT_URI || "",
  });
  
  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
};

export const slackCallbackController = async (req: Request, res: Response) => {
  const code = req.query.code || req.body.code;
  const userId = (req as any).userId || req.body.userId;

  if (!code || !userId)
    return res.status(400).json({ message: "Missing code or userId" });

  try {
    const response = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID || "",
        client_secret: env.SLACK_CLIENT_SECRET || "",
        code: String(code),
        redirect_uri: env.SLACK_REDIRECT_URI || "",
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    if (!response.data || !response.data.ok)
      throw new Error(response.data.error || "Slack OAuth error");

    const token = response.data.access_token;
    const { encrypt } = await import("../lib/crypto");
    const integration = await Integration.create({
      name: "slack",
      userId,
      accessToken: encrypt(token),
    } as any);
    res.json({ integration });
  } catch (err) {
    res.status(500).json({ message: "Slack OAuth failed", err: err.message });
  }
};

export default {};

export const getInstagramUrlController = async (
  _req: Request,
  res: Response
) => {
  try {
    // Comprehensive Instagram (Meta/Facebook) scopes for all tools
    const scopes = [
      "instagram_basic",              // Basic Instagram account info (get_instagram_profile)
      "instagram_content_publish",    // Publish content (post_instagram_media)
      "pages_read_engagement",        // Read page engagement metrics
      "pages_show_list",              // List Instagram accounts connected to Facebook pages
      "instagram_manage_comments",     // Manage comments (comment_on_post)
      "instagram_manage_messages",     // Send DMs (send_instagram_dm)
      "pages_read_user_content",      // Read user content (get_instagram_stories, list_posts)
    ];
    
    const params = new URLSearchParams({
      client_id: env.INSTAGRAM_CLIENT_ID || "",
      redirect_uri: env.INSTAGRAM_REDIRECT_URI || "",
      scope: scopes.join(","),
      response_type: "code",
    });
    const url = `https://www.facebook.com/v17.0/dialog/oauth?${params.toString()}`;
    res.redirect(url);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Unable to get Instagram OAuth url", err: err.message });
  }
};

export const instagramCallbackController = async (
  req: Request,
  res: Response
) => {
  const code = req.query.code || req.body.code;
  const userId = (req as any).userId || req.body.userId;

  if (!code || !userId)
    return res.status(400).json({ message: "Missing code or userId" });

  try {
    const tokenRes = await axios.get(
      `https://graph.facebook.com/v17.0/oauth/access_token?client_id=${
        env.INSTAGRAM_CLIENT_ID
      }&redirect_uri=${encodeURIComponent(
        env.INSTAGRAM_REDIRECT_URI || ""
      )}&client_secret=${env.INSTAGRAM_CLIENT_SECRET}&code=${String(code)}`
    );

    const accessToken = tokenRes.data.access_token;
    const { encrypt } = await import("../lib/crypto");
    const integration = await Integration.create({
      name: "instagram",
      userId,
      accessToken: encrypt(accessToken),
      scope: tokenRes.data.scope,
    } as any);

    res.json({ integration });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Instagram OAuth failed", err: err.message });
  }
};

export const getXUrlController = async (_req: Request, res: Response) => {
  // For PKCE flow the client must generate a code_challenge from a code_verifier.
  // Return a URL template and required parameters for the frontend to assemble.
  try {
    // Comprehensive X/Twitter scopes for all tools
    const scopes = [
      "tweet.read",         // Read tweets (list_x_posts, get_x_timeline, get_tweet, search_tweets)
      "tweet.write",        // Create tweets (post_x_tweet, reply_to_tweet)
      "users.read",         // Read user profiles
      "dm.read",            // Read DMs
      "dm.write",           // Send DMs (send_x_dm)
      "like.read",          // Read likes
      "like.write",         // Like tweets (like_tweet)
      "bookmark.read",      // Read bookmarks
      "offline.access",     // Refresh token support (for long-lived access)
    ];
    
    const params = {
      response_type: "code",
      client_id: env.X_CLIENT_ID || "",
      redirect_uri: env.X_REDIRECT_URI || "",
      scope: scopes.join(" "), // X/Twitter uses space-separated scopes
      state: "",
      code_challenge: "<CODE_CHALLENGE_FROM_FRONTEND>",
      code_challenge_method: "S256",
    } as any;
    const url = `https://twitter.com/i/oauth2/authorize?${qs.stringify(
      params
    )}`;
    res.redirect(url);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Unable to build X OAuth url", err: err.message });
  }
};

export const xCallbackController = async (req: Request, res: Response) => {
  const code = req.query.code || req.body.code;
  const code_verifier = req.body.code_verifier || req.query.code_verifier;
  const userId = (req as any).userId || req.body.userId;

  if (!code || !userId || !code_verifier)
    return res
      .status(400)
      .json({ message: "Missing code, code_verifier or userId" });

  try {
    const tokenUrl = "https://api.twitter.com/2/oauth2/token";
    const body = qs.stringify({
      code: String(code),
      grant_type: "authorization_code",
      client_id: env.X_CLIENT_ID,
      redirect_uri: env.X_REDIRECT_URI,
      code_verifier: String(code_verifier),
    });

    const response = await axios.post(tokenUrl, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!response.data || !response.data.access_token)
      throw new Error("X token exchange failed");

    const { encrypt } = await import("../lib/crypto");
    const integration = await Integration.create({
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
    } as any);

    res.json({ integration });
  } catch (err) {
    res.status(500).json({ message: "X OAuth failed", err: err.message });
  }
};
