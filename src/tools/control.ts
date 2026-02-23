import { FunctionTool } from "@google/adk";
import { z } from "zod";

// ============================================
// CONTROL TOOLS
// ============================================
// Tools that give agents control over execution and memory
// ============================================

/**
 * Task completion tool - lets agent signal when done
 */
export const createCompleteTaskTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "complete_task",
    description: "Call this when you have completely finished the user's task and verified the results. This signals that your work is done.",
    parameters: z.object({
      summary: z.string().describe("A brief summary of what you accomplished"),
      results: z.string().optional().describe("Any important results, IDs, or outputs (as JSON string if needed)"),
    }),
    execute: async (input: unknown) => {
      const { summary, results } = input as { summary: string; results?: string };
      
      // This tool doesn't actually do anything except signal completion
      // The execution loop watches for this tool call
      let parsedResults: any = null;
      if (results) {
        try {
          parsedResults = JSON.parse(results);
        } catch {
          parsedResults = results; // Keep as string if not valid JSON
        }
      }
      
      return {
        success: true,
        message: `Task completed: ${summary}`,
        results: parsedResults || results,
      };
    },
  });
};

/**
 * Memory storage tool - agent decides what to remember
 */
export const createRememberTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "remember",
    description: "Store an important fact, preference, or pattern you've learned about the user or their work. Use this to build long-term knowledge.",
    parameters: z.object({
      key: z.string().describe("A short identifier for this memory (e.g., 'email_signature_preference', 'github_workflow')"),
      content: z.string().describe("The fact or preference to remember"),
      category: z.enum(["user_preference", "workflow_pattern", "project_detail", "general_fact"]).describe("Category of memory"),
    }),
    execute: async (input: unknown) => {
      const { key, content, category } = input as { 
        key: string; 
        content: string; 
        category: "user_preference" | "workflow_pattern" | "project_detail" | "general_fact" 
      };

      const { AgentMemoryService } = await import("../services/AgentMemoryService");
      
      // Store in MongoDB and Pinecone
      await AgentMemoryService.storeMemory({
        agentId,
        key,
        content,
        category,
        importance: "high", // Tool-stored memories are high importance
      });

      return {
        success: true,
        message: `Remembered: ${content}`,
      };
    },
  });
};

/**
 * Memory recall tool - agent searches its own memory
 */
export const createRecallTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "recall",
    description: "Search your memory for relevant information. Use this when you need to check if you've learned something before or find context from past interactions.",
    parameters: z.object({
      query: z.string().describe("What you're trying to remember (e.g., 'email preferences', 'github workflow', 'project deadlines')"),
      limit: z.number().optional().default(5).describe("How many memories to retrieve"),
    }),
    execute: async (input: unknown) => {
      const { query, limit = 5 } = input as { query: string; limit?: number };

      const { AgentMemoryService } = await import("../services/AgentMemoryService");
      
      const memories = await AgentMemoryService.findRelevantMemories({
        agentId,
        query,
        limit,
      });

      if (memories.length === 0) {
        return {
          success: true,
          found: false,
          message: "No relevant memories found for this query",
        };
      }

      return {
        success: true,
        found: true,
        memories: memories.map(m => ({
          key: m.key,
          content: m.content,
          category: m.category,
          lastAccessed: m.lastAccessedAt,
        })),
      };
    },
  });
};

/**
 * Schedule future execution tool
 */
export const createScheduleTaskTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "schedule_task",
    description: "Schedule yourself to run a task at a future time or on a recurring schedule. Useful for automated reports, periodic checks, etc. Use cron expressions (e.g., '0 9 * * 1' for 9am every Monday) or natural language (e.g., 'every Monday at 9am', 'daily at 10am').",
    parameters: z.object({
      task: z.string().describe("What task should be executed when the schedule triggers"),
      schedule: z.string().describe("Cron expression (e.g., '0 9 * * 1' for 9am every Monday) or natural language (e.g., 'every Monday at 9am', 'daily at 10am')"),
      enabled: z.boolean().optional().default(true).describe("Whether this schedule should be active"),
    }),
    execute: async (input: unknown) => {
      const { task, schedule, enabled = true } = input as { 
        task: string; 
        schedule: string; 
        enabled?: boolean 
      };

      const { TriggerService } = await import("../services/TriggerService");
      
      const trigger = await TriggerService.createScheduledTrigger({
        agentId,
        userId,
        schedule,
        task,
        enabled,
      });

      return {
        success: true,
        triggerId: trigger._id.toString(),
        message: `Scheduled task: ${task} (${schedule})`,
        nextRun: trigger.nextRun,
      };
    },
  });
};
