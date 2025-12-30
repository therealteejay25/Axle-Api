import { Integration } from "../models/Integration";
import { decryptToken } from "./crypto";
import { listGmailMessages, listCalendarEvents, listDriveFiles } from "../adapters/google";
import { humanizeTime } from "./nlFormatter";

// ============================================
// GOOGLE SCANNER SERVICE
// ============================================
// Scans a user's connected Google account for
// context: emails, calendar, drive files.
// ============================================

interface GoogleContext {
    emails: any[];
    events: any[];
    files: any[];
    summary: string;
}

export const scanGoogleContext = async (userId: string): Promise<string> => {
    try {
        // 1. Get Google Integration
        const integration = await Integration.findOne({ userId, provider: 'google', status: 'connected' });
        if (!integration) {
            return "No connected Google account found.";
        }

        // 2. Decrypt Credentials
        const decryptedToken = decryptToken(integration.accessToken);
        const integrationData = {
            provider: 'google',
            accessToken: decryptedToken,
            scopes: integration.scopes,
            metadata: integration.metadata
        };

        // 3. Parallel Fetch
        // We limit results to keep prompt size manageable but rich
        const [emails, events, files] = await Promise.all([
            listGmailMessages({ query: 'is:unread category:primary', maxResults: 10 }, integrationData).catch(e => ({ messages: []})),
            listCalendarEvents({ timeMin: new Date().toISOString(), maxResults: 10 }, integrationData).catch(e => ({ items: [] })),
            listDriveFiles({ query: "modifiedTime > '" + new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() + "'", pageSize: 5 }, integrationData).catch(e => ({ files: [] }))
        ]);

        // 4. Format Data for AI
        // We need to extract meaningful bits (Snippet, Subject, Summary, Time)
        
        // Gmail
        const emailContext = ((emails as any).messages || []).map((m: any) => 
            `- EMAIL [${m.snippet ? m.snippet.substring(0, 50) + "..." : "No snippet"}]`
        ).join("\n");

        // Calendar
        const eventContext = ((events as any).items || []).map((e: any) => 
            `- EVENT [${e.summary || "No Title"}] at ${new Date(e.start.dateTime || e.start.date).toLocaleString()}`
        ).join("\n");

        // Drive
        const fileContext = ((files as any).files || []).map((f: any) => 
            `- FILE [${f.name}] modified ${humanizeTime(f.modifiedTime || new Date())}`
        ).join("\n");

        return `
            GOOGLE CONTEXT:
            
            UNREAD EMAILS (Primary):
            ${emailContext || "No unread emails"}

            UPCOMING EVENTS:
            ${eventContext || "No upcoming events"}

            RECENT FILES:
            ${fileContext || "No recently modified files"}
        `;

    } catch (error: any) {
        console.error("Google Scan Failed:", error);
        return `Error scanning Google context: ${error.message}`;
    }
};
