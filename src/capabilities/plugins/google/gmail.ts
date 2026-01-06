import { BaseTool, ToolContext } from "../../BaseTool";
import { z } from "zod";

// ============================================
// GOOGLE GMAIL TOOLS
// ============================================

export class GoogleGmailListEmailsTool extends BaseTool {
  name = "google_gmail_list_emails";
  description = "List emails from Gmail with optional query filter.";

  inputSchema = z.object({
    query: z
      .string()
      .optional()
      .describe(
        'Gmail search query (e.g., "is:unread from:example@gmail.com")'
      ),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of emails to return"),
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get("google");
    const { googleActions } = require("../../../adapters/google");
    return googleActions.google_gmail_list_emails(params, integration);
  }
}

export class GoogleGmailGetEmailTool extends BaseTool {
  name = "google_gmail_get_email";
  description = "Get details of a specific email by message ID.";

  inputSchema = z.object({
    messageId: z.string().describe("Gmail message ID"),
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get("google");
    const { googleActions } = require("../../../adapters/google");
    return googleActions.google_gmail_get_email(params, integration);
  }
}

export class GoogleGmailSearchTool extends BaseTool {
  name = "google_gmail_search";
  description = "Search Gmail emails with a query.";

  inputSchema = z.object({
    query: z.string().describe("Gmail search query"),
    maxResults: z.number().optional().default(10).describe("Maximum results"),
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get("google");
    const { googleActions } = require("../../../adapters/google");
    return googleActions.google_gmail_search(params, integration);
  }
}

export class GoogleGmailSendEmailTool extends BaseTool {
  name = "google_gmail_send_email";
  description = "Send an email via Resend (using Gmail integration).";

  inputSchema = z.object({
    to: z.string().email().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body (HTML or plain text)"),
    html: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether body is HTML"),
  });

  async runImpl(params: any, context: ToolContext) {
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
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}

export class GoogleGmailArchiveEmailTool extends BaseTool {
  name = "google_gmail_archive_email";
  description = "Archive an email (remove from inbox).";

  inputSchema = z.object({
    messageId: z.string().describe("Gmail message ID"),
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get("google");
    const { googleActions } = require("../../../adapters/google");
    return googleActions.google_gmail_archive_email(params, integration);
  }
}

export class GoogleGmailDeleteEmailTool extends BaseTool {
  name = "google_gmail_delete_email";
  description = "Delete an email permanently.";

  inputSchema = z.object({
    messageId: z.string().describe("Gmail message ID"),
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get("google");
    const { googleActions } = require("../../../adapters/google");
    return googleActions.google_gmail_delete_email(params, integration);
  }
}

export class GoogleGmailMarkReadTool extends BaseTool {
  name = "google_gmail_mark_read";
  description = "Mark an email as read.";

  inputSchema = z.object({
    messageId: z.string().describe("Gmail message ID"),
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get("google");
    const { googleActions } = require("../../../adapters/google");
    return googleActions.google_gmail_mark_read(params, integration);
  }
}

export class GoogleGmailMarkUnreadTool extends BaseTool {
  name = "google_gmail_mark_unread";
  description = "Mark an email as unread.";

  inputSchema = z.object({
    messageId: z.string().describe("Gmail message ID"),
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get("google");
    const { googleActions } = require("../../../adapters/google");
    return googleActions.google_gmail_mark_unread(params, integration);
  }
}

export class EmailSendEmailTool extends BaseTool {
  name = "email_send_email";
  description = "Send an email via Resend.";

  inputSchema = z.object({
    to: z.string().email().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body (HTML or plain text)"),
  });

  async runImpl(params: any, context: ToolContext) {
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
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}
