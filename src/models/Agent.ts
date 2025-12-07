import { model, Schema } from "mongoose";

const AgentSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    systemPrompt: { type: String },
    ownerId: { type: String, required: true },
    // AI model to use for this agent (e.g., "gpt-4o", "gpt-4", etc.)
    model: { type: String, default: "gpt-4o" },
    // list of tool names the micro-agent is allowed to use
    tools: { type: [String], default: [] },
    // optional references to integration ids (e.g., { name: 'github', integrationId: '...' })
    integrations: {
      type: [{ name: String, integrationId: String }],
      default: [],
    },
    // schedule/triggers for automated runs
    schedule: {
      enabled: { type: Boolean, default: false },
      // simple interval in minutes for MVP
      intervalMinutes: { type: Number },
      // optional cron expression for future use
      cron: { type: String },
      // next scheduled run time
      nextRunAt: { type: Date },
    },
    // event-based triggers (webhooks, integration events)
    triggers: {
      type: [
        {
          type: {
            type: String,
            enum: ["webhook", "integration_event", "time", "manual"],
            required: true,
          },
          // For webhook triggers: the webhook path/identifier
          webhookPath: { type: String },
          // For integration events: e.g., "github.issue.created", "slack.message.posted"
          eventPattern: { type: String },
          // Conditions/filters for when to trigger (optional)
          conditions: { type: Schema.Types.Mixed },
          enabled: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    // Chatbot/conversation settings
    chatbot: {
      enabled: { type: Boolean, default: false },
      // Conversation history stored per user/thread
      conversations: {
        type: [
          {
            threadId: { type: String, required: true },
            messages: [
              {
                role: { type: String, enum: ["user", "assistant"], required: true },
                content: { type: String, required: true },
                timestamp: { type: Date, default: Date.now },
              },
            ],
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
          },
        ],
        default: [],
      },
    },

    // last run metadata and logs
    lastRunAt: { type: Date },
    logs: {
      type: [{ message: String, createdAt: { type: Date, default: Date.now } }],
      default: [],
    },
  },
  { timestamps: true }
);

export const Agent = model("Agent", AgentSchema);
