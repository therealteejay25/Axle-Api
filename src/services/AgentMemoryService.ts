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
     * Store a memory with semantic embedding for future retrieval
     */
    static async storeMemory(params: {
        agentId: string;
        key: string;
        content: string;
        category: "user_preference" | "workflow_pattern" | "project_detail" | "general_fact";
        importance?: "low" | "medium" | "high";
    }) {
        const agentObjectId = new Types.ObjectId(params.agentId);

        // For now, we'll use text-based similarity (no embeddings yet)
        // TODO: Add embedding generation using Gemini or other service
        const embedding: number[] | undefined = undefined;

        return MemoryItem.findOneAndUpdate(
            {
                agentId: agentObjectId,
                key: params.key,
            },
            {
                agentId: agentObjectId,
                key: params.key,
                content: params.content,
                category: params.category,
                importance: params.importance || "medium",
                embedding,
                lastAccessedAt: new Date(),
            },
            { upsert: true, new: true }
        ).lean();
    }

    /**
     * Find memories relevant to a query using semantic search
     * For now, uses text-based keyword matching
     * TODO: Enhance with actual vector similarity search when embeddings are available
     */
    static async findRelevantMemories(params: {
        agentId: string;
        query: string;
        limit?: number;
    }): Promise<Array<{ key: string; content: string; category: string; lastAccessedAt: Date }>> {
        const agentObjectId = new Types.ObjectId(params.agentId);
        const limit = params.limit || 5;

        // Simple text-based search for now (keyword matching)
        // Split query into keywords
        const keywords = params.query
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2); // Filter out very short words

        // Build a text search query
        const queryConditions: any = { agentId: agentObjectId };

        if (keywords.length > 0) {
            // Use MongoDB text search on content
            queryConditions.$or = [
                ...keywords.map(keyword => ({
                    content: { $regex: keyword, $options: "i" },
                })),
                ...keywords.map(keyword => ({
                    key: { $regex: keyword, $options: "i" },
                })),
            ];
        }

        // Find memories matching the query, sorted by importance and recency
        const memories = await MemoryItem.find(queryConditions)
            .sort({ importance: -1, lastAccessedAt: -1 })
            .limit(limit)
            .lean();

        // Update lastAccessedAt for retrieved memories
        if (memories.length > 0) {
            const ids = memories.map(m => m._id);
            await MemoryItem.updateMany(
                { _id: { $in: ids } },
                { lastAccessedAt: new Date() }
            );
        }

        return memories.map(m => ({
            key: m.key,
            content: m.content,
            category: m.category,
            lastAccessedAt: m.lastAccessedAt || m.createdAt,
        }));
    }

    /**
     * Simple text similarity score (0-1)
     * TODO: Replace with cosine similarity when embeddings are available
     */
    private static calculateTextSimilarity(query: string, text: string): number {
        const queryLower = query.toLowerCase();
        const textLower = text.toLowerCase();

        // Simple word overlap score
        const queryWords = new Set(queryLower.split(/\s+/).filter(w => w.length > 2));
        const textWords = new Set(textLower.split(/\s+/).filter(w => w.length > 2));

        if (queryWords.size === 0) return 0;

        const intersection = new Set([...queryWords].filter(w => textWords.has(w)));
        return intersection.size / queryWords.size;
    }
}
