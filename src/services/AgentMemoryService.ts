import { Types } from "mongoose";
import { Message, Memory, MessageRole } from "../models";
import { MemoryItem, IMemoryItem } from "../models/MemoryItem";

export type GeminiPromptMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

export class AgentMemoryService {
    static async getShortTermMessages(agentId: string, limit: number = 10) {
        const agentObjectId = new Types.ObjectId(agentId);

        const docs = await Message.find({ agentId: agentObjectId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return docs.reverse();
    }

    static async appendMessage(params: {
        agentId: string;
        role: MessageRole;
        content: string;
        metadata?: Record<string, any>;
    }) {
        const agentObjectId = new Types.ObjectId(params.agentId);

        return Message.create({
            agentId: agentObjectId,
            role: params.role,
            content: params.content,
            metadata: params.metadata,
        });
    }

    static async getLongTermMemory(agentId: string): Promise<string | null> {
        const agentObjectId = new Types.ObjectId(agentId);
        const doc = await Memory.findOne({ agentId: agentObjectId }).lean();
        return doc?.personaOrFacts ?? null;
    }

    static async upsertLongTermMemory(agentId: string, personaOrFacts: string) {
        const agentObjectId = new Types.ObjectId(agentId);

        return Memory.findOneAndUpdate(
            { agentId: agentObjectId },
            { $set: { personaOrFacts } },
            { upsert: true, new: true }
        ).lean();
    }

    static async buildGeminiSystemContext(params: {
        agentId: string;
        shortTermLimit?: number;
    }): Promise<GeminiPromptMessage[]> {
        const { agentId, shortTermLimit = 10 } = params;

        const [personaOrFacts, lastMessages] = await Promise.all([
            this.getLongTermMemory(agentId),
            this.getShortTermMessages(agentId, shortTermLimit),
        ]);

        const context: GeminiPromptMessage[] = [];

        if (personaOrFacts && personaOrFacts.trim()) {
            context.push({
                role: "system",
                content: `LONG-TERM MEMORY (persona/facts for this agent):\n${personaOrFacts}`,
            });
        }

        for (const m of lastMessages) {
            context.push({
                role: m.role,
                content: m.content,
            });
        }

        return context;
    }

    /**
     * Store a memory with semantic embedding in Pinecone
     */
    static async storeMemory(params: {
        agentId: string;
        key: string;
        content: string;
        category: "user_preference" | "workflow_pattern" | "project_detail" | "general_fact";
        importance?: "low" | "medium" | "high";
    }) {
        const { EmbeddingService } = await import("./EmbeddingService");
        
        // Upsert to Pinecone
        await EmbeddingService.upsert({
            indexName: "axle",
            id: `memory:${params.agentId}:${params.key}`,
            text: params.content,
            metadata: {
                agentId: params.agentId,
                key: params.key,
                category: params.category,
                importance: params.importance || "medium",
                timestamp: Date.now(),
            },
        });

        return {
            agentId: params.agentId,
            key: params.key,
            content: params.content,
            category: params.category,
            importance: params.importance || "medium",
        };
    }

    /**
     * Find memories relevant to a query using Pinecone semantic search
     */
    static async findRelevantMemories(params: {
        agentId: string;
        query: string;
        limit?: number;
    }): Promise<Array<{ key: string; content: string; category: string; lastAccessedAt: Date }>> {
        const limit = params.limit || 5;

        const { EmbeddingService } = await import("./EmbeddingService");
        
        const results = await EmbeddingService.query({
            indexName: "axle",
            queryText: params.query,
            filter: { agentId: params.agentId },
            topK: limit,
        });

        // Return the results from Pinecone
        return results.map(r => ({
            key: (r.metadata.key as string) || "",
            content: r.text,
            category: (r.metadata.category as string) || "general_fact",
            lastAccessedAt: new Date(r.metadata.timestamp as number || Date.now()),
        }));
    }

    /**
     * AUTO-LEARNING PIPELINE
     * Extract learnable information from an execution and store it
     * This runs async at the end of every execution (fire and forget)
     */
    static async extractAndLearn(params: {
        userId: string;
        agentId: string;
        execution: {
            task: string;
            response: string;
            toolsUsed: string[];
            duration: number;
            userFeedback?: string;
        };
    }): Promise<void> {
        try {
            const { userId, agentId, execution } = params;

            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const { env } = await import("../config/env");

            const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

            const systemPrompt = `You are a learning extraction AI. Given an agent execution, extract everything learnable about the user. Be aggressive — extract more rather than less.

Extract these categories:
- preferences: how they like things done, communication style, format preferences
- corrections: anything the agent did wrong that the user fixed or complained about
- people: names, emails, roles mentioned
- projects: work they're doing, deadlines, context
- workflows: recurring patterns or tasks they do repeatedly
- tools: which apps/tools they use for what
- schedule: working hours, timezone, recurring meetings
- rules: hard rules the agent must follow for this user

Output ONLY a JSON array of memory items:
[{
  category: string,
  key: string (snake_case, specific, e.g. 'email_signature', 'prefers_bullet_points'),
  content: string (full detail, don't abbreviate),
  importance: 'low'|'medium'|'high'|'critical',
  type: 'preference'|'correction'|'person'|'project'|'workflow'|'rule'|'fact'
}]

Corrections and rules are always 'critical'. Extract up to 10 items per execution.

If nothing learnable, return empty array [].`;

            const executionSummary = `Task: ${execution.task}
Response: ${execution.response}
Tools Used: ${execution.toolsUsed.join(", ")}
Duration: ${execution.duration}ms
${execution.userFeedback ? `User Feedback: ${execution.userFeedback}` : ""}`;

            const result = await model.generateContent([
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "user", parts: [{ text: executionSummary }] },
            ]);

            const responseText = result.response.text();
            
            // Extract JSON from response (handle markdown code blocks)
            let jsonText = responseText.trim();
            if (jsonText.startsWith("```json")) {
                jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
            } else if (jsonText.startsWith("```")) {
                jsonText = jsonText.replace(/```\n?/g, "");
            }

            const extractedItems = JSON.parse(jsonText);

            if (!Array.isArray(extractedItems) || extractedItems.length === 0) {
                console.log("[AgentMemoryService] No learnable items extracted from execution");
                return;
            }

            // Store each extracted item in Pinecone
            const { EmbeddingService } = await import("./EmbeddingService");

            for (const item of extractedItems) {
                const { category, key, content, importance, type } = item;

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
                        type: type || "memory",
                        timestamp: Date.now(),
                        extractedFrom: "auto_learning",
                    },
                });
            }

            console.log(`[AgentMemoryService] Extracted and stored ${extractedItems.length} learnable items`);
        } catch (error) {
            console.error("[AgentMemoryService] Error in extractAndLearn:", error);
            // Don't throw - this is fire-and-forget
        }
    }
}
