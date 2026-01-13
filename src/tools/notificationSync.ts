import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { syncNotifications } from "../services/notificationSync";

export const createNotificationSyncTool = (userId: string) =>
    new FunctionTool({
        name: "notification_sync",
        description:
            "ONLY use when the user explicitly asks to check notifications, sync notifications, or see their notifications. Do NOT call this automatically. Syncs notifications from Gmail (unread), GitHub (notifications/issues), and Twitter/X (mentions). Returns normalized notifications with direct source URLs.",
        parameters: z.object({
            limit: z.number().min(1).max(50).optional().default(25),
        }),
        execute: async (input: unknown) => {
            const params = z.object({ limit: z.number().min(1).max(50).optional().default(25) }).parse(input);
            const notifications = await syncNotifications(userId);
            // Wrap array in object to fix ADK format issue
            return { notifications: notifications.slice(0, params.limit) };
        },
    });
