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

        // Generate embedding using Google text-embedding-004
        const { EmbeddingService } = await import("./EmbeddingService");
        const embedding = await EmbeddingService.embed(params.content);

        // Save to MongoDB
        const memory = await MemoryItem.findOneAndUpdate(
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

        // Also upsert to Pinecone axle-memory index
        try {
            await EmbeddingService.upsert({
                indexName: "axle-memory",
                id: `memory:${params.agentId}:${Date.now()}`,
                text: params.content,
                metadata: {
                    agentId: params.agentId,
                    key: params.key,
                    category: params.category,
                    importance: params.importance || "medium",
                    timestamp: Date.now(),
                },
            });
        } catch (error) {
            // Log but don't fail if Pinecone upsert fails
            console.error("Failed to upsert memory to Pinecone:", error);
        }

        return memory;
    }

    /**
     * Find memories relevant to a query using semantic search via Pinecone
     */
    static async findRelevantMemories(params: {
        agentId: string;
        query: string;
        limit?: number;
    }): Promise<Array<{ key: string; content: string; category: string; lastAccessedAt: Date }>> {
        const limit = params.limit || 5;

        try {
            // Use Pinecone semantic search
            const { EmbeddingService } = await import("./EmbeddingService");
            
            const results = await EmbeddingService.query({
                indexName: "axle-memory",
                queryText: params.query,
                filter: { agentId: params.agentId },
                topK: limit,
            });

            // Return the text from metadata
            return results.map(r => ({
                key: (r.metadata.key as string) || "",
                content: r.text,
                category: (r.metadata.category as string) || "general_fact",
                lastAccessedAt: new Date(r.metadata.timestamp as number || Date.now()),
            }));
        } catch (error) {
            console.error("Pinecone query failed, falling back to MongoDB:", error);
            
            // Fallback to MongoDB text search if Pinecone fails
            const agentObjectId = new Types.ObjectId(params.agentId);
            const keywords = params.query
                .toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 2);

            const queryConditions: any = { agentId: agentObjectId };

            if (keywords.length > 0) {
                queryConditions.$or = [
                    ...keywords.map(keyword => ({
                        content: { $regex: keyword, $options: "i" },
                    })),
                    ...keywords.map(keyword => ({
                        key: { $regex: keyword, $options: "i" },
                    })),
                ];
            }

            const memories = await MemoryItem.find(queryConditions)
                .sort({ importance: -1, lastAccessedAt: -1 })
                .limit(limit)
                .lean();

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
    }
}
