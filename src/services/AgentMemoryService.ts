import { Types } from "mongoose";
import { Message, Memory, MessageRole } from "../models";

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
}
