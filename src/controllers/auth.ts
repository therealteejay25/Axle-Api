import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { User } from "../models/User";
import { env } from "../config/env";
import { generateSecureToken } from "../services/crypto";
import { logger } from "../services/logger";

// ============================================
// AUTH CONTROLLER
// ============================================

// Initialize Resend
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.IS_PROD,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/"
};

const ACCESS_TOKEN_COOKIE = "axle_access_token";
const REFRESH_TOKEN_COOKIE = "axle_refresh_token";

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
    const magicLink = `${baseUrl}/auth/verify?token=${token}`;
    
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
            </div>
          `
        } as any);
        
        logger.info("Magic link email sent", { email });
        
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
      { expiresIn: "1h" }
    );
    
    const refreshToken = jwt.sign(
      { id: user._id },
      env.REFRESH_SECRET,
      { expiresIn: "7d" }
    );
    
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    await user.save();
    
    // Set cookies
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 1000 // 1 hour
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

export default {
  requestMagicLink,
  verifyMagicLink,
  refreshTokens,
  logout,
  getCurrentUser,
  updateProfile
};
