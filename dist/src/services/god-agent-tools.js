"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllGodAgentTools = exports.getAnalyticsTool = exports.listIntegrationsTool = exports.getExecutionLogsTool = exports.startExecutionTool = exports.listExecutionsTool = exports.updateBlueprintTool = exports.getBlueprintTool = exports.requestAgentConfirmationTool = exports.deleteAgentTool = exports.updateAgentTool = exports.createAgentTool = exports.listAgentsTool = void 0;
const zod_1 = require("zod");
const adk_1 = require("@google/adk");
const GodAgentService_1 = require("./GodAgentService");
/**
 * Tool definitions for the God Agent.
 * These tools utilize the GodAgentService to interact with the Axle platform.
 */
// --- Agent Management Tools ---
exports.listAgentsTool = new adk_1.FunctionTool({
    name: "list_agents",
    description: "List all agents owned by the user with optional status filter.",
    parameters: zod_1.z.object({
        status: zod_1.z.enum(["active", "paused", "draft"]).optional().describe("Filter agents by status"),
        limit: zod_1.z.number().optional().default(10).describe("Maximum number of agents to return"),
    }),
    execute: async ({ status, limit }, context) => {
        return GodAgentService_1.GodAgentService.listAgents(context.userId, { status, limit });
    },
});
exports.createAgentTool = new adk_1.FunctionTool({
    name: "create_agent",
    description: "Create a new agent with a name, description, and instructions.",
    parameters: zod_1.z.object({
        name: zod_1.z.string().describe("Name of the agent"),
        description: zod_1.z.string().describe("Brief description of what the agent does"),
        instructions: zod_1.z.string().describe("Detailed instructions for the agent's behavior"),
        schedule: zod_1.z.string().optional().describe("Cron expression for scheduled execution"),
    }),
    execute: async (params, context) => {
        return GodAgentService_1.GodAgentService.createAgent(context.userId, params);
    },
});
exports.updateAgentTool = new adk_1.FunctionTool({
    name: "update_agent",
    description: "Update an existing agent's configuration.",
    parameters: zod_1.z.object({
        agentId: zod_1.z.string().describe("ID of the agent to update"),
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        instructions: zod_1.z.string().optional(),
        status: zod_1.z.enum(["active", "paused", "draft"]).optional(),
        schedule: zod_1.z.string().optional(),
    }),
    execute: async (params, context) => {
        return GodAgentService_1.GodAgentService.updateAgent(context.userId, params.agentId, params);
    },
});
exports.deleteAgentTool = new adk_1.FunctionTool({
    name: "delete_agent",
    description: "Delete an agent. STRICTLY ASK FOR CONFIRMATION FIRST.",
    parameters: zod_1.z.object({
        agentId: zod_1.z.string().describe("ID of the agent to delete"),
        confirmed: zod_1.z.boolean().describe("Must be true to proceed with deletion"),
    }),
    execute: async ({ agentId, confirmed }, context) => {
        if (!confirmed)
            return { error: "Confirmation required for deletion." };
        return GodAgentService_1.GodAgentService.manageAgent(context.userId, agentId, "delete");
    },
});
exports.requestAgentConfirmationTool = new adk_1.FunctionTool({
    name: "request_agent_confirmation",
    description: "Request explicit user confirmation for a sensitive action.",
    parameters: zod_1.z.object({
        message: zod_1.z.string().describe("The message to explain why confirmation is needed and what will happen"),
        action: zod_1.z.string().describe("The action identifier being confirmed"),
        context: zod_1.z.record(zod_1.z.any()).describe("Context data for the action")
    }),
    execute: async (params, context) => {
        // This tool doesn't do anything on the backend structurally other than return a signal
        // that the UI can use (or specific logic) to show a confirmation dialog.
        // For the God Agent flow, it might just be part of the chat turn.
        return { status: "awaiting_confirmation", ...params };
    }
});
// --- Blueprint Tools ---
exports.getBlueprintTool = new adk_1.FunctionTool({
    name: "get_blueprint",
    description: "Get the blueprint (configuration) of a specific agent.",
    parameters: zod_1.z.object({
        agentId: zod_1.z.string().describe("ID of the agent"),
    }),
    execute: async ({ agentId }, context) => {
        return GodAgentService_1.GodAgentService.getAgentBlueprint(context.userId, agentId);
    },
});
exports.updateBlueprintTool = new adk_1.FunctionTool({
    name: "update_blueprint",
    description: "Update the raw blueprint of an agent.",
    parameters: zod_1.z.object({
        agentId: zod_1.z.string().describe("ID of the agent"),
        blueprint: zod_1.z.record(zod_1.z.any()).describe("New blueprint object"),
    }),
    execute: async ({ agentId, blueprint }, context) => {
        return GodAgentService_1.GodAgentService.updateBlueprint(context.userId, agentId, blueprint);
    },
});
// --- Execution Tools ---
exports.listExecutionsTool = new adk_1.FunctionTool({
    name: "list_executions",
    description: "List recent agent executions.",
    parameters: zod_1.z.object({
        agentId: zod_1.z.string().optional().describe("Filter by agent ID"),
        status: zod_1.z.enum(["running", "success", "failed", "pending"]).optional(),
        limit: zod_1.z.number().optional().default(10),
    }),
    execute: async (params, context) => {
        return GodAgentService_1.GodAgentService.listExecutions(context.userId, params);
    },
});
exports.startExecutionTool = new adk_1.FunctionTool({
    name: "start_execution",
    description: "Manually trigger an agent execution.",
    parameters: zod_1.z.object({
        agentId: zod_1.z.string().describe("ID of the agent to run"),
        input: zod_1.z.record(zod_1.z.any()).optional().describe("Input parameters for the execution"),
    }),
    execute: async ({ agentId, input }, context) => {
        return GodAgentService_1.GodAgentService.triggerExecution(context.userId, agentId, input);
    },
});
exports.getExecutionLogsTool = new adk_1.FunctionTool({
    name: "get_execution_logs",
    description: "Get logs for a specific execution.",
    parameters: zod_1.z.object({
        executionId: zod_1.z.string().describe("ID of the execution"),
    }),
    execute: async ({ executionId }, context) => {
        return GodAgentService_1.GodAgentService.getExecutionLogs(context.userId, executionId);
    },
});
// --- Integration Tools ---
exports.listIntegrationsTool = new adk_1.FunctionTool({
    name: "list_integrations",
    description: "List all connected integrations and their status.",
    parameters: zod_1.z.object({}),
    execute: async (_, context) => {
        return GodAgentService_1.GodAgentService.listIntegrations(context.userId);
    },
});
// --- Analytics Tools ---
exports.getAnalyticsTool = new adk_1.FunctionTool({
    name: "get_analytics",
    description: "Get summary analytics for the user's account.",
    parameters: zod_1.z.object({}),
    execute: async (_, context) => {
        return GodAgentService_1.GodAgentService.getDataSummary(context.userId);
    },
});
const getAllGodAgentTools = () => [
    exports.listAgentsTool,
    exports.createAgentTool,
    exports.updateAgentTool,
    exports.deleteAgentTool,
    exports.getBlueprintTool,
    exports.updateBlueprintTool,
    exports.listExecutionsTool,
    exports.startExecutionTool,
    exports.getExecutionLogsTool,
    exports.listIntegrationsTool,
    exports.getAnalyticsTool,
    exports.requestAgentConfirmationTool
];
exports.getAllGodAgentTools = getAllGodAgentTools;
