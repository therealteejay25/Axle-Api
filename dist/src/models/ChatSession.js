"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSession = void 0;
const mongoose_1 = require("mongoose");
const ChatSessionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messages: [
        {
            role: { type: String, enum: ["user", "assistant", "system"], required: true },
            content: { type: String, required: true },
            timestamp: { type: Date, default: Date.now },
            metadata: { type: mongoose_1.Schema.Types.Mixed }
        }
    ],
    context: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    lastInteractionAt: { type: Date, default: Date.now }
}, { timestamps: true });
exports.ChatSession = (0, mongoose_1.model)("ChatSession", ChatSessionSchema);
