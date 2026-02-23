import { FunctionTool } from "@google/adk";
import { z } from "zod";

// ============================================
// MEMORY TOOLS
// ============================================
// Comprehensive memory and learning system for persistent agent knowledge
// ============================================

/**
 * CORE MEMORY TOOLS
 */

export const createMemoryRememberTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_remember",
    description: "Store any fact, preference, or context about the user. Use this aggressively to build knowledge over time. The same key will overwrite previous data.",
    parameters: z.object({
      key: z.string().describe("Unique identifier for this memory (snake_case, e.g., 'email_signature', 'prefers_bullet_points')"),
      content: z.string().describe("The full detail of what to remember - be specific and complete"),
      category: z.enum(["user_preference", "correction", "person", "project", "workflow", "rule", "fact", "schedule"]).describe("Category of memory"),
      importance: z.enum(["low", "medium", "high", "critical"]).default("medium").describe("How critical this memory is - corrections and rules should be 'critical'"),
    }),
    execute: async (input: unknown) => {
      const { key, content, category, importance } = input as {
        key: string;
        content: string;
        category: string;
        importance: string;
      };

      const { EmbeddingService } = await import("../services/EmbeddingService");

      await EmbeddingService.upsert({
        indexName: "axle",
        id: `memory:${agentId}:${key}`,
        text: content,
        metadata: {
          userId,
          agentId,
          key,
          category,
          importance,
          timestamp: Date.now(),
          type: "memory",
        },
      });

      return {
        success: true,
        message: `Remembered: ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}`,
        key,
        category,
        importance,
      };
    },
  });
};

export const createMemoryRecallTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_recall",
    description: "Semantic search over stored memories. Returns ranked results with relevance scores. Search broadly - better to return too much than too little.",
    parameters: z.object({
      query: z.string().describe("What you're trying to remember (natural language query)"),
      category: z.string().optional().describe("Filter by category (optional)"),
      limit: z.number().default(10).describe("Maximum number of memories to return"),
    }),
    execute: async (input: unknown) => {
      const { query, category, limit = 10 } = input as {
        query: string;
        category?: string;
        limit?: number;
      };

      const { EmbeddingService } = await import("../services/EmbeddingService");

      const filter: any = { agentId, type: "memory" };
      if (category) {
        filter.category = category;
      }

      const results = await EmbeddingService.query({
        indexName: "axle",
        queryText: query,
        filter,
        topK: limit,
      });

      if (results.length === 0) {
        return {
          success: true,
          found: false,
          message: "No relevant memories found for this query",
        };
      }

      return {
        success: true,
        found: true,
        count: results.length,
        memories: results.map((r) => ({
          key: r.metadata.key,
          content: r.text,
          category: r.metadata.category,
          importance: r.metadata.importance,
          relevanceScore: r.score,
          timestamp: r.metadata.timestamp,
        })),
      };
    },
  });
};

export const createMemoryForgetTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_forget",
    description: "Delete a specific memory by key. Use carefully - this cannot be undone.",
    parameters: z.object({
      key: z.string().describe("The key of the memory to delete"),
    }),
    execute: async (input: unknown) => {
      const { key } = input as { key: string };

      const { Pinecone } = await import("@pinecone-database/pinecone");
      const { env } = await import("../config/env");

      const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
      const index = pinecone.index(env.PINECONE_MEMORY_INDEX).namespace("__default__");

      await index.deleteOne(`memory:${agentId}:${key}`);

      return {
        success: true,
        message: `Deleted memory: ${key}`,
        key,
      };
    },
  });
};

export const createMemoryListTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_list",
    description: "List all memory keys and categories without fetching full content. Good for auditing what you know about the user.",
    parameters: z.object({
      category: z.string().optional().describe("Filter by category (optional)"),
    }),
    execute: async (input: unknown) => {
      const { category } = input as { category?: string };

      const { EmbeddingService } = await import("../services/EmbeddingService");

      const filter: any = { agentId, type: "memory" };
      if (category) {
        filter.category = category;
      }

      // Query with empty string to get all memories
      const results = await EmbeddingService.query({
        indexName: "axle",
        queryText: "",
        filter,
        topK: 100,
      });

      const memories = results.map((r) => ({
        key: r.metadata.key,
        category: r.metadata.category,
        importance: r.metadata.importance,
        timestamp: r.metadata.timestamp,
      }));

      return {
        success: true,
        count: memories.length,
        memories,
      };
    },
  });
};

export const createMemoryUpdateTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_update",
    description: "Update the content or importance of an existing memory by key.",
    parameters: z.object({
      key: z.string().describe("The key of the memory to update"),
      content: z.string().optional().describe("New content (optional)"),
      importance: z.enum(["low", "medium", "high", "critical"]).optional().describe("New importance level (optional)"),
    }),
    execute: async (input: unknown) => {
      const { key, content, importance } = input as {
        key: string;
        content?: string;
        importance?: string;
      };

      // First, fetch the existing memory
      const { EmbeddingService } = await import("../services/EmbeddingService");

      const results = await EmbeddingService.query({
        indexName: "axle",
        queryText: key,
        filter: { agentId, key, type: "memory" },
        topK: 1,
      });

      if (results.length === 0) {
        return {
          success: false,
          message: `Memory with key '${key}' not found`,
        };
      }

      const existing = results[0];
      const newContent = content || existing.text;
      const newImportance = importance || existing.metadata.importance;

      // Upsert with updated data
      await EmbeddingService.upsert({
        indexName: "axle",
        id: `memory:${agentId}:${key}`,
        text: newContent,
        metadata: {
          userId,
          agentId,
          key,
          category: existing.metadata.category,
          importance: newImportance,
          timestamp: Date.now(),
          type: "memory",
        },
      });

      return {
        success: true,
        message: `Updated memory: ${key}`,
        key,
        updated: { content: !!content, importance: !!importance },
      };
    },
  });
};

/**
 * LEARNING TOOLS
 */

export const createMemoryLearnPreferenceTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_learn_preference",
    description: "Store a user preference. Strength 'absolute' means NEVER violate this preference.",
    parameters: z.object({
      preference: z.string().describe("The preference to store (e.g., 'hates reply-all emails', 'always wants bullet points')"),
      context: z.string().describe("Context or reasoning behind this preference"),
      strength: z.enum(["soft", "firm", "absolute"]).describe("How strongly to enforce this preference"),
    }),
    execute: async (input: unknown) => {
      const { preference, context, strength } = input as {
        preference: string;
        context: string;
        strength: string;
      };

      const key = `pref_${preference.toLowerCase().replace(/\s+/g, "_").substring(0, 50)}`;
      const content = `${preference}. Context: ${context}. Strength: ${strength}`;
      const importance = strength === "absolute" ? "critical" : strength === "firm" ? "high" : "medium";

      const { EmbeddingService } = await import("../services/EmbeddingService");

      await EmbeddingService.upsert({
        indexName: "axle",
        id: `memory:${agentId}:${key}`,
        text: content,
        metadata: {
          userId,
          agentId,
          key,
          category: "user_preference",
          importance,
          strength,
          timestamp: Date.now(),
          type: "memory",
        },
      });

      return {
        success: true,
        message: `Learned preference: ${preference} (${strength})`,
        key,
        strength,
      };
    },
  });
};

export const createMemoryLearnWorkflowTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_learn_workflow",
    description: "Store a recurring workflow the user does. Agent uses these to suggest automations proactively.",
    parameters: z.object({
      name: z.string().describe("Name of the workflow"),
      trigger: z.string().describe("What triggers this workflow"),
      steps: z.array(z.string()).describe("Steps in the workflow"),
      frequency: z.enum(["daily", "weekly", "adhoc"]).describe("How often this workflow runs"),
    }),
    execute: async (input: unknown) => {
      const { name, trigger, steps, frequency } = input as {
        name: string;
        trigger: string;
        steps: string[];
        frequency: string;
      };

      const key = `workflow_${name.toLowerCase().replace(/\s+/g, "_")}`;
      const content = `Workflow: ${name}. Trigger: ${trigger}. Steps: ${steps.join(" → ")}. Frequency: ${frequency}`;

      const { EmbeddingService } = await import("../services/EmbeddingService");

      await EmbeddingService.upsert({
        indexName: "axle",
        id: `memory:${agentId}:${key}`,
        text: content,
        metadata: {
          userId,
          agentId,
          key,
          category: "workflow",
          importance: "medium",
          frequency,
          timestamp: Date.now(),
          type: "memory",
        },
      });

      return {
        success: true,
        message: `Learned workflow: ${name}`,
        key,
        frequency,
      };
    },
  });
};

export const createMemoryLearnPersonTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_learn_person",
    description: "Store info about a person the user interacts with.",
    parameters: z.object({
      name: z.string().describe("Person's name"),
      email: z.string().optional().describe("Email address"),
      role: z.string().optional().describe("Their role or title"),
      relationship: z.string().describe("Relationship to user (e.g., 'manager', 'teammate', 'client')"),
      notes: z.string().describe("Important notes about this person"),
      doNotContact: z.boolean().default(false).describe("If true, agent should never contact this person"),
    }),
    execute: async (input: unknown) => {
      const { name, email, role, relationship, notes, doNotContact } = input as {
        name: string;
        email?: string;
        role?: string;
        relationship: string;
        notes: string;
        doNotContact?: boolean;
      };

      const key = `person_${name.toLowerCase().replace(/\s+/g, "_")}`;
      const content = `${name}${email ? ` (${email})` : ""}${role ? ` - ${role}` : ""}. Relationship: ${relationship}. Notes: ${notes}${doNotContact ? ". DO NOT CONTACT." : ""}`;

      const { EmbeddingService } = await import("../services/EmbeddingService");

      await EmbeddingService.upsert({
        indexName: "axle",
        id: `memory:${agentId}:${key}`,
        text: content,
        metadata: {
          userId,
          agentId,
          key,
          category: "person",
          importance: doNotContact ? "critical" : "medium",
          doNotContact: doNotContact || false,
          timestamp: Date.now(),
          type: "memory",
        },
      });

      return {
        success: true,
        message: `Learned about person: ${name}`,
        key,
        doNotContact,
      };
    },
  });
};

export const createMemoryLearnProjectTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_learn_project",
    description: "Store project context.",
    parameters: z.object({
      name: z.string().describe("Project name"),
      description: z.string().describe("Project description"),
      status: z.string().describe("Current status (e.g., 'active', 'planning', 'on-hold')"),
      team: z.array(z.string()).describe("Team members involved"),
      tools: z.array(z.string()).describe("Tools/platforms used for this project"),
      deadline: z.string().optional().describe("Deadline if any"),
    }),
    execute: async (input: unknown) => {
      const { name, description, status, team, tools, deadline } = input as {
        name: string;
        description: string;
        status: string;
        team: string[];
        tools: string[];
        deadline?: string;
      };

      const key = `project_${name.toLowerCase().replace(/\s+/g, "_")}`;
      const content = `Project: ${name}. ${description}. Status: ${status}. Team: ${team.join(", ")}. Tools: ${tools.join(", ")}${deadline ? `. Deadline: ${deadline}` : ""}`;

      const { EmbeddingService } = await import("../services/EmbeddingService");

      await EmbeddingService.upsert({
        indexName: "axle",
        id: `memory:${agentId}:${key}`,
        text: content,
        metadata: {
          userId,
          agentId,
          key,
          category: "project",
          importance: "high",
          status,
          timestamp: Date.now(),
          type: "memory",
        },
      });

      return {
        success: true,
        message: `Learned about project: ${name}`,
        key,
        status,
      };
    },
  });
};

export const createMemoryLearnCorrectionTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_learn_correction",
    description: "Store when the user corrects you. This is HIGHEST PRIORITY memory - you must NEVER repeat a corrected mistake.",
    parameters: z.object({
      originalAction: z.string().describe("What you did wrong"),
      correction: z.string().describe("What the user corrected you to do"),
      rule: z.string().describe("The rule to follow going forward"),
    }),
    execute: async (input: unknown) => {
      const { originalAction, correction, rule } = input as {
        originalAction: string;
        correction: string;
        rule: string;
      };

      const key = `correction_${Date.now()}`;
      const content = `CORRECTION: I did: ${originalAction}. User corrected me: ${correction}. Rule going forward: ${rule}`;

      const { EmbeddingService } = await import("../services/EmbeddingService");

      await EmbeddingService.upsert({
        indexName: "axle",
        id: `memory:${agentId}:${key}`,
        text: content,
        metadata: {
          userId,
          agentId,
          key,
          category: "correction",
          importance: "critical",
          timestamp: Date.now(),
          type: "memory",
        },
      });

      return {
        success: true,
        message: `Learned correction: ${rule}`,
        key,
        importance: "critical",
      };
    },
  });
};

/**
 * SEMANTIC TOOLS
 */

export const createMemorySemanticSearchTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_semantic_search",
    description: "Deep semantic search with optional filters. Use when memory_recall isn't finding enough context.",
    parameters: z.object({
      query: z.string().describe("Search query"),
      categories: z.array(z.string()).optional().describe("Filter by categories"),
      minScore: z.number().default(0.5).describe("Minimum relevance score (0-1)"),
      limit: z.number().default(20).describe("Maximum results"),
    }),
    execute: async (input: unknown) => {
      const { query, categories, minScore = 0.5, limit = 20 } = input as {
        query: string;
        categories?: string[];
        minScore?: number;
        limit?: number;
      };

      const { EmbeddingService } = await import("../services/EmbeddingService");

      const filter: any = { agentId, type: "memory" };
      // Note: Pinecone doesn't support array filters directly, so we'll filter in post-processing

      const results = await EmbeddingService.query({
        indexName: "axle",
        queryText: query,
        filter,
        topK: limit * 2, // Get more to filter
      });

      let filtered = results.filter((r) => r.score >= minScore);

      if (categories && categories.length > 0) {
        filtered = filtered.filter((r) => categories.includes(r.metadata.category as string));
      }

      filtered = filtered.slice(0, limit);

      return {
        success: true,
        count: filtered.length,
        memories: filtered.map((r) => ({
          key: r.metadata.key,
          content: r.text,
          category: r.metadata.category,
          importance: r.metadata.importance,
          relevanceScore: r.score,
          timestamp: r.metadata.timestamp,
        })),
      };
    },
  });
};

export const createMemoryClusterMemoriesTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_cluster_memories",
    description: "Group memories by topic to find patterns. Returns clusters like 'this user has 8 memories about Slack communication style'.",
    parameters: z.object({}),
    execute: async (input: unknown) => {
      const { EmbeddingService } = await import("../services/EmbeddingService");

      // Get all memories
      const results = await EmbeddingService.query({
        indexName: "axle",
        queryText: "",
        filter: { agentId, type: "memory" },
        topK: 100,
      });

      // Group by category
      const clusters: Record<string, any[]> = {};
      results.forEach((r) => {
        const category = r.metadata.category as string;
        if (!clusters[category]) {
          clusters[category] = [];
        }
        clusters[category].push({
          key: r.metadata.key,
          content: r.text.substring(0, 100),
          importance: r.metadata.importance,
        });
      });

      const summary = Object.entries(clusters).map(([category, memories]) => ({
        category,
        count: memories.length,
        samples: memories.slice(0, 3),
      }));

      return {
        success: true,
        totalMemories: results.length,
        clusters: summary,
      };
    },
  });
};

export const createMemorySummarizeUserTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_summarize_user",
    description: "Synthesize ALL memories into a structured user profile. Cache the result, refresh every 24h.",
    parameters: z.object({}),
    execute: async (input: unknown) => {
      const { EmbeddingService } = await import("../services/EmbeddingService");

      // Check if we have a recent summary
      const existingSummary = await EmbeddingService.query({
        indexName: "axle",
        queryText: "user profile summary",
        filter: { agentId, key: "user_profile_summary", type: "memory" },
        topK: 1,
      });

      if (existingSummary.length > 0) {
        const age = Date.now() - (existingSummary[0].metadata.timestamp as number);
        if (age < 24 * 60 * 60 * 1000) {
          // Less than 24 hours old
          return {
            success: true,
            cached: true,
            summary: existingSummary[0].text,
            age: Math.floor(age / 1000 / 60 / 60) + " hours",
          };
        }
      }

      // Get all memories
      const allMemories = await EmbeddingService.query({
        indexName: "axle",
        queryText: "",
        filter: { agentId, type: "memory" },
        topK: 100,
      });

      // Group by category
      const byCategory: Record<string, string[]> = {};
      allMemories.forEach((r) => {
        const category = r.metadata.category as string;
        if (!byCategory[category]) {
          byCategory[category] = [];
        }
        byCategory[category].push(r.text);
      });

      // Use Gemini to synthesize
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const { env } = await import("../config/env");

      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const prompt = `Synthesize these memories into a concise user profile (max 500 words):

${Object.entries(byCategory)
  .map(([cat, mems]) => `${cat.toUpperCase()}:\n${mems.slice(0, 10).join("\n")}`)
  .join("\n\n")}

Create a structured profile covering:
- Communication style
- Work patterns and preferences
- Key people and relationships
- Active projects
- Known corrections/rules
- Tools and workflows
- Schedule and availability

Be specific and actionable.`;

      const result = await model.generateContent(prompt);
      const summary = result.response.text();

      // Store the summary
      await EmbeddingService.upsert({
        indexName: "axle",
        id: `memory:${agentId}:user_profile_summary`,
        text: summary,
        metadata: {
          userId,
          agentId,
          key: "user_profile_summary",
          category: "fact",
          importance: "high",
          timestamp: Date.now(),
          type: "memory",
        },
      });

      return {
        success: true,
        cached: false,
        summary,
        memoriesAnalyzed: allMemories.length,
      };
    },
  });
};

/**
 * CONTEXT TOOLS
 */

export const createMemoryPreloadTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_preload",
    description: "Called at the START of every execution automatically. Fetches user profile + relevant memories + recent corrections + active projects.",
    parameters: z.object({
      currentTask: z.string().describe("The current task/query from the user"),
    }),
    execute: async (input: unknown) => {
      const { currentTask } = input as { currentTask: string };

      const { EmbeddingService } = await import("../services/EmbeddingService");

      // Get user profile summary
      const profileResults = await EmbeddingService.query({
        indexName: "axle",
        queryText: "user profile summary",
        filter: { agentId, key: "user_profile_summary", type: "memory" },
        topK: 1,
      });

      // Get memories relevant to current task
      const relevantMemories = await EmbeddingService.query({
        indexName: "axle",
        queryText: currentTask,
        filter: { agentId, type: "memory" },
        topK: 10,
      });

      // Get all corrections (critical importance)
      const corrections = await EmbeddingService.query({
        indexName: "axle",
        queryText: "",
        filter: { agentId, category: "correction", type: "memory" },
        topK: 20,
      });

      // Get active projects
      const projects = await EmbeddingService.query({
        indexName: "axle",
        queryText: "",
        filter: { agentId, category: "project", type: "memory" },
        topK: 10,
      });

      return {
        success: true,
        context: {
          userProfile: profileResults[0]?.text || "No profile summary yet",
          relevantMemories: relevantMemories.map((r) => ({
            key: r.metadata.key,
            content: r.text,
            category: r.metadata.category,
            importance: r.metadata.importance,
            relevanceScore: r.score,
          })),
          corrections: corrections.map((r) => ({
            content: r.text,
            timestamp: r.metadata.timestamp,
          })),
          activeProjects: projects.map((r) => ({
            key: r.metadata.key,
            content: r.text,
            status: r.metadata.status,
          })),
        },
        loadedItems: relevantMemories.length + corrections.length + projects.length + (profileResults.length > 0 ? 1 : 0),
      };
    },
  });
};

export const createMemoryLogExecutionTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_log_execution",
    description: "Called at the END of every execution automatically. Stores execution summary so the agent learns what worked.",
    parameters: z.object({
      task: z.string().describe("The task that was executed"),
      outcome: z.string().describe("What happened / result"),
      toolsUsed: z.array(z.string()).describe("Tools that were used"),
      duration: z.number().describe("Duration in milliseconds"),
      userFeedback: z.string().optional().describe("User feedback if any"),
    }),
    execute: async (input: unknown) => {
      const { task, outcome, toolsUsed, duration, userFeedback } = input as {
        task: string;
        outcome: string;
        toolsUsed: string[];
        duration: number;
        userFeedback?: string;
      };

      const key = `execution_${Date.now()}`;
      const content = `Task: ${task}. Outcome: ${outcome}. Tools: ${toolsUsed.join(", ")}. Duration: ${duration}ms${userFeedback ? `. Feedback: ${userFeedback}` : ""}`;

      const { EmbeddingService } = await import("../services/EmbeddingService");

      await EmbeddingService.upsert({
        indexName: "axle",
        id: `memory:${agentId}:${key}`,
        text: content,
        metadata: {
          userId,
          agentId,
          key,
          category: "fact",
          importance: "low",
          timestamp: Date.now(),
          type: "execution_log",
        },
      });

      return {
        success: true,
        message: "Execution logged",
        key,
      };
    },
  });
};

export const createMemoryGetCorrectionsTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "memory_get_corrections",
    description: "Fetch all corrections the user has made. Check this before taking any irreversible action.",
    parameters: z.object({}),
    execute: async (input: unknown) => {
      const { EmbeddingService } = await import("../services/EmbeddingService");

      const corrections = await EmbeddingService.query({
        indexName: "axle",
        queryText: "",
        filter: { agentId, category: "correction", type: "memory" },
        topK: 50,
      });

      return {
        success: true,
        count: corrections.length,
        corrections: corrections.map((r) => ({
          content: r.text,
          timestamp: r.metadata.timestamp,
          key: r.metadata.key,
        })),
      };
    },
  });
};

/**
 * Export all memory tool creation functions
 */
export const createMemoryTools = (userId: string, agentId: string) => {
  return [
    // Core memory
    createMemoryRememberTool(userId, agentId),
    createMemoryRecallTool(userId, agentId),
    createMemoryForgetTool(userId, agentId),
    createMemoryListTool(userId, agentId),
    createMemoryUpdateTool(userId, agentId),
    // Learning
    createMemoryLearnPreferenceTool(userId, agentId),
    createMemoryLearnWorkflowTool(userId, agentId),
    createMemoryLearnPersonTool(userId, agentId),
    createMemoryLearnProjectTool(userId, agentId),
    createMemoryLearnCorrectionTool(userId, agentId),
    // Semantic
    createMemorySemanticSearchTool(userId, agentId),
    createMemoryClusterMemoriesTool(userId, agentId),
    createMemorySummarizeUserTool(userId, agentId),
    // Context
    createMemoryPreloadTool(userId, agentId),
    createMemoryLogExecutionTool(userId, agentId),
    createMemoryGetCorrectionsTool(userId, agentId),
  ];
};
