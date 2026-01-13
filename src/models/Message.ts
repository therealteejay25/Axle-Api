import { Schema, model, Document, Types } from "mongoose";

export type MessageRole = "user" | "assistant" | "system";

export interface IMessage extends Document {
    agentId: Types.ObjectId;
    role: MessageRole;
    content: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
    {
        agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true, index: true },
        role: { type: String, enum: ["user", "assistant", "system"], required: true },
        content: { type: String, required: true },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

MessageSchema.index({ agentId: 1, createdAt: -1 });

export const Message = model<IMessage>("Message", MessageSchema);
