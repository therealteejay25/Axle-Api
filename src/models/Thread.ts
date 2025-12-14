import { model, Schema } from "mongoose";

const ThreadSchema = new Schema(
  {
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true },
    userId: { type: String, required: true },
    title: { type: String, default: "New Conversation" },
    messages: [
      {
        messageId: { type: String, required: true, unique: true },
        sender: { type: String, enum: ["user", "agent"], required: true },
        content: { type: String, required: true },
        streaming: { type: Boolean, default: false },
        completed: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    steps: [
      {
        stepId: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String },
        status: {
          type: String,
          enum: ["pending", "in_progress", "completed", "failed"],
          default: "pending",
        },
        requiresApproval: { type: Boolean, default: false },
        approved: { type: Boolean, default: null },
        approvalReason: { type: String },
        createdAt: { type: Date, default: Date.now },
        completedAt: { type: Date },
      },
    ],
    metadata: {
      totalSteps: { type: Number, default: 0 },
      completedSteps: { type: Number, default: 0 },
      currentStep: { type: String },
      status: {
        type: String,
        enum: ["active", "completed", "failed"],
        default: "active",
      },
    },
  },
  { timestamps: true }
);

export const Thread = model("Thread", ThreadSchema);
