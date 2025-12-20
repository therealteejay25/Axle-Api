import { Schema, model, Document, Types } from "mongoose";

// ============================================
// EXECUTION MODEL
// ============================================
// Every agent run creates an Execution record.
// This is how you:
//   - Debug issues
//   - Bill users
//   - Retry failures
//   - Build trust (full auditability)
// ============================================

export type ExecutionStatus = "pending" | "running" | "success" | "failed";
export type TriggerType = "schedule" | "webhook" | "manual";

export interface IExecutionAction {
  type: string;
  params: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  startedAt: Date;
  finishedAt?: Date;
}

export interface IExecution extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  triggerId?: Types.ObjectId;
  triggerType: TriggerType;
  status: ExecutionStatus;
  // Input from the trigger
  inputPayload: Record<string, any>;
  // Final output
  outputPayload?: Record<string, any>;
  // AI interaction logging
  aiPrompt?: string;
  aiResponse?: string;
  aiTokensUsed?: number;
  // Actions executed
  actionsExecuted: IExecutionAction[];
  // Error tracking
  error?: string;
  errorStack?: string;
  retryCount: number;
  // Billing
  creditsUsed: number;
  // Timing
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExecutionActionSchema = new Schema<IExecutionAction>(
  {
    type: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date }
  },
  { _id: false }
);

const ExecutionSchema = new Schema<IExecution>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true
    },
    triggerId: {
      type: Schema.Types.ObjectId,
      ref: "Trigger"
    },
    triggerType: {
      type: String,
      enum: ["schedule", "webhook", "manual"],
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "running", "success", "failed"],
      default: "pending",
      index: true
    },
    inputPayload: {
      type: Schema.Types.Mixed,
      default: {}
    },
    outputPayload: {
      type: Schema.Types.Mixed
    },
    aiPrompt: { type: String },
    aiResponse: { type: String },
    aiTokensUsed: { type: Number, default: 0 },
    actionsExecuted: {
      type: [ExecutionActionSchema],
      default: []
    },
    error: { type: String },
    errorStack: { type: String },
    retryCount: {
      type: Number,
      default: 0
    },
    creditsUsed: {
      type: Number,
      default: 0
    },
    startedAt: { type: Date },
    finishedAt: { type: Date }
  },
  { timestamps: true }
);

// Indexes for querying execution history
ExecutionSchema.index({ agentId: 1, createdAt: -1 });
ExecutionSchema.index({ agentId: 1, status: 1 });
ExecutionSchema.index({ status: 1, createdAt: -1 });

// TTL index to auto-delete old executions (optional, 90 days)
// ExecutionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Execution = model<IExecution>("Execution", ExecutionSchema);
