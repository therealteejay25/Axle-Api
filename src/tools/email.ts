import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import { Resend } from "resend";
import { env } from "../config/env";

// --- EMAIL TOOLS --- //

const resend = new Resend(env.RESEND_API_KEY!);

export const send_email = tool({
  name: "send_email",
  description: "Send an email using Resend service",
  parameters: z.object({
    to: z.string().or(z.array(z.string())),
    subject: z.string(),
    body: z.string(),
    html: z.string().nullable().optional(),
    cc: z.string().or(z.array(z.string())).nullable().optional(),
    bcc: z.string().or(z.array(z.string())).nullable().optional(),
    attachments: z.array(z.object({
      filename: z.string(),
      content: z.string(), // base64 encoded
      contentType: z.string().nullable().optional(),
    })).nullable().optional(),
  }),
  execute: async ({ to, subject, body, html, cc, bcc, attachments }, ctx?: RunContext<any>) => {
    try {
      if (!env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY not configured");
      }

      // Try to get user's email from Google integration if 'to' is not provided
      let recipientEmail = to;
      if (!recipientEmail && ctx?.context?.google?.accessToken) {
        try {
          const { getGoogleDetails } = await import("../lib/googleapis");
          const { decrypt } = await import("../lib/crypto");
          const accessToken = decrypt(ctx.context.google.accessToken);
          const googleDetails = await getGoogleDetails(accessToken);
          recipientEmail = googleDetails.email;
        } catch (err) {
          // If we can't get email from Google, continue without it
        }
      }

      if (!recipientEmail) {
        throw new Error("No recipient email address provided. Please specify 'to' parameter or connect Google integration.");
      }

      const toArray = Array.isArray(recipientEmail) ? recipientEmail : [recipientEmail];
      const fromEmail = env.RESEND_FROM_EMAIL || "Axle <onboarding@resend.dev>";

      const emailOptions: any = {
        from: fromEmail,
        to: toArray,
        subject,
        text: body,
      };

      if (html) emailOptions.html = html;
      if (cc) {
        emailOptions.cc = Array.isArray(cc) ? cc : [cc];
      }
      if (bcc) {
        emailOptions.bcc = Array.isArray(bcc) ? bcc : [bcc];
      }
      if (attachments && attachments.length > 0) {
        emailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: Buffer.from(att.content, "base64"),
          contentType: att.contentType,
        }));
      }

      const result = await resend.emails.send(emailOptions);
      
      if (result.error) {
        throw new Error(`Resend API error: ${result.error.message || JSON.stringify(result.error)}`);
      }

      return { success: true, messageId: result.data?.id || "sent" };
    } catch (error: any) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  },
});

export const read_email = tool({
  name: "read_email",
  description: "Read emails from inbox (requires IMAP configuration)",
  parameters: z.object({
    limit: z.number().default(10),
    unread_only: z.boolean().default(false),
    search_query: z.string().nullable().optional(),
  }),
  execute: async ({ limit, unread_only, search_query }, ctx?: RunContext<any>) => {
    // Simulated - implement with IMAP library (node-imap, imap-simple)
    return {
      emails: Array.from({ length: limit }).map((_, i) => ({
        id: `email_${i}`,
        from: `sender${i}@example.com`,
        subject: `Email Subject ${i + 1}`,
        date: new Date().toISOString(),
        unread: i % 2 === 0,
      })),
    };
  },
});

export const search_emails = tool({
  name: "search_emails",
  description: "Search emails by query",
  parameters: z.object({
    query: z.string(),
    limit: z.number().default(20),
  }),
  execute: async ({ query, limit }, ctx?: RunContext<any>) => {
    // Simulated - implement with IMAP search
    return {
      query,
      results: Array.from({ length: limit }).map((_, i) => ({
        id: `email_${i}`,
        from: `sender${i}@example.com`,
        subject: `Result for "${query}" ${i + 1}`,
        snippet: `Email content snippet matching "${query}"`,
      })),
    };
  },
});

export default {};

