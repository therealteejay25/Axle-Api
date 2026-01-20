import { callAI } from "../worker/aiCaller";
import { User } from "../models/User";
import { Integration } from "../models/Integration";
import { Execution } from "../models/Execution";
import { Types } from "mongoose";
import { randomUUID } from "crypto";
import { scanGoogleContext } from "./googleScanner";
import { env } from "../config/env";

import { NotificationCategory, NotificationPriority, GlobalNotificationActionButton } from './notificationSync';

export interface SmartNotification {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  category: NotificationCategory;
  priority: NotificationPriority;
  timestamp: string;
  action?: string;
  actionUrl?: string;
  sourceApp?: string;
  richContent?: {
    author?: {
      name: string;
      avatar?: string;
      handle?: string;
    };
    threadId?: string;
    threadTitle?: string;
    repository?: {
      owner: string;
      name: string;
      url: string;
    };
    eventDetails?: {
      startTime: string;
      endTime?: string;
      location?: string;
      attendees?: string[];
    };
    attachments?: Array<{
      name: string;
      type: string;
      url: string;
    }>;
    labels?: string[];
    isRead: boolean;
  };
  actionButtons?: GlobalNotificationActionButton[];
}

/**
 * Generates smart notifications using AI based on user's system state
 */
export const generateSmartNotifications = async (userId: string): Promise<SmartNotification[]> => {
  try {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    // 1. Gather Context
    const [integrations, recentFailures, googleContext] = await Promise.all([
      Integration.find({ userId, status: 'connected' }).select('provider metadata lastUsedAt').lean(),
      Execution.find({
        agentId: { $in: await getAgentIds(userId) },
        status: 'failed',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
      }).limit(5).populate('agentId', 'name').lean(),
      scanGoogleContext(userId)
    ]);

    // 2. Prepare Prompt
    const context = {
      connectedApps: integrations.map(i => i.provider),
      failedJobCount: recentFailures.length,
      failedAgentNames: recentFailures.map((f: any) => f.agentId?.name || 'Unknown Agent'),
      googleContext
    };

    const systemPrompt = `
      You are an intelligent OS assistant for 'Axle'.
      Your goal is to generate 7-10 "Smart Notifications" based on the user's REAL context.
      
      CONTEXT:
      ${JSON.stringify(context, null, 2)}
      ${googleContext}

      RULES:
      1. Analyze the Google Context deepy. If there is an event "Meeting with Team at 3pm", warn them if it's 2:50pm. 
      2. If there are unread emails, summarize them into a "Digest" notification.
      3. If there are failed jobs, PRIORITY 1 is to alert about them.
      4. GENERATE 7-10 notifications. Do not be shy. Detailed is better.
      5. "sourceApp" should be accurate (gmail, calendar, drive, axle).
      
      RESPONSE FORMAT:
      Return a JSON object with an "actions" array.
      Each item in "actions" must be an object with:
      - "type": "smart_notification"
      - "params": Object containing:
        - title: Short headline
        - description: One detailed sentence.
        - type: "info" | "warning" | "success" | "alert"
        - sourceApp: "axle" | "gmail" | "calendar" | "drive" | "google_docs"
        - action: Label for the primary button (e.g. "Fix Agent", "Reply", "Join Meeting")
        - actionUrl: URL 
    `;

    // 3. Call AI
    const aiResponse = await callAI(systemPrompt, env.MODEL, 0.7);

    // Debug log
    console.log("DEBUG: AI Raw Response", JSON.stringify(aiResponse, null, 2));

    // 4. Parse AI Response
    let notifications: any[] = [];

    // Handle both 'actions' (new schema) and 'notifications' (fallback/old schema)
    if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
      notifications = aiResponse.actions
        .filter(a => a.type === 'smart_notification')
        .map(a => a.params);
    } else if ((aiResponse as any).notifications) {
      // Fallback if AI returned raw object despite prompt
      notifications = (aiResponse as any).notifications;
    } else {
      // Try parsing raw string if it's a string (though callAI usually parses json)
      try {
        if (typeof aiResponse === 'string') {
          const parsed = JSON.parse(aiResponse);
          if (parsed.notifications) notifications = parsed.notifications;
        }
      } catch (e) { }
    }

    // 5. Format for Frontend
    return notifications.map(n => ({
      id: randomUUID(),
      title: n.title || "Notification",
      description: n.description || "Update available",
      type: (['info', 'warning', 'success', 'alert'].includes(n.type) ? n.type : 'info') as any,
      category: (['messages', 'mentions', 'updates', 'reminders', 'alerts', 'system'].includes(n.category) ? n.category : 'system') as any,
      priority: (['low', 'normal', 'high', 'urgent'].includes(n.priority) ? n.priority : 'normal') as any,
      timestamp: new Date().toISOString(),
      action: n.action,
      actionUrl: n.actionUrl,
      sourceApp: n.sourceApp || 'axle',
      richContent: n.richContent || { isRead: false },
      actionButtons: n.actionButtons || (n.actionUrl ? [{
        label: n.action || "View",
        action: "OPEN_URL" as const,
        url: n.actionUrl,
      }] : []),
    }));

  } catch (error) {
    console.error("Error generating smart notifications:", error);
    // Return graceful fallback
    return [{
      id: randomUUID(),
      title: "Welcome to Axle",
      description: "Your comprehensive automation dashboard is ready.",
      type: "info",
      timestamp: new Date().toISOString(),
      sourceApp: "axle"
    }];
  }
};

// Helper
async function getAgentIds(userId: string) {
  const { Agent } = await import("../models/Agent");
  const agents = await Agent.find({ ownerId: userId }).select('_id');
  return agents.map(a => a._id);
}
