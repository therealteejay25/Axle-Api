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
  user: Types.ObjectId;
  agent: Types.ObjectId;
  type: TriggerType;
  name: string;
  active: boolean;
  cronExpression?: string;
  webhookToken?: string;
  webhookSecret?: string;
  lastFiredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TriggerSchema = new Schema<ITrigger>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    agent: {
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
    name: {
      type: String,
      required: true
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    cronExpression: {
      type: String,
      required: false
    },
    webhookToken: {
      type: String,
      unique: true,
      sparse: true
    },
    webhookSecret: {
      type: String,
      required: false
    },
    lastFiredAt: {
      type: Date,
      required: false
    }
  },
  { timestamps: true }
);

// Compound index for finding active triggers
TriggerSchema.index({ user: 1, agent: 1 });
TriggerSchema.index({ type: 1, active: 1 });
TriggerSchema.index({ webhookToken: 1 }, { unique: true, sparse: true });

export const Trigger = model<ITrigger>("Trigger", TriggerSchema);
