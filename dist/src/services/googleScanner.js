"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanGoogleContext = void 0;
const Integration_1 = require("../models/Integration");
const crypto_1 = require("./crypto");
const nlFormatter_1 = require("./nlFormatter");
const scanGoogleContext = async (userId) => {
    try {
        // 1. Get Google Integration
        const integration = await Integration_1.Integration.findOne({ userId, provider: 'google', status: 'connected' });
        if (!integration) {
            return "No connected Google account found.";
        }
        // 2. Decrypt Credentials
        const decryptedToken = (0, crypto_1.decryptToken)(integration.accessToken);
        const integrationData = {
            provider: 'google',
            accessToken: decryptedToken,
            scopes: integration.scopes,
            metadata: integration.metadata
        };
        // 3. No adapter calls - adapters removed
        const [emails, events, files] = [{ messages: [] }, { items: [] }, { files: [] }];
        // 4. Format Data for AI
        // We need to extract meaningful bits (Snippet, Subject, Summary, Time)
        // Gmail
        const emailContext = (emails.messages || []).map((m) => `- EMAIL [${m.snippet ? m.snippet.substring(0, 50) + "..." : "No snippet"}]`).join("\n");
        // Calendar
        const eventContext = (events.items || []).map((e) => `- EVENT [${e.summary || "No Title"}] at ${new Date(e.start.dateTime || e.start.date).toLocaleString()}`).join("\n");
        // Drive
        const fileContext = (files.files || []).map((f) => `- FILE [${f.name}] modified ${(0, nlFormatter_1.humanizeTime)(f.modifiedTime || new Date())}`).join("\n");
        return `
            GOOGLE CONTEXT:
            
            UNREAD EMAILS (Primary):
            ${emailContext || "No unread emails"}

            UPCOMING EVENTS:
            ${eventContext || "No upcoming events"}

            RECENT FILES:
            ${fileContext || "No recently modified files"}
        `;
    }
    catch (error) {
        console.error("Google Scan Failed:", error);
        return `Error scanning Google context: ${error.message}`;
    }
};
exports.scanGoogleContext = scanGoogleContext;
