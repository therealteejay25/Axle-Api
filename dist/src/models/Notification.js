"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const mongoose_1 = require("mongoose");
const NotificationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["info", "success", "warning", "error"], default: "info" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    isRead: { type: Boolean, default: false },
    metadata: { type: mongoose_1.Schema.Types.Mixed }
}, { timestamps: { createdAt: true, updatedAt: false } });
NotificationSchema.index({ userId: 1, isRead: 1 });
exports.Notification = (0, mongoose_1.model)("Notification", NotificationSchema);
