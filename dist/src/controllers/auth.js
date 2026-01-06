"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.getCurrentUser = exports.logout = exports.refreshTokens = exports.verifyMagicLink = exports.requestMagicLink = exports.login = exports.register = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const resend_1 = require("resend");
const User_1 = require("../models/User");
const env_1 = require("../config/env");
const crypto_2 = require("../services/crypto");
const logger_1 = require("../services/logger");
// ============================================
// AUTH CONTROLLER
// ============================================
// Initialize Resend
const resend = env_1.env.RESEND_API_KEY ? new resend_1.Resend(env_1.env.RESEND_API_KEY) : null;
// Cookie options
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env_1.env.IS_PROD,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/"
};
const ACCESS_TOKEN_COOKIE = "axle_access_token";
const REFRESH_TOKEN_COOKIE = "axle_refresh_token";
const PASSWORD_HASH_ITERATIONS = 120_000;
const PASSWORD_HASH_KEYLEN = 32;
const PASSWORD_HASH_DIGEST = "sha256";
const hashPassword = (password, saltHex) => {
    const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto_1.default.randomBytes(16);
    const hash = crypto_1.default.pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEYLEN, PASSWORD_HASH_DIGEST);
    return {
        saltHex: salt.toString("hex"),
        hashHex: hash.toString("hex")
    };
};
const encodePasswordHash = (saltHex, hashHex) => {
    return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${PASSWORD_HASH_DIGEST}$${saltHex}$${hashHex}`;
};
const verifyPassword = (password, passwordHash) => {
    const parts = passwordHash.split("$");
    if (parts.length !== 5)
        return false;
    const [algo, iterRaw, digest, saltHex, hashHex] = parts;
    if (algo !== "pbkdf2")
        return false;
    const iterations = Number(iterRaw);
    if (!Number.isFinite(iterations) || iterations <= 0)
        return false;
    const computed = crypto_1.default.pbkdf2Sync(password, Buffer.from(saltHex, "hex"), iterations, Buffer.from(hashHex, "hex").length, digest);
    const expected = Buffer.from(hashHex, "hex");
    if (computed.length !== expected.length)
        return false;
    return crypto_1.default.timingSafeEqual(computed, expected);
};
const issueTokens = (user) => {
    const accessToken = jsonwebtoken_1.default.sign({ id: user._id, email: user.email, plan: user.plan }, env_1.env.JWT_SECRET, { expiresIn: "7d" });
    const refreshToken = jsonwebtoken_1.default.sign({ id: user._id }, env_1.env.REFRESH_SECRET, {
        expiresIn: "30d"
    });
    return { accessToken, refreshToken };
};
// Register with email + password
const register = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        if (typeof password !== "string" || password.length < 8) {
            return res
                .status(400)
                .json({ error: "Password must be at least 8 characters" });
        }
        const normalizedEmail = String(email).toLowerCase().trim();
        let user = await User_1.User.findOne({ email: normalizedEmail });
        // If the user exists from previous magic-link usage but has no password yet,
        // allow them to set one (claim account).
        if (user && user.passwordHash) {
            return res.status(409).json({ error: "Account already exists" });
        }
        const { saltHex, hashHex } = hashPassword(password);
        const passwordHash = encodePasswordHash(saltHex, hashHex);
        if (!user) {
            user = await User_1.User.create({
                email: normalizedEmail,
                name,
                passwordHash,
                credits: 100,
                plan: "free"
            });
        }
        else {
            user.passwordHash = passwordHash;
            if (name !== undefined && name !== null)
                user.name = name;
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
    }
    catch (err) {
        logger_1.logger.error("Register failed", { error: err.message });
        return res.status(500).json({ error: err.message });
    }
};
exports.register = register;
// Login with email + password
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        const normalizedEmail = String(email).toLowerCase().trim();
        const user = await User_1.User.findOne({ email: normalizedEmail });
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
    }
    catch (err) {
        logger_1.logger.error("Login failed", { error: err.message });
        return res.status(500).json({ error: err.message });
    }
};
exports.login = login;
// Request magic link
const requestMagicLink = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        // Find or create user
        let user = await User_1.User.findOne({ email: email.toLowerCase() });
        if (!user) {
            user = await User_1.User.create({
                email: email.toLowerCase(),
                credits: 100,
                plan: "free"
            });
        }
        // Generate magic link token
        const token = (0, crypto_2.generateSecureToken)(32);
        const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        user.magicLinkToken = token;
        user.magicLinkExpires = expires;
        await user.save();
        // Build magic link URL
        const baseUrl = env_1.env.ALLOWED_ORIGINS.split(",")[0].trim();
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
                });
                logger_1.logger.info("Magic link email sent", { email, magicLink });
                return res.json({
                    success: true,
                    message: "Magic link sent to email"
                });
            }
            catch (emailError) {
                logger_1.logger.error("Failed to send magic link email", { error: emailError.message });
                // Return token in dev for testing if email fails
                if (!env_1.env.IS_PROD) {
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
        if (!env_1.env.IS_PROD) {
            return res.json({
                success: true,
                message: "Resend not configured, use dev token",
                _devToken: token,
                _devLink: magicLink
            });
        }
        return res.status(500).json({ error: "Email service not configured" });
    }
    catch (err) {
        logger_1.logger.error("Magic link request failed", { error: err.message });
        res.status(500).json({ error: err.message });
    }
};
exports.requestMagicLink = requestMagicLink;
// Verify magic link
const verifyMagicLink = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: "Token is required" });
        }
        const user = await User_1.User.findOne({
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
        const accessToken = jsonwebtoken_1.default.sign({ id: user._id, email: user.email, plan: user.plan }, env_1.env.JWT_SECRET, { expiresIn: "7d" });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user._id }, env_1.env.REFRESH_SECRET, { expiresIn: "30d" });
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
    }
    catch (err) {
        logger_1.logger.error("Magic link verification failed", { error: err.message });
        res.status(500).json({ error: err.message });
    }
};
exports.verifyMagicLink = verifyMagicLink;
// Refresh token
const refreshTokens = async (req, res) => {
    try {
        // Check cookie first, then body
        const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body.refreshToken;
        if (!refreshToken) {
            return res.status(400).json({ error: "Refresh token is required" });
        }
        // Verify refresh token
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.env.REFRESH_SECRET);
        }
        catch {
            res.clearCookie(ACCESS_TOKEN_COOKIE);
            res.clearCookie(REFRESH_TOKEN_COOKIE);
            return res.status(401).json({ error: "Invalid refresh token" });
        }
        const user = await User_1.User.findById(decoded.id);
        if (!user || user.refreshToken !== refreshToken) {
            res.clearCookie(ACCESS_TOKEN_COOKIE);
            res.clearCookie(REFRESH_TOKEN_COOKIE);
            return res.status(401).json({ error: "Invalid refresh token" });
        }
        // Generate new access token
        const accessToken = jsonwebtoken_1.default.sign({ id: user._id, email: user.email, plan: user.plan }, env_1.env.JWT_SECRET, { expiresIn: "3d" });
        user.accessToken = accessToken;
        await user.save();
        // Set cookie
        res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 60 * 60 * 1000
        });
        res.json({ accessToken });
    }
    catch (err) {
        logger_1.logger.error("Token refresh failed", { error: err.message });
        res.status(500).json({ error: err.message });
    }
};
exports.refreshTokens = refreshTokens;
// Logout
const logout = async (req, res) => {
    try {
        // Get token from cookie or header
        const token = req.cookies?.[ACCESS_TOKEN_COOKIE] ||
            req.headers.authorization?.slice(7);
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
                await User_1.User.findByIdAndUpdate(decoded.id, {
                    accessToken: null,
                    refreshToken: null
                });
            }
            catch {
                // Token invalid, but logout anyway
            }
        }
        // Clear cookies
        res.clearCookie(ACCESS_TOKEN_COOKIE);
        res.clearCookie(REFRESH_TOKEN_COOKIE);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.logout = logout;
// Get current user
const getCurrentUser = async (req, res) => {
    try {
        // Get token from cookie or header
        const token = req.cookies?.[ACCESS_TOKEN_COOKIE] ||
            req.headers.authorization?.slice(7);
        if (!token) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        }
        catch {
            return res.status(401).json({ error: "Invalid token" });
        }
        const user = await User_1.User.findById(decoded.id);
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getCurrentUser = getCurrentUser;
// Update user profile
const updateProfile = async (req, res) => {
    try {
        const { name, timeZone } = req.body;
        const user = await User_1.User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (name !== undefined)
            user.name = name;
        if (timeZone !== undefined)
            user.timeZone = timeZone;
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.updateProfile = updateProfile;
exports.default = {
    register: exports.register,
    login: exports.login,
    requestMagicLink: exports.requestMagicLink,
    verifyMagicLink: exports.verifyMagicLink,
    refreshTokens: exports.refreshTokens,
    logout: exports.logout,
    getCurrentUser: exports.getCurrentUser,
    updateProfile: exports.updateProfile
};
