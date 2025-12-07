import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import { logger } from "../lib/logger";

// --- NOTIFICATION TOOLS --- //

export const send_notification = tool({
  name: "send_notification",
  description: "Send a notification to the user (can be extended to push notifications, SMS, etc.)",
  parameters: z.object({
    title: z.string(),
    message: z.string(),
    type: z.enum(["info", "success", "warning", "error"]).default("info"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    channel: z.enum(["in_app", "email", "sms", "push"]).default("in_app"),
  }),
  execute: async ({ title, message, type, priority, channel }, ctx?: RunContext<any>) => {
    const userId = ctx?.context?.userId;
    
    logger.info(`Notification sent to user ${userId}`, {
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

export const create_alert = tool({
  name: "create_alert",
  description: "Create an alert that triggers when conditions are met",
  parameters: z.object({
    name: z.string(),
    condition: z.string(), // e.g., "if unread_emails > 5"
    action: z.string(), // e.g., "send_notification"
    enabled: z.boolean().default(true),
  }),
  execute: async ({ name, condition, action, enabled }, ctx?: RunContext<any>) => {
    const userId = ctx?.context?.userId;
    
    // Store alert in database (would need Alert model)
    logger.info(`Alert created for user ${userId}`, { name, condition, action, enabled });

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

export default {};

