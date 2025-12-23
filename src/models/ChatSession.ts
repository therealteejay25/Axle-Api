import { Schema, model, Document, Types } from "mongoose";

export interface IChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IChatSession extends Document {
  userId: Types.ObjectId;
  messages: IChatMessage[];
  context: Record<string, any>;
  lastInteractionAt: Date;
}

const ChatSessionSchema = new Schema<IChatSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messages: [
      {
        role: { type: String, enum: ["user", "assistant", "system"], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: Schema.Types.Mixed }
      }
    ],
    context: { type: Schema.Types.Mixed, default: {} },
    lastInteractionAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const ChatSession = model<IChatSession>("ChatSession", ChatSessionSchema);
