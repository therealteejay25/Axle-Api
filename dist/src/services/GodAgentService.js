"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GodAgentService = void 0;
const mongoose_1 = require("mongoose");
const Agent_1 = require("../models/Agent");
const Execution_1 = require("../models/Execution");
const AuditLog_1 = require("../models/AuditLog");
const registry_1 = require("../adapters/registry");
const Integration_1 = require("../models/Integration");
const crypto_1 = require("./crypto");
const logger_1 = require("./logger");
class GodAgentService {
    /**
     * Executes a tool on behalf of a user with auditing and safety checks.
     */
    static async executeTool(userId, actionType, params) {
        // 1. Safety Check: Destructive actions
        const highRiskPrefixes = ["delete", "remove", "archive", "unstar", "unfollow"];
        const isHighRisk = highRiskPrefixes.some(p => actionType.toLowerCase().includes(p));
        if (isHighRisk && !params.confirmed) {
            return {
                status: "awaiting_approval",
                message: `The action "${actionType}" is destructive. Please confirm execution.`,
                actionType,
                params
            };
        }
        const integrations = await Integration_1.Integration.find({
            userId: new mongoose_1.Types.ObjectId(userId),
            status: "connected"
        }).lean();
        const integrationMap = new Map(integrations.map((i) => [
            i.provider,
            {
                provider: i.provider,
                accessToken: (0, crypto_1.decryptToken)(i.accessToken),
                refreshToken: i.refreshToken ? (0, crypto_1.decryptToken)(i.refreshToken) : undefined,
                scopes: i.scopes || [],
                metadata: i.metadata || {}
            }
        ]));
        try {
            logger_1.logger.info("God Agent executing tool", { userId, actionType });
            const capabilityExecutor = require("../capabilities/executor");
            const capabilityAction = capabilityExecutor.getAction(actionType);
            let result;
            if (capabilityAction) {
                const execContext = {
                    integrations: integrationMap,
                    previousResults: {}
                };
                const execResult = await capabilityExecutor.executeAction(actionType, params, execContext);
                if (!execResult.success) {
                    throw new Error(execResult.error || "Action failed in capability layer");
                }
                result = execResult.data;
            }
            else {
                result = await (0, registry_1.executeAction)(actionType, params, integrationMap);
            }
            // 4. Audit Log
            await AuditLog_1.AuditLog.create({
                userId: new mongoose_1.Types.ObjectId(userId),
                actionType,
                params,
                result,
                timestamp: new Date()
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error("God Agent tool execution failed", { actionType, error: error.message });
            await AuditLog_1.AuditLog.create({
                userId: new mongoose_1.Types.ObjectId(userId),
                actionType,
                params,
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }
    /**
     * Fetches unified data summary for a user.
     */
    static async getDataSummary(userId) {
        const ownerObjectId = new mongoose_1.Types.ObjectId(userId);
        const agents = await Agent_1.Agent.find({ ownerId: ownerObjectId }).lean();
        const agentIds = agents.map((a) => a._id);
        const [recentExecutions, auditLogs, integrations] = await Promise.all([
            Execution_1.Execution.find({ agentId: { $in: agentIds } })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),
            AuditLog_1.AuditLog.find({ userId: ownerObjectId })
                .sort({ timestamp: -1 })
                .limit(10)
                .lean(),
            Integration_1.Integration.find({ userId: ownerObjectId, status: "connected" })
                .select("provider status tokenExpiresAt scopes metadata lastUsedAt")
                .lean()
        ]);
        return {
            agents,
            recentExecutions,
            auditLogs,
            integrations
        };
    }
    /**
     * High-level agent management.
     */
    static async manageAgent(userId, agentId, action) {
        const agent = await Agent_1.Agent.findOne({ _id: new mongoose_1.Types.ObjectId(agentId), ownerId: new mongoose_1.Types.ObjectId(userId) });
        if (!agent)
            throw new Error("Agent not found");
        switch (action) {
            case "pause":
                agent.status = "paused";
                await agent.save();
                break;
            case "resume":
                agent.status = "active";
                await agent.save();
                break;
            case "delete":
                await agent.deleteOne();
                break;
        }
        return { success: true, action, agentId };
    }
    // --- NEW METHODS FOR FULL PLATFORM ACCESS ---
    static async listAgents(userId, filters) {
        const query = { ownerId: new mongoose_1.Types.ObjectId(userId) };
        if (filters.status)
            query.status = filters.status;
        return Agent_1.Agent.find(query)
            .limit(filters.limit || 20)
            .sort({ createdAt: -1 })
            .lean();
    }
    static async createAgent(userId, data) {
        const agent = await Agent_1.Agent.create({
            ownerId: new mongoose_1.Types.ObjectId(userId),
            ...data,
            status: "draft", // Default to draft
            tools: [] // Default empty tools, will need logic to add tools
        });
        return agent;
    }
    static async updateAgent(userId, agentId, data) {
        const agent = await Agent_1.Agent.findOneAndUpdate({ _id: new mongoose_1.Types.ObjectId(agentId), ownerId: new mongoose_1.Types.ObjectId(userId) }, { $set: data }, { new: true });
        if (!agent)
            throw new Error("Agent not found");
        return agent;
    }
    static async getAgentBlueprint(userId, agentId) {
        const agent = await Agent_1.Agent.findOne({ _id: new mongoose_1.Types.ObjectId(agentId), ownerId: new mongoose_1.Types.ObjectId(userId) }).lean();
        if (!agent)
            throw new Error("Agent not found");
        return agent; // For now, the agent doc is the blueprint
    }
    static async updateBlueprint(userId, agentId, blueprint) {
        // validation logic would go here
        return this.updateAgent(userId, agentId, blueprint);
    }
    static async listExecutions(userId, filters) {
        const query = {};
        // If agentId is provided, verify ownership first or just rely on query
        if (filters.agentId) {
            query.agentId = new mongoose_1.Types.ObjectId(filters.agentId);
            // implicit ownership check: ensure agent belongs to user?
            // For performance, we might just query executions where agent belongs to user
            // But simpler: get all user agents, then filter executions
            const userAgents = await Agent_1.Agent.find({ ownerId: new mongoose_1.Types.ObjectId(userId) }).select('_id');
            const userAgentIds = userAgents.map(a => a._id);
            if (!userAgentIds.some(id => id.equals(query.agentId))) {
                // If the requested agent isn't owned by user, return empty or error
                // strict check:
                throw new Error("Agent not found or unauthorized");
            }
        }
        else {
            // Get all executions for any agent owned by user
            const userAgents = await Agent_1.Agent.find({ ownerId: new mongoose_1.Types.ObjectId(userId) }).select('_id');
            query.agentId = { $in: userAgents.map(a => a._id) };
        }
        if (filters.status)
            query.status = filters.status;
        return Execution_1.Execution.find(query)
            .sort({ createdAt: -1 })
            .limit(filters.limit || 20)
            .lean();
    }
    static async triggerExecution(userId, agentId, input) {
        const agent = await Agent_1.Agent.findOne({ _id: new mongoose_1.Types.ObjectId(agentId), ownerId: new mongoose_1.Types.ObjectId(userId) });
        if (!agent)
            throw new Error("Agent not found");
        // Dispatch execution
        // This depends on how your execution engine works. 
        // For now, I'll assume a method exists or create a placeholder.
        // In a real scenario, this might push to a queue.
        // return triggerAgentExecution(agent, input);
        // Placeholder:
        const execution = await Execution_1.Execution.create({
            agentId: agent._id,
            status: "queued",
            input,
            logs: []
        });
        return execution;
    }
    static async getExecutionLogs(userId, executionId) {
        // Ensure execution belongs to an agent owned by user
        const execution = await Execution_1.Execution.findById(executionId).populate('agentId');
        if (!execution)
            throw new Error("Execution not found");
        const agent = execution.agentId;
        if (agent.ownerId.toString() !== userId)
            throw new Error("Unauthorized");
        return execution.logs || [];
    }
    static async listIntegrations(userId) {
        return Integration_1.Integration.find({ userId: new mongoose_1.Types.ObjectId(userId) }).lean();
    }
}
exports.GodAgentService = GodAgentService;
