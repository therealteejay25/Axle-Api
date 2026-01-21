import { Schema, model, Document, Types } from "mongoose";

/**
 * Individual memory item for semantic search
 * Stores facts, preferences, and patterns with metadata
 */
export interface IMemoryItem extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  key: string; // Unique key for this memory within agent scope
  content: string; // The actual memory content
  category: "user_preference" | "workflow_pattern" | "project_detail" | "general_fact";
  importance: "low" | "medium" | "high";
  embedding?: number[]; // Optional embedding vector for semantic search
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MemoryItemSchema = new Schema<IMemoryItem>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["user_preference", "workflow_pattern", "project_detail", "general_fact"],
      required: true,
      index: true,
    },
    importance: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      index: true,
    },
    embedding: {
      type: [Number],
      default: undefined,
      select: false, // Don't include in default queries (too large)
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
MemoryItemSchema.index({ agentId: 1, key: 1 }, { unique: true });
MemoryItemSchema.index({ agentId: 1, category: 1 });
MemoryItemSchema.index({ agentId: 1, importance: 1 });
MemoryItemSchema.index({ agentId: 1, lastAccessedAt: -1 });

export const MemoryItem = model<IMemoryItem>("MemoryItem", MemoryItemSchema);
