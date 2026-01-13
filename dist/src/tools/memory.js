"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preloadMemory = void 0;
const adk_1 = require("@google/adk");
const zod_1 = require("zod");
const Execution_1 = require("../models/Execution");
const preloadMemory = new adk_1.FunctionTool({
    name: "preload_memory",
    description: "Load past execution data and user preferences for context",
    parameters: zod_1.z.object({
        query: zod_1.z.string().optional().describe("What type of memory to load (e.g., 'user_preferences', 'past_executions', 'agent_history')"),
        limit: zod_1.z.number().optional().default(5).describe("Number of past executions to load"),
    }),
    execute: async (input) => {
        const { query, limit = 5 } = input;
        try {
            // Get recent executions for memory
            const recentExecutions = await Execution_1.Execution.find({})
                .sort({ createdAt: -1 })
                .limit(limit || 5)
                .select('name reasoning memory outputPayload createdAt')
                .lean();
            // Format memory data
            const memory = {
                recentExecutions: recentExecutions.map(exec => ({
                    id: exec._id,
                    name: exec.name,
                    reasoning: exec.reasoning,
                    memory: exec.memory,
                    result: exec.outputPayload?.result,
                    createdAt: exec.createdAt
                })),
                userPreferences: {
                    // This could be expanded to load actual user preferences
                    defaultSettings: "Standard execution mode"
                },
                contextType: query || "general"
            };
            return {
                success: true,
                memory,
                loadedItems: recentExecutions.length,
                message: `Loaded ${recentExecutions.length} past executions and user context`
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                memory: {},
                loadedItems: 0,
                message: "Failed to load memory"
            };
        }
    }
});
exports.preloadMemory = preloadMemory;
