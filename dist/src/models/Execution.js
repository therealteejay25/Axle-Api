"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Execution = void 0;
const mongoose_1 = require("mongoose");
const ExecutionActionSchema = new mongoose_1.Schema({
    type: { type: String, required: true },
    params: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    result: { type: mongoose_1.Schema.Types.Mixed },
    error: { type: String },
    humanReadableStep: { type: String },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    durationMs: { type: Number },
    outputValidation: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null
    },
    toolsCalled: { type: [String], default: [] },
    verified: { type: Boolean }
}, { _id: false });
const ExecutionSchema = new mongoose_1.Schema({
    agentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Agent",
        required: true,
        index: true
    },
    triggerId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    },
    outputPayload: {
        type: mongoose_1.Schema.Types.Mixed
    },
    aiPrompt: { type: String },
    aiResponse: { type: String },
    aiTokensUsed: { type: Number, default: 0 },
    reasoning: { type: String },
    actionsExecuted: {
        type: [ExecutionActionSchema],
        default: []
    },
    events: {
        type: [mongoose_1.Schema.Types.Mixed],
        default: []
    },
    turns: {
        type: [mongoose_1.Schema.Types.Mixed],
        default: []
    },
    memory: {
        type: Map,
        of: mongoose_1.Schema.Types.Mixed,
        default: {}
    },
    error: { type: String },
    errorStack: { type: String },
    retryCount: {
        type: Number,
        default: 0
    },
    thoughtSignature: { type: String },
    state: { type: mongoose_1.Schema.Types.Mixed, default: {} },
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
}, { timestamps: true });
// Indexes for querying execution history
ExecutionSchema.index({ agentId: 1, createdAt: -1 });
ExecutionSchema.index({ agentId: 1, status: 1 });
ExecutionSchema.index({ status: 1, createdAt: -1 });
// TTL index to auto-delete old executions (optional, 90 days)
// ExecutionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
exports.Execution = (0, mongoose_1.model)("Execution", ExecutionSchema);
