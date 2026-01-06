"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSmartNotifications = void 0;
const aiCaller_1 = require("../worker/aiCaller");
const User_1 = require("../models/User");
const Integration_1 = require("../models/Integration");
const Execution_1 = require("../models/Execution");
const crypto_1 = require("crypto");
const googleScanner_1 = require("./googleScanner");
/**
 * Generates smart notifications using AI based on user's system state
 */
const generateSmartNotifications = async (userId) => {
    try {
        const user = await User_1.User.findById(userId).lean();
        if (!user)
            return [];
        // 1. Gather Context
        const [integrations, recentFailures, googleContext] = await Promise.all([
            Integration_1.Integration.find({ userId, status: 'connected' }).select('provider metadata lastUsedAt').lean(),
            Execution_1.Execution.find({
                agentId: { $in: await getAgentIds(userId) },
                status: 'failed',
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
            }).limit(5).populate('agentId', 'name').lean(),
            (0, googleScanner_1.scanGoogleContext)(userId)
        ]);
        // 2. Prepare Prompt
        const context = {
            connectedApps: integrations.map(i => i.provider),
            failedJobCount: recentFailures.length,
            failedAgentNames: recentFailures.map((f) => f.agentId?.name || 'Unknown Agent'),
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
        const aiResponse = await (0, aiCaller_1.callAI)(systemPrompt, "gemini-1.5-pro-002", 0.7);
        // Debug log
        console.log("DEBUG: AI Raw Response", JSON.stringify(aiResponse, null, 2));
        // 4. Parse AI Response
        let notifications = [];
        // Handle both 'actions' (new schema) and 'notifications' (fallback/old schema)
        if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
            notifications = aiResponse.actions
                .filter(a => a.type === 'smart_notification')
                .map(a => a.params);
        }
        else if (aiResponse.notifications) {
            // Fallback if AI returned raw object despite prompt
            notifications = aiResponse.notifications;
        }
        else {
            // Try parsing raw string if it's a string (though callAI usually parses json)
            try {
                if (typeof aiResponse === 'string') {
                    const parsed = JSON.parse(aiResponse);
                    if (parsed.notifications)
                        notifications = parsed.notifications;
                }
            }
            catch (e) { }
        }
        // 5. Format for Frontend
        return notifications.map(n => ({
            id: (0, crypto_1.randomUUID)(),
            title: n.title || "Notification",
            description: n.description || "Update available",
            type: (['info', 'warning', 'success', 'alert'].includes(n.type) ? n.type : 'info'),
            timestamp: new Date().toISOString(),
            action: n.action,
            actionUrl: n.actionUrl,
            sourceApp: n.sourceApp || 'axle'
        }));
    }
    catch (error) {
        console.error("Error generating smart notifications:", error);
        // Return graceful fallback
        return [{
                id: (0, crypto_1.randomUUID)(),
                title: "Welcome to Axle",
                description: "Your comprehensive automation dashboard is ready.",
                type: "info",
                timestamp: new Date().toISOString(),
                sourceApp: "axle"
            }];
    }
};
exports.generateSmartNotifications = generateSmartNotifications;
// Helper
async function getAgentIds(userId) {
    const { Agent } = await Promise.resolve().then(() => __importStar(require("../models/Agent")));
    const agents = await Agent.find({ ownerId: userId }).select('_id');
    return agents.map(a => a._id);
}
