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
  userId: Types.ObjectId;
  type: TriggerType;
  cron?: string;
  timezone: string;
  customInstruction: string;
  enabled: boolean;
  bullmqJobKey?: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["schedule", "webhook", "manual"],
      required: true
    },
    cron: {
      type: String,
      required: function(this: ITrigger) {
        return this.type === "schedule";
      }
    },
    timezone: {
      type: String,
      default: "UTC"
    },
    customInstruction: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    bullmqJobKey: {
      type: String,
      required: false
    },
    lastRunAt: {
      type: Date,
      required: false
    },
    nextRunAt: {
      type: Date,
      required: false
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
TriggerSchema.index({ agentId: 1 });
TriggerSchema.index({ userId: 1 });
TriggerSchema.index({ agentId: 1, userId: 1 });
TriggerSchema.index({ type: 1, enabled: 1 });

export const Trigger = model<ITrigger>("Trigger", TriggerSchema);
