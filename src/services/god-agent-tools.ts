import { z } from "zod";
import { FunctionTool } from "@google/adk";
import { GodAgentService } from "./GodAgentService";

/**
 * Tool definitions for the God Agent.
 * These tools utilize the GodAgentService to interact with the Axle platform.
 */

// --- Agent Management Tools ---

export const listAgentsTool = new FunctionTool({
  name: "list_agents",
  description: "List all agents owned by the user with optional status filter.",
  parameters: z.object({
    status: z.enum(["active", "paused", "draft"]).optional().describe("Filter agents by status"),
    limit: z.number().optional().default(10).describe("Maximum number of agents to return"),
  }) as any,
  execute: async ({ status, limit }, context) => {
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.listAgents(userId, { status, limit });
  },
});

export const createAgentTool = new FunctionTool({
  name: "create_agent",
  description: "Create a new agent with a name, description, and instructions.",
  parameters: z.object({
    name: z.string().describe("Name of the agent"),
    description: z.string().describe("Brief description of what the agent does"),
    instructions: z.string().describe("Detailed instructions for the agent's behavior"),
    schedule: z.string().optional().describe("Cron expression for scheduled execution"),
  }) as any,
  execute: async (params, context) => {
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.createAgent(userId, params);
  },
});

export const updateAgentTool = new FunctionTool({
  name: "update_agent",
  description: "Update an existing agent's configuration.",
  parameters: z.object({
    agentId: z.string().describe("ID of the agent to update"),
    name: z.string().optional(),
    description: z.string().optional(),
    instructions: z.string().optional(),
    status: z.enum(["active", "paused", "draft"]).optional(),
    schedule: z.string().optional(),
  }) as any,
  execute: async (params, context) => {
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.updateAgent(userId, params.agentId, params);
  },
});

export const deleteAgentTool = new FunctionTool({
  name: "delete_agent",
  description: "Delete an agent. STRICTLY ASK FOR CONFIRMATION FIRST.",
  parameters: z.object({
    agentId: z.string().describe("ID of the agent to delete"),
    confirmed: z.boolean().describe("Must be true to proceed with deletion"),
  }) as any,
  execute: async ({ agentId, confirmed }, context) => {
    if (!confirmed) return { error: "Confirmation required for deletion." };
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.manageAgent(userId, agentId, "delete");
  },
});

export const requestAgentConfirmationTool = new FunctionTool({
  name: "request_agent_confirmation",
  description: "Request explicit user confirmation for a sensitive action.",
  parameters: z.object({
    message: z.string().describe("The message to explain why confirmation is needed and what will happen"),
    action: z.string().describe("The action identifier being confirmed"),
    context: z.object({}).catchall(z.any()).describe("Context data for the action")
  }) as any,
  execute: async (params, context) => {
    // This tool doesn't do anything on the backend structurally other than return a signal
    // that the UI can use (or specific logic) to show a confirmation dialog.
    // For the God Agent flow, it might just be part of the chat turn.
    return { status: "awaiting_confirmation", ...params };
  }
});


// --- Blueprint Tools ---

export const getBlueprintTool = new FunctionTool({
  name: "get_blueprint",
  description: "Get the blueprint (configuration) of a specific agent.",
  parameters: z.object({
    agentId: z.string().describe("ID of the agent"),
  }) as any,
  execute: async ({ agentId }, context) => {
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.getAgentBlueprint(userId, agentId);
  },
});

export const updateBlueprintTool = new FunctionTool({
  name: "update_blueprint",
  description: "Update the raw blueprint of an agent.",
  parameters: z.object({
    agentId: z.string().describe("ID of the agent"),
    blueprint: z.object({}).catchall(z.any()).describe("New blueprint object"),
  }) as any,
  execute: async ({ agentId, blueprint }, context) => {
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.updateBlueprint(userId, agentId, blueprint);
  },
});

// --- Execution Tools ---

export const listExecutionsTool = new FunctionTool({
  name: "list_executions",
  description: "List recent agent executions.",
  parameters: z.object({
    agentId: z.string().optional().describe("Filter by agent ID"),
    status: z.enum(["running", "success", "failed", "pending"]).optional(),
    limit: z.number().optional().default(10),
  }) as any,
  execute: async (params, context) => {
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.listExecutions(userId, params);
  },
});

export const startExecutionTool = new FunctionTool({
  name: "start_execution",
  description: "Manually trigger an agent execution.",
  parameters: z.object({
    agentId: z.string().describe("ID of the agent to run"),
    input: z.object({}).catchall(z.any()).optional().describe("Input parameters for the execution"),
  }) as any,
  execute: async ({ agentId, input }, context) => {
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.triggerExecution(userId, agentId, input);
  },
});

export const getExecutionLogsTool = new FunctionTool({
  name: "get_execution_logs",
  description: "Get logs for a specific execution.",
  parameters: z.object({
    executionId: z.string().describe("ID of the execution"),
  }) as any,
  execute: async ({ executionId }, context) => {
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.getExecutionLogs(userId, executionId);
  },
});

// --- Integration Tools ---

export const listIntegrationsTool = new FunctionTool({
  name: "list_integrations",
  description: "List all connected integrations and their status.",
  parameters: z.object({}) as any,
  execute: async (_, context) => {
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.listIntegrations(userId);
  },
});

// --- Analytics Tools ---

export const getAnalyticsTool = new FunctionTool({
  name: "get_analytics",
  description: "Get summary analytics for the user's account.",
  parameters: z.object({}) as any,
  execute: async (_, context) => {
    const userId = (context as any)?.userId;
    if (!userId) throw new Error("Missing userId in tool context");
    return GodAgentService.getDataSummary(userId);
  },
});

export const getAllGodAgentTools = () => [
  listAgentsTool,
  createAgentTool,
  updateAgentTool,
  deleteAgentTool,
  getBlueprintTool,
  updateBlueprintTool,
  listExecutionsTool,
  startExecutionTool,
  getExecutionLogsTool,
  listIntegrationsTool,
  getAnalyticsTool,
  requestAgentConfirmationTool
];
