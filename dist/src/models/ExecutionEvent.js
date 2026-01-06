"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionEvent = void 0;
const mongoose_1 = require("mongoose");
const ExecutionEventSchema = new mongoose_1.Schema({
    executionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Execution",
        required: true,
        index: true
    },
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Agent", index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", index: true },
    type: { type: String, required: true, index: true },
    level: {
        type: String,
        enum: ["debug", "info", "warn", "error"],
        default: "info",
        index: true
    },
    message: { type: String },
    data: { type: mongoose_1.Schema.Types.Mixed },
    iteration: { type: Number },
    actionType: { type: String },
    actionIndex: { type: Number },
    timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: false });
ExecutionEventSchema.index({ executionId: 1, timestamp: 1 });
ExecutionEventSchema.index({ agentId: 1, timestamp: -1 });
ExecutionEventSchema.index({ userId: 1, timestamp: -1 });
exports.ExecutionEvent = (0, mongoose_1.model)("ExecutionEvent", ExecutionEventSchema);
