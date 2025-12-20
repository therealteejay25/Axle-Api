"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthMiddleware = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Authorization required" });
        }
        const token = authHeader.slice(7);
        // Verify token
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        }
        catch (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ error: "Token expired" });
            }
            return res.status(401).json({ error: "Invalid token" });
        }
        // Attach user to request
        req.user = {
            id: decoded.id,
            email: decoded.email,
            plan: decoded.plan
        };
        next();
    }
    catch (err) {
        res.status(500).json({ error: "Authentication error" });
    }
};
exports.authMiddleware = authMiddleware;
// Optional auth - doesn't fail if no token
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.slice(7);
            try {
                const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
                req.user = {
                    id: decoded.id,
                    email: decoded.email,
                    plan: decoded.plan
                };
            }
            catch {
                // Continue without auth
            }
        }
        next();
    }
    catch {
        next();
    }
};
exports.optionalAuthMiddleware = optionalAuthMiddleware;
exports.default = exports.authMiddleware;
