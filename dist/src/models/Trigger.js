"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Trigger = void 0;
const mongoose_1 = require("mongoose");
const TriggerSchema = new mongoose_1.Schema({
    agentId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, { timestamps: true });
// Compound index for finding active triggers
TriggerSchema.index({ agentId: 1, enabled: 1 });
TriggerSchema.index({ type: 1, enabled: 1 });
// Unique webhook paths
TriggerSchema.index({ "config.webhookPath": 1 }, { unique: true, sparse: true });
exports.Trigger = (0, mongoose_1.model)("Trigger", TriggerSchema);
