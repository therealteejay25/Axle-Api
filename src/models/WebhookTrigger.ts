import { Schema, model, Document, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// ============================================
// WEBHOOK TRIGGER MODEL
// ============================================
// Webhook triggers for agent execution
// ============================================

export interface IWebhookTrigger extends Document {
  _id: Types.ObjectId;
  webhookId: string; // UUID for public webhook URL
  agentId: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  integrationId: string; // e.g., "github", "slack", "linear"
  eventId: string; // e.g., "github.push", "slack.message.channel"
  secret: string; // HMAC secret for signature validation
  active: boolean;
  lastTriggeredAt?: Date;
  executionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookTriggerSchema = new Schema<IWebhookTrigger>(
  {
    webhookId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    integrationId: {
      type: String,
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    secret: {
      type: String,
      required: true,
      default: () => crypto.randomBytes(32).toString("hex"),
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastTriggeredAt: {
      type: Date,
    },
    executionCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound indexes
WebhookTriggerSchema.index({ agentId: 1, active: 1 });
WebhookTriggerSchema.index({ ownerId: 1, integrationId: 1 });

export const WebhookTrigger = model<IWebhookTrigger>("WebhookTrigger", WebhookTriggerSchema);
