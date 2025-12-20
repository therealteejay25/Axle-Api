"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutController = exports.refreshTokenController = exports.verifyMagicLinkController = exports.requestMagicLinkController = void 0;
const User_1 = require("../models/User");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const resend_1 = require("resend");
const logger_1 = require("../lib/logger");
const schemas_1 = require("../lib/schemas");
const resend = new resend_1.Resend(env_1.env.RESEND_API_KEY);
const requestMagicLinkController = async (req, res) => {
    const correlationId = req.correlationId;
    try {
        const validated = schemas_1.RequestMagicLinkSchema.parse(req.body);
        const { name, email } = validated;
        let user = await User_1.User.findOne({ email });
        if (!user) {
            user = await User_1.User.create({ name, email });
        }
        if (user) {
            const magicLinkToken = jsonwebtoken_1.default.sign({ userId: user._id, type: "magic" }, env_1.env.JWT_SECRET, { expiresIn: "15m" });
            user.magicLinkToken = magicLinkToken;
            user.magicLinkExpires = new Date(Date.now() + 15 * 60 * 1000);
            await user.save();
            const magicLinkUrl = `http://localhost:3000/auth/verify?token=${magicLinkToken}`;
            try {
                await resend.emails.send({
                    from: "Axle <onboarding@resend.dev>",
                    to: email,
                    subject: "Your Axle Magic Link",
                    html: `<p>Click <a href="${magicLinkUrl}">here</a> to log in. This link expires in 15 minutes.</p>`,
                });
                logger_1.logger.info(`[${correlationId}] Magic link sent to ${email}`);
                res.status(200).json({ message: "Magic link sent if email exists." });
            }
            catch (err) {
                logger_1.logger.error(`[${correlationId}] Failed to send magic link`, err);
                res.status(500).json({ error: "Unable to send magic link" });
            }
        }
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Request magic link failed`, err);
        if (err.name === "ZodError") {
            return res.status(400).json({ error: "Validation error" });
        }
        res.status(500).json({ error: "Unable to process request" });
    }
};
exports.requestMagicLinkController = requestMagicLinkController;
const verifyMagicLinkController = async (req, res) => {
    const { token } = req.body;
    const correlationId = req.correlationId;
    try {
        // Ensure JWT_SECRET is available
        if (!env_1.env.JWT_SECRET) {
            logger_1.logger.error(`[${correlationId}] JWT_SECRET is not configured`);
            return res.status(500).json({ error: "Server configuration error" });
        }
        const validated = schemas_1.VerifyMagicLinkSchema.parse(req.body);
        logger_1.logger.info(env_1.env.JWT_SECRET);
        const decoded = jsonwebtoken_1.default.verify(validated.token, env_1.env.JWT_SECRET);
        if (decoded.type !== "magic") {
            logger_1.logger.warn(`[${correlationId}] Invalid token type`);
            return res.status(401).json({ error: "Invalid token type." });
        }
        const user = await User_1.User.findOne({
            _id: decoded.userId,
            magicLinkToken: validated.token,
        });
        if (!user || !user.magicLinkExpires || user.magicLinkExpires < new Date()) {
            logger_1.logger.warn(`[${correlationId}] Invalid or expired magic link`);
            return res.status(401).json({ error: "Invalid or expired magic link" });
        }
        user.magicLinkToken = undefined;
        user.magicLinkExpires = undefined;
        await user.save();
        const accessToken = jsonwebtoken_1.default.sign({ userId: user._id }, env_1.env.JWT_SECRET, {
            expiresIn: "7d",
        });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user._id, type: "refresh" }, env_1.env.REFRESH_SECRET, {
            expiresIn: "30d",
        });
        user.accessToken = accessToken;
        user.refreshToken = refreshToken;
        await user.save();
        // Set HTTP-only cookies
        const COOKIE_OPTIONS = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for access token
        };
        const REFRESH_COOKIE_OPTIONS = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for refresh token
        };
        res.cookie("accessToken", accessToken, COOKIE_OPTIONS);
        res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
        logger_1.logger.info(`[${correlationId}] User authenticated: ${user._id}`);
        res.status(200).json({
            accessToken,
            refreshToken,
            user,
        });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Verify magic link failed`, err);
        if (err.name === "ZodError") {
            return res.status(400).json({ error: "Validation error" });
        }
        res.status(401).json({ error: "Invalid or expired magic link" });
    }
};
exports.verifyMagicLinkController = verifyMagicLinkController;
const refreshTokenController = async (req, res) => {
    const correlationId = req.correlationId;
    try {
        const validated = schemas_1.RefreshTokenSchema.parse(req.body);
        const { refreshToken } = validated;
        const decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.env.REFRESH_SECRET);
        if (decoded.type !== "refresh") {
            logger_1.logger.warn(`[${correlationId}] Invalid refresh token type`);
            return res.status(401).json({ error: "Invalid refresh token type" });
        }
        const user = await User_1.User.findOne({
            _id: decoded.userId,
            refreshToken,
        });
        if (!user) {
            logger_1.logger.warn(`[${correlationId}] Invalid refresh token`);
            return res.status(401).json({ error: "Invalid refresh token" });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, env_1.env.JWT_SECRET, {
            expiresIn: "7d",
        });
        // Update user's access token
        user.accessToken = token;
        await user.save();
        // Set HTTP-only cookie
        const COOKIE_OPTIONS = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        };
        res.cookie("accessToken", token, COOKIE_OPTIONS);
        logger_1.logger.info(`[${correlationId}] Token refreshed for user: ${user._id}`);
        res.status(200).json({ token });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Refresh token failed`, err);
        if (err.name === "ZodError") {
            return res.status(400).json({ error: "Validation error" });
        }
        res.status(401).json({ error: "Invalid or expired refresh token" });
    }
};
exports.refreshTokenController = refreshTokenController;
const logoutController = async (req, res) => {
    const correlationId = req.correlationId;
    try {
        // Clear cookies
        res.cookie("accessToken", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            expires: new Date(0),
        });
        res.cookie("refreshToken", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            expires: new Date(0),
        });
        logger_1.logger.info(`[${correlationId}] User logged out`);
        res.status(200).json({ message: "Logged out successfully" });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Logout failed`, err);
        res.status(500).json({ error: "Unable to logout" });
    }
};
exports.logoutController = logoutController;
exports.default = {};
