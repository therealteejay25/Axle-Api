"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create_alert = exports.send_notification = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const logger_1 = require("../lib/logger");
// --- NOTIFICATION TOOLS --- //
exports.send_notification = (0, agents_1.tool)({
    name: "send_notification",
    description: "Send a notification to the user (can be extended to push notifications, SMS, etc.)",
    parameters: zod_1.z.object({
        title: zod_1.z.string(),
        message: zod_1.z.string(),
        type: zod_1.z.enum(["info", "success", "warning", "error"]).default("info"),
        priority: zod_1.z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        channel: zod_1.z.enum(["in_app", "email", "sms", "push"]).default("in_app"),
    }),
    execute: async ({ title, message, type, priority, channel }, ctx) => {
        const userId = ctx?.context?.userId;
        logger_1.logger.info(`Notification sent to user ${userId}`, {
            title,
            message,
            type,
            priority,
            channel,
        });
        // In a real implementation, this would:
        // - Store notification in database
        // - Send via WebSocket for in_app
        // - Send email if channel is email
        // - Send SMS if channel is sms
        // - Send push notification if channel is push
        return {
            success: true,
            notificationId: `notif_${Date.now()}`,
            delivered: true,
        };
    },
});
exports.create_alert = (0, agents_1.tool)({
    name: "create_alert",
    description: "Create an alert that triggers when conditions are met",
    parameters: zod_1.z.object({
        name: zod_1.z.string(),
        condition: zod_1.z.string(), // e.g., "if unread_emails > 5"
        action: zod_1.z.string(), // e.g., "send_notification"
        enabled: zod_1.z.boolean().default(true),
    }),
    execute: async ({ name, condition, action, enabled }, ctx) => {
        const userId = ctx?.context?.userId;
        // Store alert in database (would need Alert model)
        logger_1.logger.info(`Alert created for user ${userId}`, { name, condition, action, enabled });
        return {
            success: true,
            alertId: `alert_${Date.now()}`,
            name,
            condition,
            action,
            enabled,
        };
    },
});
exports.default = {};
