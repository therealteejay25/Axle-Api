import { Types } from "mongoose";
import { Agent } from "../models/Agent";
import { Execution } from "../models/Execution";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";
import { executeAction } from "../adapters/registry";
import { Integration } from "../models/Integration";
import { logger } from "./logger";

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

    // 2. Fetch required integration
    const integrations = await Integration.find({ ownerId: new Types.ObjectId(userId) });
    const integrationMap = new Map(integrations.map(i => [i.provider, i as any]));

    try {
      logger.info("God Agent executing tool", { userId, actionType });

      // 3. Execute action
      const result = await executeAction(actionType, params, integrationMap as any);

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
    const [agents, recentExecutions, auditLogs] = await Promise.all([
      Agent.find({ ownerId: new Types.ObjectId(userId) }).lean(),
      Execution.find({ agentId: { $in: await Agent.find({ ownerId: new Types.ObjectId(userId) }).select("_id") } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      AuditLog.find({ userId: new Types.ObjectId(userId) })
        .sort({ timestamp: -1 })
        .limit(10)
        .lean()
    ]);

    return {
      agents,
      recentExecutions,
      auditLogs
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

    await AuditLog.create({
      userId: new Types.ObjectId(userId),
      actionType: `manage_agent_${action}`,
      params: { agentId },
      timestamp: new Date()
    });

    return { success: true, action, agentId };
  }
}

