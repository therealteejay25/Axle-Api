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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// ============================================
// HEALTH ROUTES
// ============================================
const router = (0, express_1.Router)();
// Liveness check
router.get("/live", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// Readiness check
router.get("/ready", async (req, res) => {
    try {
        // Check database
        const mongoose = await Promise.resolve().then(() => __importStar(require("mongoose")));
        const dbReady = mongoose.connection.readyState === 1;
        // Check Redis
        const { redis } = await Promise.resolve().then(() => __importStar(require("../lib/redis")));
        const redisReady = redis.status === "ready";
        if (dbReady && redisReady) {
            res.json({
                status: "ready",
                db: "connected",
                redis: "connected"
            });
        }
        else {
            res.status(503).json({
                status: "not ready",
                db: dbReady ? "connected" : "disconnected",
                redis: redisReady ? "connected" : "disconnected"
            });
        }
    }
    catch (err) {
        res.status(503).json({
            status: "error",
            error: err.message
        });
    }
});
exports.default = router;
