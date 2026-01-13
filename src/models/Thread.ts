import { Schema, model, Document, Types } from "mongoose";

export interface IThread extends Document {
    _id: Types.ObjectId;
    ownerId: Types.ObjectId;
    agentId?: Types.ObjectId;
    title?: string;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

const ThreadSchema = new Schema<IThread>(
    {
        ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        agentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
        title: { type: String, trim: true },
        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

ThreadSchema.index({ ownerId: 1, createdAt: -1 });
ThreadSchema.index({ ownerId: 1, agentId: 1, createdAt: -1 });

export const Thread = model<IThread>("Thread", ThreadSchema);