import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { User } from "../models/User";
import { Integration } from "../models/Integration";
import { env } from "../config/env";
import { encryptToken, generateSecureToken } from "../services/crypto";
import { logger } from "../services/logger";

// ============================================
// AUTH CONTROLLER
// ============================================

// Initialize Resend
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Always true for cross-site cookie support
  sameSite: "none" as const, // Required for cross-site cookies between Vercel and Render
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/"
};

const ACCESS_TOKEN_COOKIE = "axle_access_token";
const REFRESH_TOKEN_COOKIE = "axle_refresh_token";

const PASSWORD_HASH_ITERATIONS = 120_000;
const PASSWORD_HASH_KEYLEN = 32;
const PASSWORD_HASH_DIGEST = "sha256";

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

const hashPassword = (password: string, saltHex?: string) => {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_KEYLEN,
    PASSWORD_HASH_DIGEST
  );
  return {
    saltHex: salt.toString("hex"),
    hashHex: hash.toString("hex")
  };
};

const encodePasswordHash = (saltHex: string, hashHex: string) => {
  return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${PASSWORD_HASH_DIGEST}$${saltHex}$${hashHex}`;
};

const verifyPassword = (password: string, passwordHash: string) => {
  const parts = passwordHash.split("$");
  if (parts.length !== 5) return false;
  const [algo, iterRaw, digest, saltHex, hashHex] = parts;
  if (algo !== "pbkdf2") return false;
  const iterations = Number(iterRaw);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const computed = crypto.pbkdf2Sync(
    password,
    Buffer.from(saltHex, "hex"),
    iterations,
    Buffer.from(hashHex, "hex").length,
    digest as any
  );

  const expected = Buffer.from(hashHex, "hex");
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
};

const issueTokens = (user: any) => {
  const accessToken = jwt.sign(
    { id: user._id, email: user.email, plan: user.plan },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  const refreshToken = jwt.sign({ id: user._id }, env.REFRESH_SECRET, {
    expiresIn: "30d"
  });

  return { accessToken, refreshToken };
};

// Register with email + password
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    // If the user exists from previous magic-link usage but has no password yet,
    // allow them to set one (claim account).
    if (user && user.passwordHash) {
      return res.status(409).json({ error: "Account already exists" });
    }

    const { saltHex, hashHex } = hashPassword(password);
    const passwordHash = encodePasswordHash(saltHex, hashHex);

    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        name,
        passwordHash,
        credits: 100,
        plan: "free"
      });
    } else {
      user.passwordHash = passwordHash;
      if (name !== undefined && name !== null) user.name = name;
      await user.save();
    }

    const { accessToken, refreshToken } = issueTokens(user);

    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 7 * 1000
    });
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        credits: user.credits
      }
    });
  } catch (err: any) {
    logger.error("Register failed", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

// Login with email + password
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const ok = verifyPassword(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { accessToken, refreshToken } = issueTokens(user);
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 7 * 1000
    });
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        credits: user.credits
      }
    });
  } catch (err: any) {
    logger.error("Login failed", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

// Request magic link
export const requestMagicLink = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        email: email.toLowerCase(),
        credits: 100,
        plan: "free"
      });
    }

    // Generate magic link token
    const token = generateSecureToken(32);
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.magicLinkToken = token;
    user.magicLinkExpires = expires;
    await user.save();

    // Build magic link URL
    const baseUrl = env.ALLOWED_ORIGINS.split(",")[0].trim();
    const magicLink = `https://heyaxle.vercel.app/auth/verify?token=${token}`;

    // Send email via Resend
    if (resend) {
      try {
        await resend.emails.send({
          from: "Axle <onboarding@resend.dev>",
          to: [email.toLowerCase()],
          subject: "Your Magic Link to Sign In",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Welcome to Axle</h2>
              <p>Click the button below to sign in to your account:</p>
              <a href="${magicLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                Sign In
              </a>
              <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
              <p style="color: #666; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
              <p style="color: #666; font-size: 12px;">If you can't login with the button, use this: ${magicLink}</p>
            </div>
          `
        } as any);

        logger.info("Magic link email sent", { email, magicLink });

        return res.json({
          success: true,
          message: "Magic link sent to email"
        });
      } catch (emailError: any) {
        logger.error("Failed to send magic link email", { error: emailError.message });
        // Return token in dev for testing if email fails
        if (!env.IS_PROD) {
          return res.json({
            success: true,
            message: "Email failed, use dev token",
            _devToken: token,
            _devLink: magicLink
          });
        }
        return res.status(500).json({ error: "Failed to send email" });
      }
    }

    // No Resend configured - return token in dev
    if (!env.IS_PROD) {
      return res.json({
        success: true,
        message: "Resend not configured, use dev token",
        _devToken: token,
        _devLink: magicLink
      });
    }

    return res.status(500).json({ error: "Email service not configured" });
  } catch (err: any) {
    logger.error("Magic link request failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// Verify magic link
export const verifyMagicLink = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const user = await User.findOne({
      magicLinkToken: token,
      magicLinkExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Clear magic link
    user.magicLinkToken = undefined;
    user.magicLinkExpires = undefined;

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, plan: user.plan },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      env.REFRESH_SECRET,
      { expiresIn: "30d" }
    );

    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookies
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 7 * 1000 // 7 days
    });
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        credits: user.credits
      }
    });
  } catch (err: any) {
    logger.error("Magic link verification failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// Refresh token
export const refreshTokens = async (req: Request, res: Response) => {
  try {
    // Check cookie first, then body
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, env.REFRESH_SECRET);
    } catch {
      res.clearCookie(ACCESS_TOKEN_COOKIE);
      res.clearCookie(REFRESH_TOKEN_COOKIE);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      res.clearCookie(ACCESS_TOKEN_COOKIE);
      res.clearCookie(REFRESH_TOKEN_COOKIE);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, plan: user.plan },
      env.JWT_SECRET,
      { expiresIn: "3d" }
    );

    user.accessToken = accessToken;
    await user.save();

    // Set cookie
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 1000
    });

    res.json({ accessToken });
  } catch (err: any) {
    logger.error("Token refresh failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// Logout
export const logout = async (req: Request, res: Response) => {
  try {
    // Get token from cookie or header
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE] ||
      req.headers.authorization?.slice(7);

    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        await User.findByIdAndUpdate(decoded.id, {
          accessToken: null,
          refreshToken: null
        });
      } catch {
        // Token invalid, but logout anyway
      }
    }

    // Clear cookies
    res.clearCookie(ACCESS_TOKEN_COOKIE);
    res.clearCookie(REFRESH_TOKEN_COOKIE);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Get current user
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // Get token from cookie or header
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE] ||
      req.headers.authorization?.slice(7);

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        credits: user.credits,
        timeZone: user.timeZone
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { name, timeZone } = req.body;

    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (name !== undefined) user.name = name;
    if (timeZone !== undefined) user.timeZone = timeZone;

    await user.save();

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        credits: user.credits,
        timeZone: user.timeZone
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Forgot password (request reset link)
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Always respond success to avoid account enumeration.
    if (!user) {
      return res.json({ success: true });
    }

    const token = generateSecureToken(48);
    user.passwordResetToken = token;
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    const origin = env.ALLOWED_ORIGINS.split(",")[0].trim() || "https://heyaxle.vercel.app";
    const resetLink = `${origin.replace(/\/$/, "")}/app/auth/reset-password?token=${encodeURIComponent(token)}`;

    if (resend) {
      try {
        await resend.emails.send({
          from: env.RESEND_FROM_EMAIL || "Axle <onboarding@resend.dev>",
          to: [normalizedEmail],
          subject: "Reset your Axle password",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Reset your password</h2>
              <p>Click the button below to reset your password. This link expires in 30 minutes.</p>
              <a href="${resetLink}" style="display: inline-block; background: #57BF7A; color: #0b0b0b; padding: 12px 18px; text-decoration: none; border-radius: 10px; margin: 16px 0; font-weight: 700;">Reset Password</a>
              <p style="color: #666; font-size: 12px;">If you didn't request this, you can ignore this email.</p>
              <p style="color: #666; font-size: 12px;">If the button doesn't work, use this link: ${resetLink}</p>
            </div>
          `
        } as any);
      } catch (emailErr: any) {
        logger.error("Failed to send password reset email", { error: emailErr.message });
        if (!env.IS_PROD) {
          return res.json({ success: true, _devToken: token, _devLink: resetLink });
        }
      }
    } else if (!env.IS_PROD) {
      return res.json({ success: true, _devToken: token, _devLink: resetLink });
    }

    return res.json({ success: true });
  } catch (err: any) {
    logger.error("Forgot password failed", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

// Reset password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const { saltHex, hashHex } = hashPassword(String(password));
    user.passwordHash = encodePasswordHash(saltHex, hashHex);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({ success: true });
  } catch (err: any) {
    logger.error("Reset password failed", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

// ==================== GOOGLE OAUTH AUTHENTICATION ====================

// Google OAuth configuration for authentication (includes integration scopes)
const GOOGLE_AUTH_CONFIG = {
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_REDIRECT_URI?.replace("/oauth/", "/auth/"),
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
  scopes: [
    // Basic profile info for auth
    "openid",
    "profile",
    "email",
    // Full Google Workspace integration scopes
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.metadata",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ],
};

// Get Google OAuth authorization URL for authentication
export const getGoogleAuthUrl = async (req: Request, res: Response) => {
  try {
    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");

    // For now, we'll use a secure cookie for state persistence
    // This handles server restarts and distributed environments better than in-memory Map
    const stateValue = JSON.stringify({
      state,
      timestamp: Date.now(),
      action: "auth"
    });

    res.cookie("google_auth_state", stateValue, {
      ...COOKIE_OPTIONS,
      maxAge: 10 * 60 * 1000 // 10 minutes
    });

    // Build auth URL
    const params = new URLSearchParams({
      client_id: GOOGLE_AUTH_CONFIG.clientId!,
      redirect_uri: GOOGLE_AUTH_CONFIG.redirectUri!,
      scope: GOOGLE_AUTH_CONFIG.scopes.join(" "),
      state,
      response_type: "code",
      access_type: "offline",
      prompt: "consent"
    });

    const authUrl = `${GOOGLE_AUTH_CONFIG.authUrl}?${params.toString()}`;

    res.json({ authUrl });
  } catch (err: any) {
    logger.error("Failed to generate Google auth URL", { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// Handle Google OAuth callback for authentication
export const handleGoogleAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`https://heyaxle.vercel.app/auth/login?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`https://heyaxle.vercel.app/auth/login?error=Missing code or state`);
    }

    // Verify state from cookie
    const cookieStateArr = req.cookies?.google_auth_state;
    if (!cookieStateArr) {
      logger.error("Google OAuth callback: Missing state cookie", {
        receivedState: state,
        allCookies: Object.keys(req.cookies || {})
      });
      return res.redirect(`https://heyaxle.vercel.app/auth/login?error=Missing state cookie`);
    }

    let stateData: any;
    try {
      stateData = JSON.parse(cookieStateArr);
    } catch (e: any) {
      logger.error("Google OAuth callback: Malformed state cookie", { error: e.message });
      return res.redirect(`https://heyaxle.vercel.app/auth/login?error=Malformed state cookie`);
    }

    if (stateData.state !== state) {
      logger.error("Google OAuth callback: State mismatch", {
        expected: stateData.state,
        received: state
      });
      return res.redirect(`https://heyaxle.vercel.app/auth/login?error=State mismatch`);
    }

    if (Date.now() - stateData.timestamp > 15 * 60 * 1000) { // 15 minutes
      logger.error("Google OAuth callback: State expired", {
        age: Date.now() - stateData.timestamp
      });
      return res.redirect(`https://heyaxle.vercel.app/auth/login?error=State expired`);
    }

    // Clean up state cookie
    res.clearCookie("google_auth_state", COOKIE_OPTIONS);

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_AUTH_CONFIG.tokenUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_AUTH_CONFIG.clientId!,
        client_secret: GOOGLE_AUTH_CONFIG.clientSecret!,
        code: code as string,
        redirect_uri: GOOGLE_AUTH_CONFIG.redirectUri!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      logger.error("Google token exchange failed", { status: tokenResponse.status, error: errorData });
      return res.redirect(`https://heyaxle.vercel.app/auth/login?error=Failed to authenticate with Google`);
    }

    const tokens = await tokenResponse.json();

    // Get user info from Google
    const userInfoResponse = await fetch(GOOGLE_AUTH_CONFIG.userInfoUrl!, {
      headers: {
        "Authorization": `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      logger.error("Failed to get Google user info", { status: userInfoResponse.status });
      return res.redirect(`https://heyaxle.vercel.app/auth/login?error=Failed to get user information`);
    }

    const googleUser = await userInfoResponse.json();

    // Find or create user
    let user = await User.findOne({ email: googleUser.email });

    if (!user) {
      // Create new user
      user = new User({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        emailVerified: googleUser.verified_email || false,
        provider: "google",
        providerId: googleUser.id,
      });
      await user.save();
      logger.info("Created new user via Google OAuth", { email: googleUser.email, userId: user._id });
    } else {
      // Update existing user with Google info
      user.name = user.name || googleUser.name;
      user.avatar = user.avatar || googleUser.picture;
      user.emailVerified = user.emailVerified || googleUser.verified_email || false;
      user.provider = user.provider || "google";
      user.providerId = user.providerId || googleUser.id;
      await user.save();
      logger.info("Updated existing user via Google OAuth", { email: googleUser.email, userId: user._id });
    }

    // Automatically create/update Google integration
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined;

    await Integration.findOneAndUpdate(
      { userId: user._id, provider: "google" },
      {
        userId: user._id,
        provider: "google",
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        scopes: GOOGLE_AUTH_CONFIG.scopes,
        metadata: {
          id: googleUser.id,
          name: googleUser.name,
          email: googleUser.email,
          picture: googleUser.picture,
          verified_email: googleUser.verified_email,
        },
        status: "connected",
        connectedAt: new Date()
      },
      { upsert: true, new: true }
    );

    logger.info("Auto-connected Google integration for user", { userId: user._id, email: googleUser.email });

    // Issue JWT tokens
    const { accessToken, refreshToken } = issueTokens(user);

    // Set cookies
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, COOKIE_OPTIONS);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);

    // Redirect to app
    res.redirect(`https://heyaxle.vercel.app/app`);
  } catch (err: any) {
    logger.error("Google OAuth callback failed", { error: err.message });
    res.redirect(`https://heyaxle.vercel.app/auth/login?error=Authentication failed`);
  }
};

// Change password
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const user = await User.findById(req.user!.id);
    if (!user || !user.passwordHash) {
      return res.status(404).json({ error: "User not found or password not set" });
    }

    const isValid = verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    const { saltHex, hashHex } = hashPassword(newPassword);
    user.passwordHash = encodePasswordHash(saltHex, hashHex);
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    logger.error("Change password failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

export default {
  register,
  login,
  requestMagicLink,
  verifyMagicLink,
  refreshTokens,
  logout,
  getCurrentUser,
  updateProfile,
  forgotPassword,
  resetPassword,
  changePassword
};
