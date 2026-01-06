"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
const mongoose_1 = require("mongoose");
const AgentSchema = new mongoose_1.Schema({
    ownerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    // Simple plain-English instructions for user-friendly agent creation
    instructions: {
        type: String,
        trim: true,
        maxlength: 2000
    },
    status: {
        type: String,
        enum: ["active", "paused"],
        default: "active",
        index: true
    },
    brain: {
        model: {
            type: String,
            default: "gemini-1.5-pro-002"
        },
        systemPrompt: {
            type: String,
            required: false // Made optional - can use instructions instead
        },
        temperature: {
            type: Number,
            default: 0.7,
            min: 0,
            max: 2
        },
        maxTokens: {
            type: Number,
            default: 1024,
            min: 1,
            max: 16000
        }
    },
    rules: {
        type: [{
                if: { type: String, required: true },
                then: { type: String, required: true }
            }],
        default: []
    },
    blueprint: {
        originalPrompt: { type: String },
        generatedAt: { type: Date },
        category: { type: String }
    },
    settings: {
        tone: { type: String, default: "professional" },
        maxActionsPerRun: { type: Number, default: 5 },
        approvalRequired: { type: Boolean, default: false }
    },
    // Integration names this agent uses (resolved at execution time)
    integrations: {
        type: [String],
        default: []
    },
    // Allowed action types
    actions: {
        type: [String],
        default: []
    },
    blueprintHistory: [
        {
            rules: { type: mongoose_1.Schema.Types.Mixed },
            settings: { type: mongoose_1.Schema.Types.Mixed },
            updatedAt: { type: Date, default: Date.now }
        }
    ]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
// Virtual to get triggers for this agent
AgentSchema.virtual("triggers", {
    ref: "Trigger",
    localField: "_id",
    foreignField: "agentId"
});
// Indexes for common queries
AgentSchema.index({ ownerId: 1, status: 1 });
AgentSchema.index({ ownerId: 1, createdAt: -1 });
exports.Agent = (0, mongoose_1.model)("Agent", AgentSchema);
