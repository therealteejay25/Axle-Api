"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
const mongoose_1 = require("mongoose");
const AuditLogSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actionType: { type: String, required: true },
    params: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    result: { type: mongoose_1.Schema.Types.Mixed },
    error: { type: String },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: false });
exports.AuditLog = (0, mongoose_1.model)("AuditLog", AuditLogSchema);
