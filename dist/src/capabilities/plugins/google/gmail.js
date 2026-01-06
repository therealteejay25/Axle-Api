"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailSendEmailTool = exports.GoogleGmailMarkUnreadTool = exports.GoogleGmailMarkReadTool = exports.GoogleGmailDeleteEmailTool = exports.GoogleGmailArchiveEmailTool = exports.GoogleGmailSendEmailTool = exports.GoogleGmailSearchTool = exports.GoogleGmailGetEmailTool = exports.GoogleGmailListEmailsTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GOOGLE GMAIL TOOLS
// ============================================
class GoogleGmailListEmailsTool extends BaseTool_1.BaseTool {
    name = "google_gmail_list_emails";
    description = "List emails from Gmail with optional query filter.";
    inputSchema = zod_1.z.object({
        query: zod_1.z
            .string()
            .optional()
            .describe('Gmail search query (e.g., "is:unread from:example@gmail.com")'),
        maxResults: zod_1.z
            .number()
            .optional()
            .default(10)
            .describe("Maximum number of emails to return"),
    });
    async runImpl(params, context) {
        const integration = context.integrations.get("google");
        const { googleActions } = require("../../../adapters/google");
        return googleActions.google_gmail_list_emails(params, integration);
    }
}
exports.GoogleGmailListEmailsTool = GoogleGmailListEmailsTool;
class GoogleGmailGetEmailTool extends BaseTool_1.BaseTool {
    name = "google_gmail_get_email";
    description = "Get details of a specific email by message ID.";
    inputSchema = zod_1.z.object({
        messageId: zod_1.z.string().describe("Gmail message ID"),
    });
    async runImpl(params, context) {
        const integration = context.integrations.get("google");
        const { googleActions } = require("../../../adapters/google");
        return googleActions.google_gmail_get_email(params, integration);
    }
}
exports.GoogleGmailGetEmailTool = GoogleGmailGetEmailTool;
class GoogleGmailSearchTool extends BaseTool_1.BaseTool {
    name = "google_gmail_search";
    description = "Search Gmail emails with a query.";
    inputSchema = zod_1.z.object({
        query: zod_1.z.string().describe("Gmail search query"),
        maxResults: zod_1.z.number().optional().default(10).describe("Maximum results"),
    });
    async runImpl(params, context) {
        const integration = context.integrations.get("google");
        const { googleActions } = require("../../../adapters/google");
        return googleActions.google_gmail_search(params, integration);
    }
}
exports.GoogleGmailSearchTool = GoogleGmailSearchTool;
class GoogleGmailSendEmailTool extends BaseTool_1.BaseTool {
    name = "google_gmail_send_email";
    description = "Send an email via Resend (using Gmail integration).";
    inputSchema = zod_1.z.object({
        to: zod_1.z.string().email().describe("Recipient email address"),
        subject: zod_1.z.string().describe("Email subject"),
        body: zod_1.z.string().describe("Email body (HTML or plain text)"),
        html: zod_1.z
            .boolean()
            .optional()
            .default(false)
            .describe("Whether body is HTML"),
    });
    async runImpl(params, context) {
        const { Resend } = require("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        try {
            const result = await resend.emails.send({
                from: "Your Research Assistant <onboarding@resend.dev>",
                to: params.to,
                subject: params.subject,
                html: params.html ? params.body : `<pre>${params.body}</pre>`,
            });
            return {
                id: result.data?.id,
                message: "Email sent successfully via Resend",
            };
        }
        catch (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }
}
exports.GoogleGmailSendEmailTool = GoogleGmailSendEmailTool;
class GoogleGmailArchiveEmailTool extends BaseTool_1.BaseTool {
    name = "google_gmail_archive_email";
    description = "Archive an email (remove from inbox).";
    inputSchema = zod_1.z.object({
        messageId: zod_1.z.string().describe("Gmail message ID"),
    });
    async runImpl(params, context) {
        const integration = context.integrations.get("google");
        const { googleActions } = require("../../../adapters/google");
        return googleActions.google_gmail_archive_email(params, integration);
    }
}
exports.GoogleGmailArchiveEmailTool = GoogleGmailArchiveEmailTool;
class GoogleGmailDeleteEmailTool extends BaseTool_1.BaseTool {
    name = "google_gmail_delete_email";
    description = "Delete an email permanently.";
    inputSchema = zod_1.z.object({
        messageId: zod_1.z.string().describe("Gmail message ID"),
    });
    async runImpl(params, context) {
        const integration = context.integrations.get("google");
        const { googleActions } = require("../../../adapters/google");
        return googleActions.google_gmail_delete_email(params, integration);
    }
}
exports.GoogleGmailDeleteEmailTool = GoogleGmailDeleteEmailTool;
class GoogleGmailMarkReadTool extends BaseTool_1.BaseTool {
    name = "google_gmail_mark_read";
    description = "Mark an email as read.";
    inputSchema = zod_1.z.object({
        messageId: zod_1.z.string().describe("Gmail message ID"),
    });
    async runImpl(params, context) {
        const integration = context.integrations.get("google");
        const { googleActions } = require("../../../adapters/google");
        return googleActions.google_gmail_mark_read(params, integration);
    }
}
exports.GoogleGmailMarkReadTool = GoogleGmailMarkReadTool;
class GoogleGmailMarkUnreadTool extends BaseTool_1.BaseTool {
    name = "google_gmail_mark_unread";
    description = "Mark an email as unread.";
    inputSchema = zod_1.z.object({
        messageId: zod_1.z.string().describe("Gmail message ID"),
    });
    async runImpl(params, context) {
        const integration = context.integrations.get("google");
        const { googleActions } = require("../../../adapters/google");
        return googleActions.google_gmail_mark_unread(params, integration);
    }
}
exports.GoogleGmailMarkUnreadTool = GoogleGmailMarkUnreadTool;
class EmailSendEmailTool extends BaseTool_1.BaseTool {
    name = "email_send_email";
    description = "Send an email via Resend.";
    inputSchema = zod_1.z.object({
        to: zod_1.z.string().email().describe("Recipient email address"),
        subject: zod_1.z.string().describe("Email subject"),
        body: zod_1.z.string().describe("Email body (HTML or plain text)"),
    });
    async runImpl(params, context) {
        const { Resend } = require("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        try {
            const result = await resend.emails.send({
                from: "Your Research Assistant <onboarding@resend.dev>",
                to: params.to,
                subject: params.subject,
                html: `<pre>${params.body}</pre>`,
            });
            return {
                id: result.data?.id,
                message: "Email sent successfully via Resend",
            };
        }
        catch (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }
}
exports.EmailSendEmailTool = EmailSendEmailTool;
