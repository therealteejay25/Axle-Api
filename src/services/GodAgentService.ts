import { Types } from "mongoose";
import { Agent } from "../models/Agent";
import { Execution } from "../models/Execution";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";
import { executeAction } from "../adapters/registry";
import { Integration } from "../models/Integration";
import { decryptToken } from "./crypto";
import { logger } from "./logger";
import { triggerAgentExecution } from "../worker/executionDispatcher"; // Assuming this exists or similar logic needed


export class GodAgentService {
  /**
   * Executes a tool on behalf of a user with auditing and safety checks.
   */
  static async executeTool(
    userId: string,
    actionType: string,
    params: Record<string, any>
  ): Promise<any> {
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

    const integrations = await Integration.find({
      userId: new Types.ObjectId(userId),
      status: "connected"
    }).lean();

    const integrationMap = new Map(
      integrations.map((i: any) => [
        i.provider,
        {
          provider: i.provider,
          accessToken: decryptToken(i.accessToken),
          refreshToken: i.refreshToken ? decryptToken(i.refreshToken) : undefined,
          scopes: i.scopes || [],
          metadata: i.metadata || {}
        }
      ])
    );

    try {
      logger.info("God Agent executing tool", { userId, actionType });

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
      } else {
        result = await executeAction(actionType, params, integrationMap as any);
      }

      // 4. Audit Log
      await AuditLog.create({
        userId: new Types.ObjectId(userId),
        actionType,
        params,
        result,
        timestamp: new Date()
      });

      return result;
    } catch (error: any) {
      logger.error("God Agent tool execution failed", { actionType, error: error.message });
      
      await AuditLog.create({
        userId: new Types.ObjectId(userId),
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
  static async getDataSummary(userId: string) {
    const ownerObjectId = new Types.ObjectId(userId);
    const agents = await Agent.find({ ownerId: ownerObjectId }).lean();
    const agentIds = agents.map((a: any) => a._id);

    const [recentExecutions, auditLogs, integrations] = await Promise.all([
      Execution.find({ agentId: { $in: agentIds } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      AuditLog.find({ userId: ownerObjectId })
        .sort({ timestamp: -1 })
        .limit(10)
        .lean(),
      Integration.find({ userId: ownerObjectId, status: "connected" })
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
  static async manageAgent(userId: string, agentId: string, action: "pause" | "resume" | "delete") {
    const agent = await Agent.findOne({ _id: new Types.ObjectId(agentId), ownerId: new Types.ObjectId(userId) });
    if (!agent) throw new Error("Agent not found");

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

  static async listAgents(userId: string, filters: { status?: string, limit?: number }) {
    const query: any = { ownerId: new Types.ObjectId(userId) };
    if (filters.status) query.status = filters.status;

    return Agent.find(query)
      .limit(filters.limit || 20)
      .sort({ createdAt: -1 })
      .lean();
  }

  static async createAgent(userId: string, data: any) {
    const agent = await Agent.create({
      ownerId: new Types.ObjectId(userId),
      ...data,
      status: "draft", // Default to draft
      tools: [] // Default empty tools, will need logic to add tools
    });
    return agent;
  }

  static async updateAgent(userId: string, agentId: string, data: any) {
    const agent = await Agent.findOneAndUpdate(
      { _id: new Types.ObjectId(agentId), ownerId: new Types.ObjectId(userId) },
      { $set: data },
      { new: true }
    );
    if (!agent) throw new Error("Agent not found");
    return agent;
  }

  static async getAgentBlueprint(userId: string, agentId: string) {
    const agent = await Agent.findOne({ _id: new Types.ObjectId(agentId), ownerId: new Types.ObjectId(userId) }).lean();
    if (!agent) throw new Error("Agent not found");
    return agent; // For now, the agent doc is the blueprint
  }

  static async updateBlueprint(userId: string, agentId: string, blueprint: any) {
    // validation logic would go here
    return this.updateAgent(userId, agentId, blueprint);
  }

  static async listExecutions(userId: string, filters: { agentId?: string, status?: string, limit?: number }) {
    const query: any = {};
    
    // If agentId is provided, verify ownership first or just rely on query
    if (filters.agentId) {
        query.agentId = new Types.ObjectId(filters.agentId);
        // implicit ownership check: ensure agent belongs to user?
        // For performance, we might just query executions where agent belongs to user
        // But simpler: get all user agents, then filter executions
        const userAgents = await Agent.find({ ownerId: new Types.ObjectId(userId) }).select('_id');
        const userAgentIds = userAgents.map(a => a._id);
        if (!userAgentIds.some(id => id.equals(query.agentId))) {
             // If the requested agent isn't owned by user, return empty or error
             // strict check:
             throw new Error("Agent not found or unauthorized");
        }
    } else {
        // Get all executions for any agent owned by user
        const userAgents = await Agent.find({ ownerId: new Types.ObjectId(userId) }).select('_id');
        query.agentId = { $in: userAgents.map(a => a._id) };
    }

    if (filters.status) query.status = filters.status;

    return Execution.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 20)
      .lean();
  }

  static async triggerExecution(userId: string, agentId: string, input: any) {
     const agent = await Agent.findOne({ _id: new Types.ObjectId(agentId), ownerId: new Types.ObjectId(userId) });
     if (!agent) throw new Error("Agent not found");
     
     // Dispatch execution
     // This depends on how your execution engine works. 
     // For now, I'll assume a method exists or create a placeholder.
     // In a real scenario, this might push to a queue.
     
     // return triggerAgentExecution(agent, input);
     // Placeholder:
     const execution = await Execution.create({
         agentId: agent._id,
         status: "queued",
         input,
         logs: []
     });
     return execution;
  }

  static async getExecutionLogs(userId: string, executionId: string) {
      // Ensure execution belongs to an agent owned by user
      const execution = await Execution.findById(executionId).populate('agentId');
      if (!execution) throw new Error("Execution not found");
      
      const agent = execution.agentId as any;
      if (agent.ownerId.toString() !== userId) throw new Error("Unauthorized");

      return execution.logs || [];
  }

  static async listIntegrations(userId: string) {
      return Integration.find({ userId: new Types.ObjectId(userId) }).lean();
  }
}

