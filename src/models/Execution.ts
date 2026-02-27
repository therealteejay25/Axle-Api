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
  humanReadableStep?: string; // Human-friendly description of what happened
  startedAt: Date;
  finishedAt?: Date;
  // Extra execution metadata for rich UI + debugging
  durationMs?: number;
  // Validation & safety metadata from capability/output layer
  outputValidation?: {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  } | null;
  toolsCalled?: string[];
  verified?: boolean;
}

export interface IExecution extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  triggerId?: Types.ObjectId;
  triggerType: TriggerType;
  status: ExecutionStatus;
  name?: string; // AI-generated name for this execution
  // Input from the trigger
  inputPayload: Record<string, any>;
  // Attachments
  attachments?: Array<{
    fileId: string;
    url: string;
    mimeType: string;
    filename?: string;
  }>;
  // Final output
  outputPayload?: Record<string, any>;
  // AI interaction logging
  aiPrompt?: string;
  aiResponse?: string;
  aiTokensUsed?: number;
  reasoning?: string; // AI's thought process and decision-making
  // Deep model traces for debugging + UI playback
  traces?: any[];
  // Full-fidelity replay payload from Google ADK (stored for UI replay)
  executionResult?: Record<string, any>;
  // Actions executed
  actionsExecuted: IExecutionAction[];
  // Execution timeline data for UI playback
  events?: any[];
  turns?: any[];
  // Persistent memory across executions
  memory: Map<string, any>;
  // Error tracking
  error?: string;
  errorStack?: string;
  retryCount: number;
  thoughtSignature?: string;
  state?: Record<string, any>;
  // Approval
  approvalStatus?: "pending" | "approved" | "rejected";
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
    humanReadableStep: { type: String },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    durationMs: { type: Number },
    outputValidation: {
      type: Schema.Types.Mixed,
      default: null
    },
    toolsCalled: { type: [String], default: [] },
    verified: { type: Boolean }
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
    name: { type: String, trim: true },
    inputPayload: {
      type: Schema.Types.Mixed,
      default: {}
    },
    attachments: [{
      fileId: { type: String, required: true },
      url: { type: String, required: true },
      mimeType: { type: String, required: true },
      filename: { type: String }
    }],
    outputPayload: {
      type: Schema.Types.Mixed
    },
    aiPrompt: { type: String },
    aiResponse: { type: String },
    aiTokensUsed: { type: Number, default: 0 },
    reasoning: { type: String },
    traces: {
      type: [Schema.Types.Mixed],
      default: []
    },
    executionResult: {
      type: Schema.Types.Mixed,
      select: false,
      default: null
    },
    actionsExecuted: {
      type: [ExecutionActionSchema],
      default: []
    },
    events: {
      type: [Schema.Types.Mixed],
      default: []
    },
    turns: {
      type: [Schema.Types.Mixed],
      default: []
    },
    memory: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {}
    },
    error: { type: String },
    errorStack: { type: String },
    retryCount: {
      type: Number,
      default: 0
    },
    thoughtSignature: { type: String },
    state: { type: Schema.Types.Mixed, default: {} },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      index: true
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
ExecutionSchema.index({ ownerId: 1, createdAt: -1 }); // OPTIMIZATION 8: Added for user queries

// TTL index to auto-delete old executions (optional, 90 days)
// ExecutionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Execution = model<IExecution>("Execution", ExecutionSchema);
