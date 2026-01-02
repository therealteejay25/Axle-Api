import { Schema, model, Document, Types } from "mongoose";

export type ExecutionEventLevel = "debug" | "info" | "warn" | "error";

export interface IExecutionEvent extends Document {
  _id: Types.ObjectId;
  executionId: Types.ObjectId;
  agentId?: Types.ObjectId;
  userId?: Types.ObjectId;
  type: string;
  level: ExecutionEventLevel;
  message?: string;
  data?: Record<string, any>;
  iteration?: number;
  actionType?: string;
  actionIndex?: number;
  timestamp: Date;
}

const ExecutionEventSchema = new Schema<IExecutionEvent>(
  {
    executionId: {
      type: Schema.Types.ObjectId,
      ref: "Execution",
      required: true,
      index: true
    },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    type: { type: String, required: true, index: true },
    level: {
      type: String,
      enum: ["debug", "info", "warn", "error"],
      default: "info",
      index: true
    },
    message: { type: String },
    data: { type: Schema.Types.Mixed },
    iteration: { type: Number },
    actionType: { type: String },
    actionIndex: { type: Number },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { timestamps: false }
);

ExecutionEventSchema.index({ executionId: 1, timestamp: 1 });
ExecutionEventSchema.index({ agentId: 1, timestamp: -1 });
ExecutionEventSchema.index({ userId: 1, timestamp: -1 });

export const ExecutionEvent = model<IExecutionEvent>("ExecutionEvent", ExecutionEventSchema);
