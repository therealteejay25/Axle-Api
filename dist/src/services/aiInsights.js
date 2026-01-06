"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDashboardInsights = exports.generateReliabilityRecommendations = exports.generateCostSuggestions = exports.generateOptimizations = exports.detectAnomalies = exports.detectPatterns = void 0;
const analytics_1 = require("./analytics");
const Execution_1 = require("../models/Execution");
const Agent_1 = require("../models/Agent");
const Integration_1 = require("../models/Integration");
const User_1 = require("../models/User");
const User_2 = require("../models/User");
/**
 * Detect usage patterns
 */
const detectPatterns = async (userId) => {
    const insights = [];
    // Get last 30 days of executions
    const executions = await Execution_1.Execution.find({
        userId,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).lean();
    if (executions.length < 10)
        return insights; // Need enough data
    // Analyze by  day of week
    const byDayOfWeek = {};
    executions.forEach(e => {
        const day = new Date(e.createdAt).getDay();
        byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1;
    });
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const peakDay = Object.keys(byDayOfWeek).reduce((a, b) => byDayOfWeek[parseInt(a)] > byDayOfWeek[parseInt(b)] ? a : b);
    if (byDayOfWeek[parseInt(peakDay)] > executions.length * 0.3) {
        insights.push({
            type: 'pattern',
            icon: '📊',
            title: 'Peak Usage Day Detected',
            message: `Your agents run most frequently on ${daysOfWeek[parseInt(peakDay)]}s`,
            actionable: false
        });
    }
    // Analyze by hour
    const byHour = {};
    executions.forEach(e => {
        const hour = new Date(e.createdAt).getHours();
        byHour[hour] = (byHour[hour] || 0) + 1;
    });
    const peakHour = Object.keys(byHour).reduce((a, b) => byHour[parseInt(a)] > byHour[parseInt(b)] ? a : b);
    if (byHour[parseInt(peakHour)] > executions.length * 0.2) {
        insights.push({
            type: 'pattern',
            icon: '⏰',
            title: 'Peak Hour Identified',
            message: `Most agent runs happen around ${peakHour}:00 - ${parseInt(peakHour) + 1}:00`,
            actionable: false
        });
    }
    return insights;
};
exports.detectPatterns = detectPatterns;
/**
 * Detect anomalies
 */
const detectAnomalies = async (userId) => {
    const insights = [];
    const last7Days = await Execution_1.Execution.countDocuments({
        userId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    const previous7Days = await Execution_1.Execution.countDocuments({
        userId,
        createdAt: {
            $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
    });
    // Spike detection
    if (last7Days > previous7Days * 2) {
        insights.push({
            type: 'anomaly',
            icon: '📈',
            title: 'Usage Spike Detected',
            message: `Agent activity increased by ${Math.round(((last7Days - previous7Days) / previous7Days) * 100)}% this week`,
            actionable: false
        });
    }
    // Drop detection
    if (last7Days < previous7Days * 0.5 && previous7Days > 10) {
        insights.push({
            type: 'anomaly',
            icon: '📉',
            title: 'Usage Drop Detected',
            message: `Agent activity decreased by ${Math.round(((previous7Days - last7Days) / previous7Days) * 100)}% this week`,
            actionable: false
        });
    }
    return insights;
};
exports.detectAnomalies = detectAnomalies;
/**
 * Generate optimization suggestions
 */
const generateOptimizations = async (userId) => {
    const insights = [];
    // Check for agents with multiple similar actions
    const agents = await Agent_1.Agent.find({ ownerId: userId }).lean();
    for (const agent of agents) {
        const executions = await Execution_1.Execution.find({ agentId: agent._id }).limit(10).lean();
        if (executions.length > 5) {
            const actionCounts = {};
            executions.forEach(e => {
                e.actionsExecuted?.forEach(a => {
                    const base = a.type.split('_')[0];
                    actionCounts[base] = (actionCounts[base] || 0) + 1;
                });
            });
            // If same integration used 3+ times, suggest batching
            Object.entries(actionCounts).forEach(([integration, count]) => {
                if (count >= 3) {
                    insights.push({
                        type: 'optimization',
                        icon: '💡',
                        title: 'Batch Actions for Efficiency',
                        message: `Your '${agent.name}' agent makes ${count} ${integration} calls. Consider batching to reduce execution time`,
                        actionable: true,
                        action: 'Optimize agent',
                        actionUrl: `/agents/${agent._id}/edit`
                    });
                }
            });
        }
    }
    return insights;
};
exports.generateOptimizations = generateOptimizations;
/**
 * Generate cost optimization suggestions
 */
const generateCostSuggestions = async (userId) => {
    const insights = [];
    const user = await User_1.User.findById(userId);
    if (!user)
        return insights;
    const metrics = await (0, analytics_1.getUserMetrics)(userId, 30);
    const currentLimits = User_2.PLAN_LIMITS[user.plan];
    // Suggest upgrade if approaching limit
    const usagePercent = (metrics.totalCreditsUsed / currentLimits.monthlyCredits) * 100;
    if (usagePercent > 80 && user.plan !== 'deluxe') {
        const nextPlans = {
            free: 'pro',
            pro: 'premium',
            premium: 'deluxe'
        };
        const nextPlan = nextPlans[user.plan];
        if (nextPlan) {
            insights.push({
                type: 'cost',
                icon: '💰',
                title: 'Upgrade Recommended',
                message: `You've used ${Math.round(usagePercent)}% of your monthly credits. Consider upgrading to avoid hitting limits`,
                actionable: true,
                action: 'View plans',
                actionUrl: '/billing/plans'
            });
        }
    }
    // Suggest annual billing
    if (user.plan !== 'free' && !user.subscriptionStatus) {
        insights.push({
            type: 'cost',
            icon: '💵',
            title: 'Save 20% with Annual Billing',
            message: 'Switch to annual payment and save 2 months worth of subscription fees',
            actionable: true,
            action: 'Switch to annual',
            actionUrl: '/billing/plans'
        });
    }
    return insights;
};
exports.generateCostSuggestions = generateCostSuggestions;
/**
 * Generate reliability recommendations
 */
const generateReliabilityRecommendations = async (userId) => {
    const recommendations = [];
    // Find agents with high failure rates
    const agentPerf = await (0, analytics_1.getAgentPerformance)(userId);
    agentPerf.forEach(agent => {
        if (agent.successRate < 80 && agent.totalRuns > 5) {
            recommendations.push({
                priority: 'high',
                category: 'reliability',
                title: `Fix Failure: ${agent.agentName}`,
                description: `Your '${agent.agentName}' agent has a ${agent.successRate}% success rate (below 80%). Check integration connections and action parameters.`,
                impact: `Would restore ${100 - agent.successRate}% of failed executions`,
                effort: '5 minutes',
                cta: 'View agent',
                ctaUrl: `/agents/${agent.agentId}`
            });
        }
    });
    // Check for expired integrations
    const integrations = await Integration_1.Integration.find({ userId }).lean();
    const now = Date.now();
    integrations.forEach(int => {
        if (int.expiresAt) {
            const daysUntilExpiry = Math.floor((new Date(int.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry <= 0) {
                recommendations.push({
                    priority: 'high',
                    category: 'reliability',
                    title: `Reconnect ${int.provider} Integration`,
                    description: `Your ${int.provider} integration has expired. Agents using ${int.provider} will fail until you reconnect.`,
                    impact: 'Prevents all failures related to this integration',
                    effort: '1 minute',
                    cta: `Reconnect ${int.provider}`,
                    ctaUrl: `/integrations/${int.provider}/connect`
                });
            }
        }
    });
    return recommendations;
};
exports.generateReliabilityRecommendations = generateReliabilityRecommendations;
/**
 * Generate all insights for dashboard
 */
const generateDashboardInsights = async (userId) => {
    const [patterns, anomalies, optimizations, costSuggestions] = await Promise.all([
        (0, exports.detectPatterns)(userId),
        (0, exports.detectAnomalies)(userId),
        (0, exports.generateOptimizations)(userId),
        (0, exports.generateCostSuggestions)(userId)
    ]);
    const recommendations = await (0, exports.generateReliabilityRecommendations)(userId);
    return {
        insights: [...patterns, ...anomalies, ...optimizations, ...costSuggestions],
        recommendations
    };
};
exports.generateDashboardInsights = generateDashboardInsights;
exports.default = {
    detectPatterns: exports.detectPatterns,
    detectAnomalies: exports.detectAnomalies,
    generateOptimizations: exports.generateOptimizations,
    generateCostSuggestions: exports.generateCostSuggestions,
    generateReliabilityRecommendations: exports.generateReliabilityRecommendations,
    generateDashboardInsights: exports.generateDashboardInsights
};
