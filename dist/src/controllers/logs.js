"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAgentLogsController = exports.getInsightsController = exports.getAllReportsController = exports.getAgentReportController = exports.getAllLogsController = exports.getAgentLogsController = void 0;
const Agent_1 = require("../models/Agent");
const logger_1 = require("../lib/logger");
/**
 * Get logs for a specific agent
 */
const getAgentLogsController = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const { limit = 50, offset = 0 } = req.query;
    const correlationId = req.correlationId;
    try {
        const agent = await Agent_1.Agent.findById(id).lean();
        if (!agent)
            return res.status(404).json({ error: "Agent not found" });
        if (agent.ownerId !== userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        const logs = (agent.logs || []).slice(-parseInt(limit));
        const totalLogs = (agent.logs || []).length;
        res.json({
            agentId: id,
            agentName: agent.name,
            totalLogs,
            logs,
        });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Get agent logs failed`, err);
        res.status(500).json({ error: "Unable to get agent logs" });
    }
};
exports.getAgentLogsController = getAgentLogsController;
/**
 * Get all logs across all agents for a user
 */
const getAllLogsController = async (req, res) => {
    const userId = req.userId;
    const { limit = 100 } = req.query;
    const correlationId = req.correlationId;
    try {
        const agents = await Agent_1.Agent.find({ ownerId: userId }).lean();
        const allLogs = agents
            .flatMap((agent) => (agent.logs || []).map((log) => ({
            agentId: String(agent._id),
            agentName: agent.name,
            ...log,
        })))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, parseInt(limit));
        res.json({
            totalLogs: allLogs.length,
            logs: allLogs,
        });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Get all logs failed`, err);
        res.status(500).json({ error: "Unable to get logs" });
    }
};
exports.getAllLogsController = getAllLogsController;
/**
 * Get execution report and summary for a specific agent
 */
const getAgentReportController = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const correlationId = req.correlationId;
    try {
        const agent = await Agent_1.Agent.findById(id).lean();
        if (!agent)
            return res.status(404).json({ error: "Agent not found" });
        if (agent.ownerId !== userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        const logs = (agent.logs || []);
        const totalExecutions = logs.length;
        const successfulExecutions = logs.filter((log) => !log.message.toLowerCase().includes("error")).length;
        const failedExecutions = totalExecutions - successfulExecutions;
        // Calculate average execution time if available
        const lastRun = agent.lastRunAt
            ? new Date(agent.lastRunAt)
            : null;
        const createdAt = new Date(agent.createdAt);
        const daysActive = lastRun
            ? Math.floor((lastRun.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
            : 0;
        const summary = {
            agentId: id,
            agentName: agent.name,
            description: agent.description,
            model: agent.model || "gpt-4o",
            tools: agent.tools || [],
            schedule: agent.schedule,
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100).toFixed(2) + "%" : "N/A",
            lastRunAt: agent.lastRunAt,
            createdAt: agent.createdAt,
            daysActive,
            recentLogs: logs.slice(-10),
        };
        res.json(summary);
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Get agent report failed`, err);
        res.status(500).json({ error: "Unable to get agent report" });
    }
};
exports.getAgentReportController = getAgentReportController;
/**
 * Get summary report for all agents
 */
const getAllReportsController = async (req, res) => {
    const userId = req.userId;
    const correlationId = req.correlationId;
    try {
        const agents = await Agent_1.Agent.find({ ownerId: userId }).lean();
        const reports = agents.map((agent) => {
            const logs = (agent.logs || []);
            const totalExecutions = logs.length;
            const successfulExecutions = logs.filter((log) => !log.message.toLowerCase().includes("error")).length;
            return {
                agentId: String(agent._id),
                agentName: agent.name,
                totalExecutions,
                successfulExecutions,
                failedExecutions: totalExecutions - successfulExecutions,
                successRate: totalExecutions > 0 ? ((successfulExecutions / totalExecutions) * 100).toFixed(2) + "%" : "N/A",
                lastRunAt: agent.lastRunAt,
                model: agent.model || "gpt-4o",
                tools: agent.tools || [],
            };
        });
        const totalStats = {
            totalAgents: agents.length,
            totalExecutions: reports.reduce((sum, r) => sum + r.totalExecutions, 0),
            totalSuccessful: reports.reduce((sum, r) => sum + r.successfulExecutions, 0),
            averageSuccessRate: ((reports.reduce((sum, r) => sum + parseFloat(r.successRate), 0) /
                reports.length) ||
                0).toFixed(2) + "%",
        };
        res.json({
            summary: totalStats,
            agentReports: reports,
        });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Get all reports failed`, err);
        res.status(500).json({ error: "Unable to get reports" });
    }
};
exports.getAllReportsController = getAllReportsController;
/**
 * Get AI-summarized insights about agent performance
 */
const getInsightsController = async (req, res) => {
    const userId = req.userId;
    const { agentId } = req.query;
    const correlationId = req.correlationId;
    try {
        if (agentId) {
            // Get insights for a specific agent
            const agent = await Agent_1.Agent.findById(agentId).lean();
            if (!agent)
                return res.status(404).json({ error: "Agent not found" });
            if (agent.ownerId !== userId) {
                return res.status(403).json({ error: "Unauthorized" });
            }
            const logs = (agent.logs || []);
            const insights = generateAgentInsights(agent, logs);
            return res.json(insights);
        }
        else {
            // Get insights for all agents
            const agents = await Agent_1.Agent.find({ ownerId: userId }).lean();
            const allInsights = agents.map((agent) => {
                const logs = (agent.logs || []);
                return generateAgentInsights(agent, logs);
            });
            res.json({
                totalAgents: agents.length,
                agentInsights: allInsights,
                overallRecommendations: generateOverallRecommendations(allInsights),
            });
        }
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Get insights failed`, err);
        res.status(500).json({ error: "Unable to get insights" });
    }
};
exports.getInsightsController = getInsightsController;
function generateAgentInsights(agent, logs) {
    const totalLogs = logs.length;
    const errors = logs.filter((log) => log.message.toLowerCase().includes("error"));
    const errorRate = totalLogs > 0 ? ((errors.length / totalLogs) * 100).toFixed(2) : 0;
    const insights = {
        agentId: String(agent._id),
        agentName: agent.name,
        totalExecutions: totalLogs,
        errorCount: errors.length,
        errorRate: errorRate + "%",
        recommendations: [],
        lastActivity: logs[logs.length - 1]?.createdAt || agent.lastRunAt,
    };
    // Generate recommendations based on performance
    if (errorRate > 50) {
        insights.recommendations.push("❌ High error rate detected. Review agent configuration and tools.");
    }
    else if (errorRate > 25) {
        insights.recommendations.push("⚠️ Moderate error rate. Consider debugging recent failures.");
    }
    else if (totalLogs === 0) {
        insights.recommendations.push("ℹ️ No executions yet. Create an agent instance to start.");
    }
    else {
        insights.recommendations.push("✅ Agent performing well. Continue monitoring.");
    }
    if (!agent.schedule?.enabled && totalLogs > 0) {
        insights.recommendations.push("💡 Consider enabling scheduling for automated execution.");
    }
    if (!agent.tools || agent.tools.length === 0) {
        insights.recommendations.push("🔧 Configure tools to expand agent capabilities.");
    }
    return insights;
}
function generateOverallRecommendations(insights) {
    const recommendations = [];
    const avgErrorRate = insights.reduce((sum, i) => sum + parseFloat(i.errorRate), 0) /
        insights.length || 0;
    if (avgErrorRate > 30) {
        recommendations.push("Review system performance - check integrations and error logs");
    }
    const inactiveAgents = insights.filter((i) => !i.lastActivity ||
        new Date().getTime() - new Date(i.lastActivity).getTime() > 7 * 24 * 60 * 60 * 1000);
    if (inactiveAgents.length > 0) {
        recommendations.push(`${inactiveAgents.length} agents inactive for >7 days - consider enabling them`);
    }
    if (recommendations.length === 0) {
        recommendations.push("All agents performing optimally - keep monitoring!");
    }
    return recommendations;
}
/**
 * Clear logs for a specific agent
 */
const clearAgentLogsController = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const correlationId = req.correlationId;
    try {
        const agent = await Agent_1.Agent.findById(id);
        if (!agent)
            return res.status(404).json({ error: "Agent not found" });
        if (agent.ownerId !== userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        agent.logs = [];
        await agent.save();
        logger_1.logger.info(`[${correlationId}] Cleared logs for agent ${id}`);
        res.json({ message: "Logs cleared successfully" });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Clear logs failed`, err);
        res.status(500).json({ error: "Unable to clear logs" });
    }
};
exports.clearAgentLogsController = clearAgentLogsController;
exports.default = {};
