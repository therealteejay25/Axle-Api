"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentActivity = exports.getAgentPerformance = exports.getTimeSeriesData = exports.getUserMetrics = void 0;
const Execution_1 = require("../models/Execution");
const Agent_1 = require("../models/Agent");
const AuditLog_1 = require("../models/AuditLog");
/**
 * Get usage metrics for a user
 */
const getUserMetrics = async (userId, days = 30) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    // Get executions
    const executions = await Execution_1.Execution.find({
        userId,
        createdAt: { $gte: startDate }
    }).populate('agentId', 'name').lean();
    const total = executions.length;
    const successful = executions.filter(e => e.status === 'success').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    // Calculate success rate
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    // Calculate avg execution time
    const executionTimes = executions
        .filter(e => e.finishedAt && e.createdAt)
        .map(e => new Date(e.finishedAt).getTime() - new Date(e.createdAt).getTime());
    const avgTime = executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0;
    // Find most used agent
    const agentCounts = {};
    executions.forEach(e => {
        const agentName = e.agentId?.name || 'Unknown';
        agentCounts[agentName] = (agentCounts[agentName] || 0) + 1;
    });
    const mostUsedAgent = Object.keys(agentCounts).length > 0
        ? Object.keys(agentCounts).reduce((a, b) => agentCounts[a] > agentCounts[b] ? a : b)
        : 'None';
    // Find most used integration (from actions)
    const integrationCounts = {};
    executions.forEach(e => {
        e.actionsExecuted?.forEach(action => {
            const integration = action.type.split('_')[0];
            integrationCounts[integration] = (integrationCounts[integration] || 0) + 1;
        });
    });
    const mostUsedIntegration = Object.keys(integrationCounts).length > 0
        ? Object.keys(integrationCounts).reduce((a, b) => integrationCounts[a] > integrationCounts[b] ? a : b)
        : 'None';
    // Calculate credits (simplified - assume 1 credit per execution)
    const totalCreditsUsed = executions.reduce((sum, e) => sum + (e.creditsUsed || 1), 0);
    return {
        totalExecutions: total,
        successfulExecutions: successful,
        failedExecutions: failed,
        successRate: Math.round(successRate * 10) / 10,
        totalCreditsUsed,
        avgExecutionTime: Math.round(avgTime / 1000), // in seconds
        mostUsedAgent,
        mostUsedIntegration
    };
};
exports.getUserMetrics = getUserMetrics;
/**
 * Get time series data for charts
 */
const getTimeSeriesData = async (userId, days = 30) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const executions = await Execution_1.Execution.find({
        userId,
        createdAt: { $gte: startDate }
    }).lean();
    // Group by date
    const dataByDate = {};
    executions.forEach(e => {
        const dateKey = new Date(e.createdAt).toISOString().split('T')[0];
        if (!dataByDate[dateKey]) {
            dataByDate[dateKey] = {
                date: dateKey,
                executions: 0,
                success: 0,
                failed: 0
            };
        }
        dataByDate[dateKey].executions++;
        if (e.status === 'success')
            dataByDate[dateKey].success++;
        if (e.status === 'failed')
            dataByDate[dateKey].failed++;
    });
    // Fill in missing dates
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        result.push(dataByDate[dateKey] || {
            date: dateKey,
            executions: 0,
            success: 0,
            failed: 0
        });
    }
    return result;
};
exports.getTimeSeriesData = getTimeSeriesData;
/**
 * Get agent performance stats
 */
const getAgentPerformance = async (userId) => {
    const agents = await Agent_1.Agent.find({ ownerId: userId }).lean();
    const performance = await Promise.all(agents.map(async (agent) => {
        const executions = await Execution_1.Execution.find({ agentId: agent._id }).lean();
        const total = executions.length;
        const successful = executions.filter(e => e.status === 'success').length;
        return {
            agentId: agent._id,
            agentName: agent.name,
            totalRuns: total,
            successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
            lastRun: executions[0]?.createdAt || null
        };
    }));
    return performance.sort((a, b) => b.totalRuns - a.totalRuns);
};
exports.getAgentPerformance = getAgentPerformance;
exports.default = {
    getUserMetrics: exports.getUserMetrics,
    getTimeSeriesData: exports.getTimeSeriesData,
    getAgentPerformance: exports.getAgentPerformance
};
/**
 * Get recent activity (audit logs)
 */
const getRecentActivity = async (userId, limit = 20) => {
    return await AuditLog_1.AuditLog.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
};
exports.getRecentActivity = getRecentActivity;
