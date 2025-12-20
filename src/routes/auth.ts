import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { env } from "../config/env";
import { generateSecureToken } from "../services/crypto";

// ============================================
// AUTH ROUTES
// ============================================

const router = Router();

// Request magic link
router.post("/magic-link", async (req: Request, res: Response) => {
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
        credits: 100, // Free tier starting credits
        plan: "free"
      });
    }
    
    // Generate magic link token
    const token = generateSecureToken(32);
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    user.magicLinkToken = token;
    user.magicLinkExpires = expires;
    await user.save();
    
    // In production, send email with link
    // For now, return token (remove in production!)
    const magicLink = `${env.ALLOWED_ORIGINS.split(",")[0]}/auth/verify?token=${token}`;
    
    // TODO: Send email via Resend
    
    res.json({ 
      success: true,
      message: "Magic link sent to email",
      // Remove this in production:
      _devToken: token,
      _devLink: magicLink
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verify magic link
router.post("/verify", async (req: Request, res: Response) => {
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
      { id: user._id, email: user.email },
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
    
    res.json({
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
    res.status(500).json({ error: err.message });
  }
});

// Refresh token
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }
    
    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, env.REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    
    // Generate new access token
    const accessToken = jwt.sign(
      { id: user._id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    
    user.accessToken = accessToken;
    await user.save();
    
    res.json({ accessToken });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logout
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      
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
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get("/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const token = authHeader.slice(7);
    
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
});

export default router;
