import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { Types } from "mongoose";
import { Agent } from "../models/Agent";
import { Execution } from "../models/Execution";
import { Integration } from "../models/Integration";
import { Thread } from "../models/Thread";
import { ContextManagerService } from "../services/ContextManagerService";

export const createCreateThreadTool = (userId: string) =>
  new FunctionTool({
    name: "create_thread",
    description: "Create a new thread for an agent (or standalone) and return the created thread.",
    parameters: z
      .object({
        agentId: z.string().optional().describe("Optional agent ID to associate with the thread"),
        title: z.string().optional().describe("Thread title"),
        metadata: z
          .object({})
          .catchall(z.any())
          .optional()
          .describe("Optional thread metadata"),
      })
      .strict() as any,
    execute: async ({ agentId, title, metadata }: any) => {
      const thread = await ContextManagerService.createThread({
        ownerId: userId,
        agentId,
        title,
        metadata,
      });

      return { success: true, data: { thread } };
    },
  });

export const createGetThreadTool = (userId: string) =>
  new FunctionTool({
    name: "thread_get",
    description: "Get a thread by ID.",
    parameters: z.object({ threadId: z.string().min(1) }).strict() as any,
    execute: async ({ threadId }: any) => {
      const thread = await ContextManagerService.getThread({ ownerId: userId, threadId });
      if (!thread) return { success: false, error: "Thread not found" };
      return { success: true, data: { thread } };
    },
  });

export const createListThreadsTool = (userId: string) =>
  new FunctionTool({
    name: "thread_list",
    description: "List recent threads for the current user, optionally filtered by agentId.",
    parameters: z
      .object({
        agentId: z.string().optional(),
        limit: z.number().min(1).max(100).optional().default(25),
      })
      .strict() as any,
    execute: async ({ agentId, limit }: any) => {
      const query: any = { ownerId: userId };
      if (agentId) query.agentId = agentId;

      const threads = await Thread.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
      return { success: true, data: { threads, total: threads.length } };
    },
  });

export const createUpdateThreadTool = (userId: string) =>
  new FunctionTool({
    name: "thread_update",
    description: "Update thread title and/or merge metadata into thread.metadata.",
    parameters: z
      .object({
        threadId: z.string().min(1),
        title: z.string().optional(),
        metadata: z.object({}).catchall(z.any()).optional(),
      })
      .strict() as any,
    execute: async ({ threadId, title, metadata }: any) => {
      const thread = await Thread.findOne({ _id: threadId, ownerId: userId });
      if (!thread) return { success: false, error: "Thread not found" };

      if (title !== undefined) thread.title = title;
      if (metadata !== undefined) thread.metadata = { ...(thread.metadata || {}), ...metadata };

      await thread.save();
      return { success: true, data: { thread: thread.toObject() } };
    },
  });

export const createSetThreadGithubRepoTool = (userId: string) =>
  new FunctionTool({
    name: "thread_set_github_repo",
    description: "Attach a GitHub repo context to a thread (owner/repo/ref + optional requestedFiles).",
    parameters: z
      .object({
        threadId: z.string().min(1),
        githubRepo: z
          .object({
            owner: z.string().min(1),
            repo: z.string().min(1),
            ref: z.string().optional().default("main"),
          })
          .strict(),
        requestedFiles: z.array(z.string()).optional(),
      })
      .strict() as any,
    execute: async ({ threadId, githubRepo, requestedFiles }: any) => {
      const thread = await ContextManagerService.setThreadGithubRepo({
        ownerId: userId,
        threadId,
        githubRepo,
        requestedFiles,
      });

      return { success: true, data: { thread } };
    },
  });

export const createExecutionListTool = (userId: string) =>
  new FunctionTool({
    name: "execution_list",
    description: "List executions for the user (optionally filter by agentId and status).",
    parameters: z
      .object({
        agentId: z.string().optional(),
        status: z.enum(["pending", "running", "success", "failed"]).optional(),
        limit: z.number().min(1).max(100).optional().default(25),
        offset: z.number().min(0).optional().default(0),
      })
      .strict() as any,
    execute: async ({ agentId, status, limit, offset }: any) => {
      const query: any = {};

      if (agentId) {
        const agent = await Agent.findOne({ _id: agentId, ownerId: userId }).select("_id");
        if (!agent) return { success: false, error: "Agent not found" };
        query.agentId = agentId;
      } else {
        const agents = await Agent.find({ ownerId: userId }).select("_id").lean();
        query.agentId = { $in: agents.map((a: any) => a._id) };
      }

      if (status) query.status = status;

      const [executions, total] = await Promise.all([
        Execution.find(query)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .populate("agentId", "name")
          .select("agentId triggerType status name error creditsUsed startedAt finishedAt createdAt updatedAt")
          .lean(),
        Execution.countDocuments(query),
      ]);

      return { success: true, data: { executions, total, limit, offset } };
    },
  });

export const createExecutionGetTool = (userId: string) =>
  new FunctionTool({
    name: "execution_get",
    description: "Get a single execution by ID (verifies ownership via the execution's agent).",
    parameters: z.object({ executionId: z.string().min(1) }).strict() as any,
    execute: async ({ executionId }: any) => {
      const execution = await Execution.findById(executionId)
        .populate("agentId", "name description ownerId")
        .select("+reasoning +aiPrompt +aiResponse")
        .lean();

      if (!execution) return { success: false, error: "Execution not found" };

      const agent: any = execution.agentId;
      if (!agent?.ownerId || String(agent.ownerId) !== String(userId)) {
        return { success: false, error: "Execution not found" };
      }

      return { success: true, data: { execution } };
    },
  });

export const createExecutionCancelTool = (userId: string) =>
  new FunctionTool({
    name: "execution_cancel",
    description: "Cancel a pending/running execution (best-effort: marks failed with error=Cancelled by user).",
    parameters: z.object({ executionId: z.string().min(1) }).strict() as any,
    execute: async ({ executionId }: any) => {
      const execution = await Execution.findById(executionId);
      if (!execution) return { success: false, error: "Execution not found" };

      const agent = await Agent.findOne({ _id: execution.agentId, ownerId: userId }).select("_id");
      if (!agent) return { success: false, error: "Execution not found" };

      if (execution.status !== "running" && execution.status !== "pending") {
        return { success: false, error: "Can only cancel running or pending executions" };
      }

      execution.status = "failed";
      execution.error = "Cancelled by user";
      await execution.save();

      return { success: true, data: { cancelled: true, status: execution.status } };
    },
  });

export const createExecutionRetryTool = (userId: string) =>
  new FunctionTool({
    name: "execution_retry",
    description: "Retry a failed execution by re-running the stored inputPayload.",
    parameters: z.object({ executionId: z.string().min(1) }).strict() as any,
    execute: async ({ executionId }: any) => {
      const execution = await Execution.findById(executionId);
      if (!execution) return { success: false, error: "Execution not found" };

      const agent = await Agent.findOne({ _id: execution.agentId, ownerId: userId }).select("_id");
      if (!agent) return { success: false, error: "Execution not found" };

      if (execution.status !== "failed") {
        return { success: false, error: "Can only retry failed executions" };
      }

      const { triggerManualRun } = await import("../triggers/manualHandler");
      const result = await triggerManualRun({
        agentId: String(execution.agentId),
        ownerId: userId,
        payload: execution.inputPayload,
      });

      return {
        success: true,
        data: {
          retried: true,
          originalExecutionId: String(execution._id),
          newExecutionId: result.executionId,
        },
      };
    },
  });

export const createAgentGetTool = (userId: string) =>
  new FunctionTool({
    name: "agent_get",
    description: "Get an agent by ID (must be owned by the user).",
    parameters: z.object({ agentId: z.string().min(1) }).strict() as any,
    execute: async ({ agentId }: any) => {
      if (!Types.ObjectId.isValid(agentId)) return { success: false, error: "Invalid agent ID" };
      const agent = await Agent.findOne({ _id: agentId, ownerId: userId }).lean();
      if (!agent) return { success: false, error: "Agent not found" };
      return { success: true, data: { agent } };
    },
  });

export const createAgentUpdateTool = (userId: string) =>
  new FunctionTool({
    name: "agent_update",
    description: "Update an agent's name/description/instructions/status/brain/integrations/actions.",
    parameters: z
      .object({
        agentId: z.string().min(1),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["active", "paused"]).optional(),
        instructions: z.string().optional(),
        brain: z
          .object({
            model: z.string().optional(),
            systemPrompt: z.string().optional(),
            temperature: z.number().min(0).max(2).optional(),
            maxTokens: z.number().min(256).max(8192).optional(),
          })
          .partial()
          .optional(),
        integrations: z.array(z.string()).optional(),
        actions: z.array(z.string()).optional(),
      })
      .strict() as any,
    execute: async ({ agentId, ...updates }: any) => {
      if (!Types.ObjectId.isValid(agentId)) return { success: false, error: "Invalid agent ID" };

      const agent = await Agent.findOne({ _id: agentId, ownerId: userId });
      if (!agent) return { success: false, error: "Agent not found" };

      if (updates.name !== undefined) agent.name = updates.name;
      if (updates.description !== undefined) agent.description = updates.description;
      if (updates.status !== undefined) agent.status = updates.status;
      if (updates.instructions !== undefined) agent.instructions = updates.instructions;
      if (updates.integrations !== undefined) agent.integrations = updates.integrations;
      if (updates.actions !== undefined) agent.actions = updates.actions;

      if (updates.brain) {
        if (updates.brain.model !== undefined) agent.brain.model = updates.brain.model;
        if (updates.brain.systemPrompt !== undefined) agent.brain.systemPrompt = updates.brain.systemPrompt;
        if (updates.brain.temperature !== undefined) agent.brain.temperature = updates.brain.temperature;
        if (updates.brain.maxTokens !== undefined) agent.brain.maxTokens = updates.brain.maxTokens;
      }

      await agent.save();
      return { success: true, data: { agent: agent.toObject() } };
    },
  });

export const createIntegrationsListTool = (userId: string) =>
  new FunctionTool({
    name: "integration_list",
    description: "List integrations for the user.",
    parameters: z.object({}).strict() as any,
    execute: async () => {
      const integrations = await Integration.find({ userId }).select("provider status scopes metadata connectedAt lastUsedAt").lean();
      return { success: true, data: { integrations, total: integrations.length } };
    },
  });

export const createPlatformTools = (userId: string) => [
  createCreateThreadTool(userId),
  createGetThreadTool(userId),
  createListThreadsTool(userId),
  createUpdateThreadTool(userId),
  createSetThreadGithubRepoTool(userId),
  createExecutionListTool(userId),
  createExecutionGetTool(userId),
  createExecutionCancelTool(userId),
  createExecutionRetryTool(userId),
  createAgentGetTool(userId),
  createAgentUpdateTool(userId),
  createIntegrationsListTool(userId),
];
