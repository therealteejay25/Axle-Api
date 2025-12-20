import { Schema, model, Document, Types } from "mongoose";

// ============================================
// TRIGGER MODEL
// ============================================
// Triggers define WHEN an agent execution starts.
// Each trigger maps to exactly one backend entry point.
// Triggers EMIT jobs, they do NOT execute agents.
// ============================================

export type TriggerType = "schedule" | "webhook" | "manual";

export interface ITrigger extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  type: TriggerType;
  config: {
    // For schedule type
    cron?: string;
    // For webhook type
    source?: string; // e.g., "github.push", "stripe.payment", "slack.message"
    webhookPath?: string; // unique path for this webhook
  };
  enabled: boolean;
  lastTriggeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TriggerSchema = new Schema<ITrigger>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["schedule", "webhook", "manual"],
      required: true
    },
    config: {
      cron: { type: String },
      source: { type: String },
      webhookPath: { type: String, unique: true, sparse: true }
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true
    },
    lastTriggeredAt: { type: Date }
  },
  { timestamps: true }
);

// Compound index for finding active triggers
TriggerSchema.index({ agentId: 1, enabled: 1 });
TriggerSchema.index({ type: 1, enabled: 1 });

// Unique webhook paths
TriggerSchema.index(
  { "config.webhookPath": 1 }, 
  { unique: true, sparse: true }
);

export const Trigger = model<ITrigger>("Trigger", TriggerSchema);
