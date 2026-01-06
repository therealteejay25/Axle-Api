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
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const analytics_1 = require("../services/analytics");
const aiInsights_1 = require("../services/aiInsights");
const User_1 = require("../models/User");
const nlFormatter_1 = require("../services/nlFormatter");
const analytics_2 = require("../services/analytics");
const triggers_1 = require("../services/triggers");
const smartNotifications_1 = require("../services/smartNotifications");
const Execution_1 = require("../models/Execution");
const os_1 = __importDefault(require("os"));
const actionTemplates_1 = require("../lib/actionTemplates");
// ============================================
// DASHBOARD ROUTES
// ============================================
// Analytics and insights dashboard
// ============================================
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Get dashboard overview
router.get("/overview", async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id);
        if (!user)
            return res.status(404).json({ error: "User not found" });
        const metrics = await (0, analytics_1.getUserMetrics)(req.user.id, 30);
        const limits = User_1.PLAN_LIMITS[user.plan];
        // Calculate days remaining in billing cycle
        const now = Date.now();
        const resetDate = new Date(user.creditsResetAt);
        const daysRemaining = Math.max(0, Math.ceil((resetDate.getTime() - now) / (1000 * 60 * 60 * 24)));
        res.json({
            overview: {
                // Core metrics
                totalExecutions: metrics.totalExecutions,
                totalExecutionsExplained: "Number of times your agents have run in the past 30 days",
                successRate: metrics.successRate,
                successRateExplained: metrics.successRate >= 90
                    ? `✅ ${metrics.successRate}% success rate - excellent!`
                    : metrics.successRate >= 75
                        ? `👍 ${metrics.successRate}% success rate - good, room for improvement`
                        : `⚠️ ${metrics.successRate}% success rate - needs attention`,
                // Credits
                creditsUsed: metrics.totalCreditsUsed,
                creditsRemaining: user.credits,
                creditsLimit: limits.monthlyCredits,
                creditsExplained: `You've used ${Math.round((metrics.totalCreditsUsed / limits.monthlyCredits) * 100)}% of your monthly credits with ${daysRemaining} days remaining`,
                creditsResetDate: user.creditsResetAt,
                creditsResetHuman: `Resets ${(0, nlFormatter_1.humanizeTime)(user.creditsResetAt)}`,
                // Performance
                avgExecutionTime: metrics.avgExecutionTime,
                avgExecutionTimeExplained: `Average agent run takes ${metrics.avgExecutionTime} seconds`,
                mostUsedAgent: metrics.mostUsedAgent,
                mostUsedAgentExplained: `Your '${metrics.mostUsedAgent}' agent runs most frequently`,
                mostUsedIntegration: metrics.mostUsedIntegration,
                mostUsedIntegrationExplained: `${metrics.mostUsedIntegration.charAt(0).toUpperCase() + metrics.mostUsedIntegration.slice(1)} is your most-used service`,
                // Account
                currentPlan: user.plan,
                currentPlanExplained: `You're on the ${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} plan`,
                agentLimit: limits.agentLimit,
                subscriptionStatus: user.subscriptionStatus || 'free'
            }
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get detailed analytics
router.get("/analytics", async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const [metrics, timeSeries, agentPerf] = await Promise.all([
            (0, analytics_1.getUserMetrics)(req.user.id, days),
            (0, analytics_1.getTimeSeriesData)(req.user.id, days),
            (0, analytics_1.getAgentPerformance)(req.user.id)
        ]);
        res.json({
            metrics,
            timeSeries,
            agentPerformance: agentPerf.map(agent => ({
                ...agent,
                lastRunHuman: agent.lastRun ? (0, nlFormatter_1.humanizeTime)(agent.lastRun) : 'Never run',
                successRateExplained: agent.successRate >= 90
                    ? '✅ Excellent'
                    : agent.successRate >= 75
                        ? '👍 Good'
                        : '⚠️ Needs attention'
            })),
            period: `Last ${days} days`
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get AI insights
router.get("/insights", async (req, res) => {
    try {
        const { insights, recommendations } = await (0, aiInsights_1.generateDashboardInsights)(req.user.id);
        res.json({
            insights,
            recommendations,
            summary: `Generated ${insights.length} insights and ${recommendations.length} recommendations based on your usage patterns`
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
//  Get quick stats (for sidebar/header)
router.get("/quick-stats", async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id);
        if (!user)
            return res.status(404).json({ error: "User not found" });
        const limits = User_1.PLAN_LIMITS[user.plan];
        const creditsPercent = Math.round((user.credits / limits.monthlyCredits) * 100);
        res.json({
            credits: user.credits,
            creditsLimit: limits.monthlyCredits,
            creditsPercent,
            creditsStatus: creditsPercent > 50
                ? '✅ Plenty of credits'
                : creditsPercent > 20
                    ? '⚠️ Running low'
                    : '❌ Credits nearly depleted',
            plan: user.plan,
            planEmoji: user.plan === 'free' ? '🆓' : user.plan === 'pro' ? '⭐' : user.plan === 'premium' ? '💎' : '🏢'
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Live Dashboard Data - COMPREHENSIVE
router.get("/live", async (req, res) => {
    try {
        const userId = req.user.id;
        const AgentModel = await Promise.resolve().then(() => __importStar(require("../models/Agent"))).then((m) => m.Agent);
        const agentDocs = await AgentModel.find({ ownerId: userId }).select("_id").lean();
        const agentIds = agentDocs.map((a) => a._id);
        // Parallel fetch for potential performance, live dashboard needs to be snappy
        const [user, agents, activeExecutions, recentExecutions, recentActivityRaw, nextTriggers, metrics, integrations] = await Promise.all([
            User_1.User.findById(userId).lean(),
            AgentModel.find({ ownerId: userId }).sort({ updatedAt: -1 }).lean(),
            Execution_1.Execution.find({
                agentId: { $in: agentIds },
                status: { $in: ['running', 'pending'] }
            })
                .limit(5)
                .populate('agentId', 'name')
                .select('agentId status startedAt name triggerType inputPayload')
                .lean(),
            Execution_1.Execution.find({ agentId: { $in: agentIds } })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('agentId', 'name')
                .select('agentId status triggerType createdAt startedAt finishedAt creditsUsed outputPayload error')
                .lean(),
            (0, analytics_2.getRecentActivity)(userId, 20), // Increased limit for detailed audit
            (0, triggers_1.getNextScheduledRuns)(userId, 5),
            (0, analytics_1.getUserMetrics)(userId, 30),
            Promise.resolve().then(() => __importStar(require("../models/Integration"))).then(m => m.Integration.find({ userId }).select('provider status connectedAt metadata').lean())
        ]);
        if (!user)
            return res.status(404).json({ error: "User not found" });
        // Enhance Audit Logs
        const enhancedActivity = recentActivityRaw.map(log => {
            const p = log.params || {};
            let description = log.actionType;
            switch (log.actionType) {
                case 'agent_run':
                    description = `Agent '${p.agentName || 'Unknown'}' started running`;
                    break;
                case 'agent_created':
                    description = `Created new agent '${p.name || 'Untitled'}'`;
                    break;
                case 'agent_updated':
                    description = `Updated agent '${p.name || 'Unknown'}'`;
                    break;
                case 'agent_deleted':
                    description = `Deleted agent '${p.name || 'Unknown'}'`;
                    break;
                case 'user_login':
                    description = `Logged in via ${p.method || 'unknown method'}`;
                    break;
                case 'integration_connected':
                    description = `Connected ${p.provider} account`;
                    break;
                case 'credits_deducted':
                    description = `Used ${p.amount} credits`;
                    break;
                default: description = log.actionType.replace(/_/g, ' ');
            }
            return { ...log, description, timestampHuman: (0, nlFormatter_1.humanizeTime)(log.timestamp) };
        });
        const limits = User_1.PLAN_LIMITS[user.plan];
        res.json({
            // 1. User Economy
            user: {
                plan: user.plan,
                credits: user.credits,
                creditsLimit: limits.monthlyCredits,
                creditsResetAt: user.creditsResetAt,
                stripeStatus: user.subscriptionStatus || 'free',
                daysRemaining: Math.max(0, Math.ceil((new Date(user.creditsResetAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            },
            // 2. Agent Intelligence
            agents: agents.map((a) => ({
                _id: a._id,
                name: a.name,
                status: a.status,
                model: a.brain?.model,
                temperature: a.brain?.temperature,
                instructions: a.instructions || a.description || "No specific instructions",
                lastRun: a.updatedAt // Approximation if no exec history linked directly here easily
            })),
            // 3. Analytics & Performance
            analytics: {
                successRate: metrics.successRate,
                totalExecutions: metrics.totalExecutions,
                avgExecutionTime: metrics.avgExecutionTime,
                mostUsedAgent: metrics.mostUsedAgent
            },
            // 4. Integrations Status
            integrations: integrations.map((i) => ({
                provider: i.provider,
                status: i.status,
                connectedAt: i.connectedAt,
                metadata: i.metadata
            })),
            // 5. Live Activity
            activeExecutions: activeExecutions.map(e => ({
                ...e,
                agentName: e.agentId?.name || 'Unknown Agent',
                duration: e.startedAt ? Math.round((Date.now() - new Date(e.startedAt).getTime()) / 1000) : 0,
                triggerType: e.triggerType || 'manual',
                triggerSource: e?.inputPayload?.source
            })),
            recentExecutions: (recentExecutions || []).map((e) => {
                const startedAt = e.startedAt || e.createdAt;
                const finishedAt = e.finishedAt;
                const durationMs = startedAt && finishedAt
                    ? new Date(finishedAt).getTime() - new Date(startedAt).getTime()
                    : undefined;
                return {
                    _id: e._id,
                    agentId: e.agentId,
                    agentName: e.agentId?.name || 'Unknown Agent',
                    status: e.status,
                    triggerType: e.triggerType,
                    createdAt: e.createdAt,
                    startedAt: e.startedAt,
                    finishedAt: e.finishedAt,
                    durationMs,
                    creditsUsed: e.creditsUsed,
                    summary: e?.outputPayload?.summary || e?.error || ''
                };
            }),
            recentActivity: enhancedActivity,
            nextTriggers: nextTriggers,
            // 6. System Health
            systemHealth: {
                cpuLoad1m: os_1.default.loadavg()[0] || 0,
                memoryRssBytes: process.memoryUsage().rss,
                memoryHeapUsedBytes: process.memoryUsage().heapUsed,
                memoryHeapTotalBytes: process.memoryUsage().heapTotal,
                uptime: process.uptime(),
                status: 'operational'
            }
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Smart Notifications
router.get("/notifications", async (req, res) => {
    try {
        // In a real prod app, you might cache this or store generated notifications in DB
        // For now, we generate fresh ones for the "Live" feel
        const notifications = await (0, smartNotifications_1.generateSmartNotifications)(req.user.id);
        res.json({ notifications });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Templates
router.get("/templates", async (_req, res) => {
    try {
        const templates = (0, actionTemplates_1.getAllTemplates)();
        const categories = (0, actionTemplates_1.getTemplateCategories)();
        res.json({ templates, categories });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
