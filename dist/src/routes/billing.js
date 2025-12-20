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
const billing_1 = require("../services/billing");
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
// ============================================
// BILLING ROUTES
// ============================================
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Get billing info
router.get("/", async (req, res) => {
    try {
        const info = await (0, billing_1.getBillingInfo)(req.user.id);
        res.json(info);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get plan options
router.get("/plans", async (req, res) => {
    try {
        const plans = Object.entries(User_1.PLAN_LIMITS).map(([name, limits]) => ({
            name,
            ...limits,
            current: name === req.user.plan
        }));
        res.json({ plans });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Upgrade plan (stub - would integrate with payment provider)
router.post("/upgrade", async (req, res) => {
    try {
        const { plan } = req.body;
        if (!["free", "pro", "premium", "deluxe"].includes(plan)) {
            return res.status(400).json({ error: "Invalid plan" });
        }
        const user = await User_1.User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // In production, this would process payment first
        user.plan = plan;
        // Reset credits to new plan's monthly allowance
        const newLimits = User_1.PLAN_LIMITS[plan];
        user.credits = newLimits.monthlyCredits;
        await user.save();
        res.json({
            success: true,
            plan: user.plan,
            credits: user.credits,
            agentLimit: newLimits.agentLimit
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Purchase credits (stub - would integrate with payment provider)
router.post("/credits", async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount < 1) {
            return res.status(400).json({ error: "Invalid amount" });
        }
        // In production, this would process payment first
        const newBalance = await (0, billing_1.addCredits)(req.user.id, amount);
        res.json({
            success: true,
            creditsAdded: amount,
            newBalance
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get credit usage history
router.get("/usage", async (req, res) => {
    try {
        const { days = "30" } = req.query;
        const { Execution } = await Promise.resolve().then(() => __importStar(require("../models/Execution")));
        const { Agent } = await Promise.resolve().then(() => __importStar(require("../models/Agent")));
        const agents = await Agent.find({ ownerId: req.user.id }).select("_id");
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));
        const usage = await Execution.aggregate([
            {
                $match: {
                    agentId: { $in: agents.map(a => a._id) },
                    createdAt: { $gte: daysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    executions: { $sum: 1 },
                    creditsUsed: { $sum: "$creditsUsed" },
                    tokensUsed: { $sum: "$aiTokensUsed" }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        const totals = usage.reduce((acc, day) => ({
            executions: acc.executions + day.executions,
            creditsUsed: acc.creditsUsed + day.creditsUsed,
            tokensUsed: acc.tokensUsed + day.tokensUsed
        }), { executions: 0, creditsUsed: 0, tokensUsed: 0 });
        res.json({
            daily: usage,
            totals,
            period: `${days} days`
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
