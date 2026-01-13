import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { Execution } from "../models/Execution";

// Tool factory function - creates user-specific memory tool
export const createPreloadMemoryTool = (userId: string) =>
  new FunctionTool({
    name: "preload_memory",
    description: "Load past execution data and user preferences for context",
    parameters: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "What type of memory to load (e.g., 'user_preferences', 'past_executions', 'agent_history')"
        ),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe("Number of past executions to load"),
    }),
    execute: async (input: unknown) => {
      const { query, limit = 5 } = input as { query?: string; limit?: number };

      try {
        // Get recent executions for this specific user only
        const recentExecutions = await Execution.find({ ownerId: userId })
          .sort({ createdAt: -1 })
          .limit(limit || 5)
          .select("name reasoning memory outputPayload createdAt")
          .lean();

        // Format memory data
        const memory = {
          recentExecutions: recentExecutions.map((exec) => ({
            id: exec._id,
            name: exec.name,
            reasoning: exec.reasoning,
            memory: exec.memory,
            result: exec.outputPayload?.result,
            createdAt: exec.createdAt,
          })),
          userPreferences: {
            // This could be expanded to load actual user preferences
            defaultSettings: "Standard execution mode",
          },
          contextType: query || "general",
        };

        return {
          success: true,
          memory,
          loadedItems: recentExecutions.length,
          message: `Loaded ${recentExecutions.length} past executions and user context`,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          memory: {},
          loadedItems: 0,
          message: "Failed to load memory",
        };
      }
    },
  });
