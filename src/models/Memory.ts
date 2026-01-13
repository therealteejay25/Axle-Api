import { Schema, model, Document, Types } from "mongoose";

export interface IAgentMemory extends Document {
    agentId: Types.ObjectId;
    personaOrFacts: string;
    updatedAt: Date;
    createdAt: Date;
}

const MemorySchema = new Schema<IAgentMemory>(
    {
        agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true, unique: true, index: true },
        personaOrFacts: { type: String, required: true },
    },
    { timestamps: true }
);

export const Memory = model<IAgentMemory>("Memory", MemorySchema);
