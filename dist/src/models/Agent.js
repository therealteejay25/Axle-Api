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
    status: {
        type: String,
        enum: ["active", "paused"],
        default: "active",
        index: true
    },
    brain: {
        model: {
            type: String,
            default: "gpt-4o"
        },
        systemPrompt: {
            type: String,
            required: true
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
    // Integration names this agent uses (resolved at execution time)
    integrations: {
        type: [String],
        default: []
    },
    // Allowed action types
    actions: {
        type: [String],
        default: []
    }
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
