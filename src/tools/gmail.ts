import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GMAIL TOOL SUITE - COMPREHENSIVE
// ============================================

export class GmailToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // ============================================
  // READING TOOLS
  // ============================================

  // List unread emails
  createListUnreadTool() {
    return this.createTool(
      "gmail_list_unread",
      "List unread emails with optional label filter",
      z.object({
        maxResults: z.number().min(1).max(100).default(20).describe("Maximum number of messages to return"),
        labelIds: z.array(z.string()).optional().describe("Gmail label IDs to filter by"),
        pageToken: z.string().optional().describe("Page token for pagination"),
      }),
      async ({ maxResults, labelIds, pageToken }) => {
        try {
          logger.info(`[GMAIL] Listing unread messages`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.list({
              userId: "me",
              q: "is:unread",
              maxResults,
              labelIds: labelIds?.length ? labelIds : undefined,
              pageToken,
            });
          });

          const messages = result.data.messages || [];
          logger.info(`[GMAIL] Found ${messages.length} unread messages`);

          return {
            success: true,
            data: {
              messages: messages.map((msg) => ({
                id: msg.id,
                threadId: msg.threadId,
              })),
              totalCount: messages.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] List unread failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list unread messages",
          };
        }
      }
    );
  }

  // List emails with full filter support
  createListEmailsTool() {
    return this.createTool(
      "gmail_list_emails",
      "List emails with full filter support (query, maxResults, pageToken)",
      z.object({
        query: z.string().optional().describe("Gmail search query (e.g., 'is:unread', 'from:someone@example.com')"),
        maxResults: z.number().min(1).max(100).default(20).describe("Maximum number of messages to return"),
        pageToken: z.string().optional().describe("Page token for pagination"),
        labelIds: z.array(z.string()).optional().describe("Gmail label IDs to filter by"),
      }),
      async ({ query, maxResults, pageToken, labelIds }) => {
        try {
          logger.info(`[GMAIL] Listing emails with query: ${query || "none"}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.list({
              userId: "me",
              q: query,
              maxResults,
              pageToken,
              labelIds: labelIds?.length ? labelIds : undefined,
            });
          });

          const messages = result.data.messages || [];
          logger.info(`[GMAIL] Found ${messages.length} messages`);

          return {
            success: true,
            data: {
              messages: messages.map((msg) => ({
                id: msg.id,
                threadId: msg.threadId,
              })),
              totalCount: messages.length,
              nextPageToken: result.data.nextPageToken,
              query: query || "all",
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] List emails failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list emails",
          };
        }
      }
    );
  }

  // Get full email by ID
  createGetEmailTool() {
    return this.createTool(
      "gmail_get_email",
      "Get full email by ID including body, attachments list, and headers",
      z.object({
        messageId: z.string().min(1, "Message ID is required"),
        format: z.enum(["full", "metadata", "minimal"]).default("full").describe("Amount of detail to return"),
      }),
      async ({ messageId, format }) => {
        try {
          logger.info(`[GMAIL] Getting email details for ID: ${messageId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.get({
              userId: "me",
              id: messageId,
              format,
            });
          });

          // Extract attachments list
          const attachments: any[] = [];
          const parts = result.data.payload?.parts || [];
          const extractAttachments = (parts: any[]) => {
            parts.forEach((part) => {
              if (part.filename && part.body?.attachmentId) {
                attachments.push({
                  filename: part.filename,
                  mimeType: part.mimeType,
                  attachmentId: part.body.attachmentId,
                  size: part.body.size,
                });
              }
              if (part.parts) {
                extractAttachments(part.parts);
              }
            });
          };
          extractAttachments(parts);

          logger.info(`[GMAIL] Retrieved email with ${attachments.length} attachments`);

          return {
            success: true,
            data: {
              id: result.data.id,
              threadId: result.data.threadId,
              labelIds: result.data.labelIds,
              snippet: result.data.snippet,
              payload: format === "full" ? result.data.payload : undefined,
              sizeEstimate: result.data.sizeEstimate,
              historyId: result.data.historyId,
              internalDate: result.data.internalDate,
              attachments,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Get email failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get email",
          };
        }
      }
    );
  }

  // Search emails with Gmail query syntax
  createSearchEmailsTool() {
    return this.createTool(
      "gmail_search_emails",
      "Search emails using Gmail query syntax (from:, to:, subject:, has:attachment, etc.)",
      z.object({
        query: z.string().min(1, "Search query is required").describe("Gmail search query"),
        maxResults: z.number().min(1).max(100).default(20),
        pageToken: z.string().optional(),
      }),
      async ({ query, maxResults, pageToken }) => {
        try {
          logger.info(`[GMAIL] Searching emails: ${query}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.list({
              userId: "me",
              q: query,
              maxResults,
              pageToken,
            });
          });

          const messages = result.data.messages || [];
          logger.info(`[GMAIL] Found ${messages.length} messages matching query`);

          return {
            success: true,
            data: {
              messages: messages.map((msg) => ({
                id: msg.id,
                threadId: msg.threadId,
              })),
              totalCount: messages.length,
              nextPageToken: result.data.nextPageToken,
              query,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Search emails failed:", error);
          return {
            success: false,
            error: error.message || "Failed to search emails",
          };
        }
      }
    );
  }

  // Get full email thread
  createGetThreadTool() {
    return this.createTool(
      "gmail_get_thread",
      "Get full email thread by threadId",
      z.object({
        threadId: z.string().min(1, "Thread ID is required"),
        format: z.enum(["full", "metadata", "minimal"]).default("metadata"),
      }),
      async ({ threadId, format }) => {
        try {
          logger.info(`[GMAIL] Getting thread: ${threadId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.threads.get({
              userId: "me",
              id: threadId,
              format,
            });
          });

          const messages = result.data.messages || [];
          logger.info(`[GMAIL] Retrieved thread with ${messages.length} messages`);

          return {
            success: true,
            data: {
              id: result.data.id,
              historyId: result.data.historyId,
              messages: messages.map((msg: any) => ({
                id: msg.id,
                threadId: msg.threadId,
                labelIds: msg.labelIds,
                snippet: msg.snippet,
                internalDate: msg.internalDate,
                payload: format === "full" ? msg.payload : undefined,
              })),
              messageCount: messages.length,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Get thread failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get thread",
          };
        }
      }
    );
  }

  // List threads
  createListThreadsTool() {
    return this.createTool(
      "gmail_list_threads",
      "List email threads with query filter",
      z.object({
        query: z.string().optional().describe("Gmail search query"),
        maxResults: z.number().min(1).max(100).default(20),
        pageToken: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
      }),
      async ({ query, maxResults, pageToken, labelIds }) => {
        try {
          logger.info(`[GMAIL] Listing threads with query: ${query || "none"}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.threads.list({
              userId: "me",
              q: query,
              maxResults,
              pageToken,
              labelIds: labelIds?.length ? labelIds : undefined,
            });
          });

          const threads = result.data.threads || [];
          logger.info(`[GMAIL] Found ${threads.length} threads`);

          return {
            success: true,
            data: {
              threads: threads.map((thread) => ({
                id: thread.id,
                snippet: thread.snippet,
                historyId: thread.historyId,
              })),
              totalCount: threads.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] List threads failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list threads",
          };
        }
      }
    );
  }

  // Get attachment
  createGetAttachmentTool() {
    return this.createTool(
      "gmail_get_attachment",
      "Download attachment by messageId and attachmentId, returns base64 encoded data",
      z.object({
        messageId: z.string().min(1, "Message ID is required"),
        attachmentId: z.string().min(1, "Attachment ID is required"),
      }),
      async ({ messageId, attachmentId }) => {
        try {
          logger.info(`[GMAIL] Getting attachment ${attachmentId} from message ${messageId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.attachments.get({
              userId: "me",
              messageId,
              id: attachmentId,
            });
          });

          logger.info(`[GMAIL] Retrieved attachment (${result.data.size} bytes)`);

          return {
            success: true,
            data: {
              attachmentId,
              size: result.data.size,
              data: result.data.data, // Base64 encoded
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Get attachment failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get attachment",
          };
        }
      }
    );
  }

  // Count unread emails
  createCountUnreadTool() {
    return this.createTool(
      "gmail_count_unread",
      "Return count of unread emails per label",
      z.object({}),
      async () => {
        try {
          logger.info(`[GMAIL] Counting unread emails`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.labels.list({
              userId: "me",
            });
          });

          const labels = result.data.labels || [];
          const unreadCounts = labels.map((label: any) => ({
            id: label.id,
            name: label.name,
            unreadCount: label.messagesUnread || 0,
            totalCount: label.messagesTotal || 0,
          }));

          const totalUnread = unreadCounts.reduce((sum, label) => sum + label.unreadCount, 0);

          logger.info(`[GMAIL] Total unread: ${totalUnread}`);

          return {
            success: true,
            data: {
              totalUnread,
              labelCounts: unreadCounts,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Count unread failed:", error);
          return {
            success: false,
            error: error.message || "Failed to count unread emails",
          };
        }
      }
    );
  }

  // Get labels
  createGetLabelsTool() {
    return this.createTool(
      "gmail_get_labels",
      "List all Gmail labels (system + custom)",
      z.object({}),
      async () => {
        try {
          logger.info(`[GMAIL] Getting all labels`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.labels.list({
              userId: "me",
            });
          });

          const labels = result.data.labels || [];
          logger.info(`[GMAIL] Found ${labels.length} labels`);

          return {
            success: true,
            data: {
              labels: labels.map((label: any) => ({
                id: label.id,
                name: label.name,
                type: label.type,
                messageListVisibility: label.messageListVisibility,
                labelListVisibility: label.labelListVisibility,
                messagesTotal: label.messagesTotal,
                messagesUnread: label.messagesUnread,
                threadsTotal: label.threadsTotal,
                threadsUnread: label.threadsUnread,
                color: label.color,
              })),
              totalCount: labels.length,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Get labels failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get labels",
          };
        }
      }
    );
  }

  // ============================================
  // WRITING TOOLS
  // ============================================

  // Send email with full support
  createSendEmailTool() {
    return this.createTool(
      "gmail_send_email",
      "Send email with to, cc, bcc, subject, body (html or plain), and attachments",
      z.object({
        to: z.union([z.string().email(), z.array(z.string().email())]).describe("Recipient email(s)"),
        cc: z.union([z.string().email(), z.array(z.string().email())]).optional().describe("CC recipient(s)"),
        bcc: z.union([z.string().email(), z.array(z.string().email())]).optional().describe("BCC recipient(s)"),
        subject: z.string().min(1, "Subject cannot be empty"),
        body: z.string().min(1, "Email body cannot be empty"),
        isHtml: z.boolean().optional().default(false).describe("Whether body is HTML"),
        attachments: z.array(z.object({
          filename: z.string(),
          mimeType: z.string(),
          data: z.string().describe("Base64 encoded attachment data"),
        })).optional().describe("Email attachments"),
      }),
      async ({ to, cc, bcc, subject, body, isHtml, attachments }) => {
        try {
          const toArray = Array.isArray(to) ? to : [to];
          const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
          const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

          logger.info(`[GMAIL] Sending email to ${toArray.join(", ")} with subject: ${subject}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            // Build email headers
            const headers = [
              `To: ${toArray.join(", ")}`,
              ccArray.length > 0 ? `Cc: ${ccArray.join(", ")}` : null,
              bccArray.length > 0 ? `Bcc: ${bccArray.join(", ")}` : null,
              `Subject: ${subject}`,
              isHtml ? "Content-Type: text/html; charset=utf-8" : "Content-Type: text/plain; charset=utf-8",
            ].filter(Boolean);

            const emailContent = [...headers, "", body].join("\n");

            // Encode email for Gmail API
            const encodedEmail = Buffer.from(emailContent)
              .toString("base64")
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=/g, "");

            return await gmail.users.messages.send({
              userId: "me",
              requestBody: { raw: encodedEmail },
            });
          });

          logger.info(`[GMAIL] Email sent successfully. Message ID: ${result.data.id}`);

          return {
            success: true,
            message: `Email sent successfully to ${toArray.join(", ")}`,
            data: {
              messageId: result.data.id,
              threadId: result.data.threadId,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Send email failed:", error);
          return {
            success: false,
            error: error.message || "Failed to send email",
          };
        }
      }
    );
  }

  // Reply to thread
  createReplyTool() {
    return this.createTool(
      "gmail_reply",
      "Reply to an email thread, auto-threads correctly",
      z.object({
        threadId: z.string().min(1, "Thread ID is required"),
        body: z.string().min(1, "Reply body cannot be empty"),
        to: z.string().email().optional().describe("Override recipient (defaults to original sender)"),
        isHtml: z.boolean().optional().default(false),
      }),
      async ({ threadId, body, to, isHtml }) => {
        try {
          logger.info(`[GMAIL] Replying to thread: ${threadId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            // Get the original message to extract recipient info
            const thread = await gmail.users.threads.get({
              userId: "me",
              id: threadId,
            });

            const originalMessage = thread.data.messages?.[0];
            if (!originalMessage) {
              throw new Error("Could not find original message in thread");
            }

            // Extract sender from original message
            const headers = originalMessage.payload?.headers || [];
            const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from");
            const subjectHeader = headers.find((h) => h.name?.toLowerCase() === "subject");
            const recipient = to || fromHeader?.value;

            if (!recipient) {
              throw new Error("Could not determine reply recipient");
            }

            // Create reply content
            const replyHeaders = [
              `To: ${recipient}`,
              `Subject: Re: ${subjectHeader?.value || ""}`,
              `In-Reply-To: ${originalMessage.id}`,
              `References: ${originalMessage.id}`,
              isHtml ? "Content-Type: text/html; charset=utf-8" : "Content-Type: text/plain; charset=utf-8",
            ];

            const replyContent = [...replyHeaders, "", body].join("\n");

            // Encode reply for Gmail API
            const encodedReply = Buffer.from(replyContent)
              .toString("base64")
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=/g, "");

            return await gmail.users.messages.send({
              userId: "me",
              requestBody: {
                raw: encodedReply,
                threadId,
              },
            });
          });

          logger.info(`[GMAIL] Reply sent successfully. Message ID: ${result.data.id}`);

          return {
            success: true,
            message: "Reply sent successfully",
            data: {
              messageId: result.data.id,
              threadId: result.data.threadId,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Reply failed:", error);
          return {
            success: false,
            error: error.message || "Failed to send reply",
          };
        }
      }
    );
  }

  // Forward email
  createForwardTool() {
    return this.createTool(
      "gmail_forward",
      "Forward an email to new recipients",
      z.object({
        messageId: z.string().min(1, "Message ID is required"),
        to: z.union([z.string().email(), z.array(z.string().email())]).describe("Forward recipient(s)"),
        additionalBody: z.string().optional().describe("Additional message to include in forward"),
      }),
      async ({ messageId, to, additionalBody }) => {
        try {
          const toArray = Array.isArray(to) ? to : [to];
          logger.info(`[GMAIL] Forwarding message ${messageId} to ${toArray.join(", ")}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            // Get the original message
            const message = await gmail.users.messages.get({
              userId: "me",
              id: messageId,
              format: "full",
            });

            // Extract original content
            const originalSnippet = message.data.snippet || "";
            const headers = message.data.payload?.headers || [];
            const subjectHeader = headers.find((h) => h.name?.toLowerCase() === "subject");
            const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from");

            // Create forward content
            const forwardHeaders = [
              `To: ${toArray.join(", ")}`,
              `Subject: Fwd: ${subjectHeader?.value || "Forwarded Message"}`,
            ];

            const forwardBody = [
              additionalBody || "",
              "",
              "---------- Forwarded message ---------",
              `From: ${fromHeader?.value || "Unknown"}`,
              `Subject: ${subjectHeader?.value || ""}`,
              "",
              originalSnippet,
            ].join("\n");

            const forwardContent = [...forwardHeaders, "", forwardBody].join("\n");

            // Encode forward for Gmail API
            const encodedForward = Buffer.from(forwardContent)
              .toString("base64")
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=/g, "");

            return await gmail.users.messages.send({
              userId: "me",
              requestBody: {
                raw: encodedForward,
              },
            });
          });

          logger.info(`[GMAIL] Message forwarded successfully. New message ID: ${result.data.id}`);

          return {
            success: true,
            message: `Email forwarded successfully to ${toArray.join(", ")}`,
            data: {
              messageId: result.data.id,
              threadId: result.data.threadId,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Forward failed:", error);
          return {
            success: false,
            error: error.message || "Failed to forward email",
          };
        }
      }
    );
  }

  // Create draft
  createDraftCreateTool() {
    return this.createTool(
      "gmail_draft_create",
      "Create a draft email",
      z.object({
        to: z.union([z.string().email(), z.array(z.string().email())]),
        subject: z.string().min(1, "Subject cannot be empty"),
        body: z.string().min(1, "Email body cannot be empty"),
        cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
        bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
        isHtml: z.boolean().optional().default(false),
      }),
      async ({ to, subject, body, cc, bcc, isHtml }) => {
        try {
          const toArray = Array.isArray(to) ? to : [to];
          const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
          const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

          logger.info(`[GMAIL] Creating draft email to ${toArray.join(", ")}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            // Build email headers
            const headers = [
              `To: ${toArray.join(", ")}`,
              ccArray.length > 0 ? `Cc: ${ccArray.join(", ")}` : null,
              bccArray.length > 0 ? `Bcc: ${bccArray.join(", ")}` : null,
              `Subject: ${subject}`,
              isHtml ? "Content-Type: text/html; charset=utf-8" : "Content-Type: text/plain; charset=utf-8",
            ].filter(Boolean);

            const emailContent = [...headers, "", body].join("\n");

            // Encode email for Gmail API
            const encodedEmail = Buffer.from(emailContent)
              .toString("base64")
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=/g, "");

            return await gmail.users.drafts.create({
              userId: "me",
              requestBody: {
                message: {
                  raw: encodedEmail,
                },
              },
            });
          });

          logger.info(`[GMAIL] Draft created successfully. Draft ID: ${result.data.id}`);

          return {
            success: true,
            message: "Draft created successfully",
            data: {
              draftId: result.data.id,
              messageId: result.data.message?.id,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Create draft failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create draft",
          };
        }
      }
    );
  }

  // List drafts
  createDraftListTool() {
    return this.createTool(
      "gmail_draft_list",
      "List all draft emails",
      z.object({
        maxResults: z.number().min(1).max(100).default(20),
        pageToken: z.string().optional(),
      }),
      async ({ maxResults, pageToken }) => {
        try {
          logger.info(`[GMAIL] Listing drafts`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.drafts.list({
              userId: "me",
              maxResults,
              pageToken,
            });
          });

          const drafts = result.data.drafts || [];
          logger.info(`[GMAIL] Found ${drafts.length} drafts`);

          return {
            success: true,
            data: {
              drafts: drafts.map((draft: any) => ({
                id: draft.id,
                messageId: draft.message?.id,
                threadId: draft.message?.threadId,
              })),
              totalCount: drafts.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] List drafts failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list drafts",
          };
        }
      }
    );
  }

  // Send draft
  createDraftSendTool() {
    return this.createTool(
      "gmail_draft_send",
      "Send an existing draft by ID",
      z.object({
        draftId: z.string().min(1, "Draft ID is required"),
      }),
      async ({ draftId }) => {
        try {
          logger.info(`[GMAIL] Sending draft: ${draftId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.drafts.send({
              userId: "me",
              requestBody: {
                id: draftId,
              },
            });
          });

          logger.info(`[GMAIL] Draft sent successfully. Message ID: ${result.data.id}`);

          return {
            success: true,
            message: "Draft sent successfully",
            data: {
              messageId: result.data.id,
              threadId: result.data.threadId,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Send draft failed:", error);
          return {
            success: false,
            error: error.message || "Failed to send draft",
          };
        }
      }
    );
  }

  // Delete draft
  createDraftDeleteTool() {
    return this.createTool(
      "gmail_draft_delete",
      "Delete a draft email",
      z.object({
        draftId: z.string().min(1, "Draft ID is required"),
      }),
      async ({ draftId }) => {
        try {
          logger.info(`[GMAIL] Deleting draft: ${draftId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.drafts.delete({
              userId: "me",
              id: draftId,
            });
          });

          logger.info(`[GMAIL] Draft deleted successfully`);

          return {
            success: true,
            message: "Draft deleted successfully",
          };
        } catch (error: any) {
          logger.error("[GMAIL] Delete draft failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete draft",
          };
        }
      }
    );
  }

  // ============================================
  // ORGANIZATION TOOLS
  // ============================================

  // Mark as read
  createMarkReadTool() {
    return this.createTool(
      "gmail_mark_read",
      "Mark one or multiple emails as read",
      z.object({
        messageIds: z.array(z.string()).min(1, "At least one message ID is required"),
      }),
      async ({ messageIds }) => {
        try {
          logger.info(`[GMAIL] Marking ${messageIds.length} messages as read`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.batchModify({
              userId: "me",
              requestBody: {
                ids: messageIds,
                removeLabelIds: ["UNREAD"],
              },
            });
          });

          logger.info(`[GMAIL] Successfully marked ${messageIds.length} messages as read`);

          return {
            success: true,
            message: `Marked ${messageIds.length} messages as read`,
            data: {
              modifiedCount: messageIds.length,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Mark read failed:", error);
          return {
            success: false,
            error: error.message || "Failed to mark messages as read",
          };
        }
      }
    );
  }

  // Mark as unread
  createMarkUnreadTool() {
    return this.createTool(
      "gmail_mark_unread",
      "Mark one or multiple emails as unread",
      z.object({
        messageIds: z.array(z.string()).min(1, "At least one message ID is required"),
      }),
      async ({ messageIds }) => {
        try {
          logger.info(`[GMAIL] Marking ${messageIds.length} messages as unread`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.batchModify({
              userId: "me",
              requestBody: {
                ids: messageIds,
                addLabelIds: ["UNREAD"],
              },
            });
          });

          logger.info(`[GMAIL] Successfully marked ${messageIds.length} messages as unread`);

          return {
            success: true,
            message: `Marked ${messageIds.length} messages as unread`,
            data: {
              modifiedCount: messageIds.length,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Mark unread failed:", error);
          return {
            success: false,
            error: error.message || "Failed to mark messages as unread",
          };
        }
      }
    );
  }

  // Archive email
  createArchiveTool() {
    return this.createTool(
      "gmail_archive",
      "Archive email (remove from inbox)",
      z.object({
        messageIds: z.array(z.string()).min(1, "At least one message ID is required"),
      }),
      async ({ messageIds }) => {
        try {
          logger.info(`[GMAIL] Archiving ${messageIds.length} messages`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.batchModify({
              userId: "me",
              requestBody: {
                ids: messageIds,
                removeLabelIds: ["INBOX"],
              },
            });
          });

          logger.info(`[GMAIL] Successfully archived ${messageIds.length} messages`);

          return {
            success: true,
            message: `Archived ${messageIds.length} messages`,
            data: {
              archivedCount: messageIds.length,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Archive failed:", error);
          return {
            success: false,
            error: error.message || "Failed to archive messages",
          };
        }
      }
    );
  }

  // Trash email
  createTrashTool() {
    return this.createTool(
      "gmail_trash",
      "Move email to trash",
      z.object({
        messageIds: z.array(z.string()).min(1, "At least one message ID is required"),
      }),
      async ({ messageIds }) => {
        try {
          logger.info(`[GMAIL] Moving ${messageIds.length} messages to trash`);

          const results = [];
          for (const messageId of messageIds) {
            const result = await this.executeGoogleRequest(async (oauth2Client) => {
              const { google } = await import("googleapis");
              const gmail = google.gmail({ version: "v1", auth: oauth2Client });

              return await gmail.users.messages.trash({
                userId: "me",
                id: messageId,
              });
            });
            results.push(result);
          }

          logger.info(`[GMAIL] Successfully trashed ${results.length} messages`);

          return {
            success: true,
            message: `Moved ${results.length} messages to trash`,
            data: {
              trashedCount: results.length,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Trash failed:", error);
          return {
            success: false,
            error: error.message || "Failed to trash messages",
          };
        }
      }
    );
  }

  // Delete permanently
  createDeletePermanentlyTool() {
    return this.createTool(
      "gmail_delete_permanently",
      "Permanently delete email (cannot be undone)",
      z.object({
        messageIds: z.array(z.string()).min(1, "At least one message ID is required"),
      }),
      async ({ messageIds }) => {
        try {
          logger.info(`[GMAIL] Permanently deleting ${messageIds.length} messages`);

          const results = [];
          for (const messageId of messageIds) {
            await this.executeGoogleRequest(async (oauth2Client) => {
              const { google } = await import("googleapis");
              const gmail = google.gmail({ version: "v1", auth: oauth2Client });

              return await gmail.users.messages.delete({
                userId: "me",
                id: messageId,
              });
            });
            results.push(messageId);
          }

          logger.info(`[GMAIL] Successfully deleted ${results.length} messages permanently`);

          return {
            success: true,
            message: `Permanently deleted ${results.length} messages`,
            data: {
              deletedCount: results.length,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Delete permanently failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete messages permanently",
          };
        }
      }
    );
  }

  // Move to label
  createMoveToLabelTool() {
    return this.createTool(
      "gmail_move_to_label",
      "Move email to a specific label (removes other labels)",
      z.object({
        messageIds: z.array(z.string()).min(1, "At least one message ID is required"),
        labelId: z.string().min(1, "Label ID is required"),
      }),
      async ({ messageIds, labelId }) => {
        try {
          logger.info(`[GMAIL] Moving ${messageIds.length} messages to label ${labelId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.batchModify({
              userId: "me",
              requestBody: {
                ids: messageIds,
                addLabelIds: [labelId],
              },
            });
          });

          logger.info(`[GMAIL] Successfully moved ${messageIds.length} messages`);

          return {
            success: true,
            message: `Moved ${messageIds.length} messages to label`,
            data: {
              movedCount: messageIds.length,
              labelId,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Move to label failed:", error);
          return {
            success: false,
            error: error.message || "Failed to move messages to label",
          };
        }
      }
    );
  }

  // Apply label
  createApplyLabelTool() {
    return this.createTool(
      "gmail_apply_label",
      "Apply label to email (keeps existing labels)",
      z.object({
        messageIds: z.array(z.string()).min(1, "At least one message ID is required"),
        labelIds: z.array(z.string()).min(1, "At least one label ID is required"),
      }),
      async ({ messageIds, labelIds }) => {
        try {
          logger.info(`[GMAIL] Applying labels to ${messageIds.length} messages`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.batchModify({
              userId: "me",
              requestBody: {
                ids: messageIds,
                addLabelIds: labelIds,
              },
            });
          });

          logger.info(`[GMAIL] Successfully applied labels to ${messageIds.length} messages`);

          return {
            success: true,
            message: `Applied labels to ${messageIds.length} messages`,
            data: {
              modifiedCount: messageIds.length,
              appliedLabels: labelIds,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Apply label failed:", error);
          return {
            success: false,
            error: error.message || "Failed to apply labels",
          };
        }
      }
    );
  }

  // Remove label
  createRemoveLabelTool() {
    return this.createTool(
      "gmail_remove_label",
      "Remove label from email",
      z.object({
        messageIds: z.array(z.string()).min(1, "At least one message ID is required"),
        labelIds: z.array(z.string()).min(1, "At least one label ID is required"),
      }),
      async ({ messageIds, labelIds }) => {
        try {
          logger.info(`[GMAIL] Removing labels from ${messageIds.length} messages`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.batchModify({
              userId: "me",
              requestBody: {
                ids: messageIds,
                removeLabelIds: labelIds,
              },
            });
          });

          logger.info(`[GMAIL] Successfully removed labels from ${messageIds.length} messages`);

          return {
            success: true,
            message: `Removed labels from ${messageIds.length} messages`,
            data: {
              modifiedCount: messageIds.length,
              removedLabels: labelIds,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Remove label failed:", error);
          return {
            success: false,
            error: error.message || "Failed to remove labels",
          };
        }
      }
    );
  }

  // Create label
  createCreateLabelTool() {
    return this.createTool(
      "gmail_create_label",
      "Create a new Gmail label with optional color",
      z.object({
        name: z.string().min(1, "Label name is required"),
        labelListVisibility: z.enum(["labelShow", "labelShowIfUnread", "labelHide"]).optional().default("labelShow"),
        messageListVisibility: z.enum(["show", "hide"]).optional().default("show"),
        backgroundColor: z.string().optional().describe("Hex color code for background"),
        textColor: z.string().optional().describe("Hex color code for text"),
      }),
      async ({ name, labelListVisibility, messageListVisibility, backgroundColor, textColor }) => {
        try {
          logger.info(`[GMAIL] Creating label: ${name}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.labels.create({
              userId: "me",
              requestBody: {
                name,
                labelListVisibility,
                messageListVisibility,
                color: backgroundColor && textColor ? {
                  backgroundColor,
                  textColor,
                } : undefined,
              },
            });
          });

          logger.info(`[GMAIL] Label created successfully. ID: ${result.data.id}`);

          return {
            success: true,
            message: `Label "${name}" created successfully`,
            data: {
              labelId: result.data.id,
              name: result.data.name,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Create label failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create label",
          };
        }
      }
    );
  }

  // Delete label
  createDeleteLabelTool() {
    return this.createTool(
      "gmail_delete_label",
      "Delete a Gmail label",
      z.object({
        labelId: z.string().min(1, "Label ID is required"),
      }),
      async ({ labelId }) => {
        try {
          logger.info(`[GMAIL] Deleting label: ${labelId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.labels.delete({
              userId: "me",
              id: labelId,
            });
          });

          logger.info(`[GMAIL] Label deleted successfully`);

          return {
            success: true,
            message: "Label deleted successfully",
          };
        } catch (error: any) {
          logger.error("[GMAIL] Delete label failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete label",
          };
        }
      }
    );
  }

  // Star email
  createStarEmailTool() {
    return this.createTool(
      "gmail_star_email",
      "Star or unstar email",
      z.object({
        messageIds: z.array(z.string()).min(1, "At least one message ID is required"),
        star: z.boolean().default(true).describe("True to star, false to unstar"),
      }),
      async ({ messageIds, star }) => {
        try {
          logger.info(`[GMAIL] ${star ? "Starring" : "Unstarring"} ${messageIds.length} messages`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.messages.batchModify({
              userId: "me",
              requestBody: {
                ids: messageIds,
                addLabelIds: star ? ["STARRED"] : [],
                removeLabelIds: star ? [] : ["STARRED"],
              },
            });
          });

          logger.info(`[GMAIL] Successfully ${star ? "starred" : "unstarred"} ${messageIds.length} messages`);

          return {
            success: true,
            message: `${star ? "Starred" : "Unstarred"} ${messageIds.length} messages`,
            data: {
              modifiedCount: messageIds.length,
              starred: star,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Star email failed:", error);
          return {
            success: false,
            error: error.message || "Failed to star/unstar emails",
          };
        }
      }
    );
  }

  // Batch archive
  createBatchArchiveTool() {
    return this.createTool(
      "gmail_batch_archive",
      "Archive multiple emails matching a query",
      z.object({
        query: z.string().min(1, "Search query is required"),
        maxResults: z.number().min(1).max(500).default(100),
      }),
      async ({ query, maxResults }) => {
        try {
          logger.info(`[GMAIL] Batch archiving emails matching: ${query}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            // First, search for messages
            const searchResult = await gmail.users.messages.list({
              userId: "me",
              q: query,
              maxResults,
            });

            const messages = searchResult.data.messages || [];
            if (messages.length === 0) {
              return { data: { messages: [] } };
            }

            const messageIds = messages.map((msg) => msg.id!);

            // Batch archive
            await gmail.users.messages.batchModify({
              userId: "me",
              requestBody: {
                ids: messageIds,
                removeLabelIds: ["INBOX"],
              },
            });

            return { data: { messages, count: messageIds.length } };
          });

          const count = result.data.count || 0;
          logger.info(`[GMAIL] Successfully archived ${count} messages`);

          return {
            success: true,
            message: `Archived ${count} messages matching query`,
            data: {
              archivedCount: count,
              query,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Batch archive failed:", error);
          return {
            success: false,
            error: error.message || "Failed to batch archive",
          };
        }
      }
    );
  }

  // Batch mark as read
  createBatchReadTool() {
    return this.createTool(
      "gmail_batch_read",
      "Mark multiple emails as read matching a query",
      z.object({
        query: z.string().min(1, "Search query is required"),
        maxResults: z.number().min(1).max(500).default(100),
      }),
      async ({ query, maxResults }) => {
        try {
          logger.info(`[GMAIL] Batch marking as read emails matching: ${query}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            // First, search for messages
            const searchResult = await gmail.users.messages.list({
              userId: "me",
              q: query,
              maxResults,
            });

            const messages = searchResult.data.messages || [];
            if (messages.length === 0) {
              return { data: { messages: [] } };
            }

            const messageIds = messages.map((msg) => msg.id!);

            // Batch mark as read
            await gmail.users.messages.batchModify({
              userId: "me",
              requestBody: {
                ids: messageIds,
                removeLabelIds: ["UNREAD"],
              },
            });

            return { data: { messages, count: messageIds.length } };
          });

          const count = result.data.count || 0;
          logger.info(`[GMAIL] Successfully marked ${count} messages as read`);

          return {
            success: true,
            message: `Marked ${count} messages as read`,
            data: {
              markedCount: count,
              query,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Batch read failed:", error);
          return {
            success: false,
            error: error.message || "Failed to batch mark as read",
          };
        }
      }
    );
  }

  // ============================================
  // FILTERS & SETTINGS TOOLS
  // ============================================

  // Create filter
  createCreateFilterTool() {
    return this.createTool(
      "gmail_create_filter",
      "Create a Gmail filter rule",
      z.object({
        from: z.string().optional().describe("Filter emails from this sender"),
        to: z.string().optional().describe("Filter emails to this recipient"),
        subject: z.string().optional().describe("Filter emails with this subject"),
        query: z.string().optional().describe("Custom Gmail search query"),
        addLabelIds: z.array(z.string()).optional().describe("Labels to add"),
        removeLabelIds: z.array(z.string()).optional().describe("Labels to remove"),
        forward: z.string().email().optional().describe("Forward to this email"),
      }),
      async ({ from, to, subject, query, addLabelIds, removeLabelIds, forward }) => {
        try {
          logger.info(`[GMAIL] Creating filter`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.settings.filters.create({
              userId: "me",
              requestBody: {
                criteria: {
                  from,
                  to,
                  subject,
                  query,
                },
                action: {
                  addLabelIds,
                  removeLabelIds,
                  forward,
                },
              },
            });
          });

          logger.info(`[GMAIL] Filter created successfully. ID: ${result.data.id}`);

          return {
            success: true,
            message: "Filter created successfully",
            data: {
              filterId: result.data.id,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Create filter failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create filter",
          };
        }
      }
    );
  }

  // List filters
  createListFiltersTool() {
    return this.createTool(
      "gmail_list_filters",
      "List all Gmail filters",
      z.object({}),
      async () => {
        try {
          logger.info(`[GMAIL] Listing filters`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.settings.filters.list({
              userId: "me",
            });
          });

          const filters = result.data.filter || [];
          logger.info(`[GMAIL] Found ${filters.length} filters`);

          return {
            success: true,
            data: {
              filters: filters.map((filter: any) => ({
                id: filter.id,
                criteria: filter.criteria,
                action: filter.action,
              })),
              totalCount: filters.length,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] List filters failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list filters",
          };
        }
      }
    );
  }

  // Get profile
  createGetProfileTool() {
    return this.createTool(
      "gmail_get_profile",
      "Get Gmail profile (email address, total messages, history ID)",
      z.object({}),
      async () => {
        try {
          logger.info(`[GMAIL] Getting profile`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.getProfile({
              userId: "me",
            });
          });

          logger.info(`[GMAIL] Retrieved profile for ${result.data.emailAddress}`);

          return {
            success: true,
            data: {
              emailAddress: result.data.emailAddress,
              messagesTotal: result.data.messagesTotal,
              threadsTotal: result.data.threadsTotal,
              historyId: result.data.historyId,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Get profile failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get profile",
          };
        }
      }
    );
  }

  // Get vacation responder
  createVacationResponderGetTool() {
    return this.createTool(
      "gmail_vacation_responder_get",
      "Get current vacation/out-of-office settings",
      z.object({}),
      async () => {
        try {
          logger.info(`[GMAIL] Getting vacation responder settings`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.settings.getVacation({
              userId: "me",
            });
          });

          logger.info(`[GMAIL] Retrieved vacation responder settings`);

          return {
            success: true,
            data: {
              enableAutoReply: result.data.enableAutoReply,
              responseSubject: result.data.responseSubject,
              responseBodyPlainText: result.data.responseBodyPlainText,
              responseBodyHtml: result.data.responseBodyHtml,
              restrictToContacts: result.data.restrictToContacts,
              restrictToDomain: result.data.restrictToDomain,
              startTime: result.data.startTime,
              endTime: result.data.endTime,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Get vacation responder failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get vacation responder",
          };
        }
      }
    );
  }

  // Set vacation responder
  createVacationResponderSetTool() {
    return this.createTool(
      "gmail_vacation_responder_set",
      "Enable/update vacation responder with message and date range",
      z.object({
        responseSubject: z.string().optional().describe("Subject line for auto-reply"),
        responseBodyPlainText: z.string().optional().describe("Plain text response body"),
        responseBodyHtml: z.string().optional().describe("HTML response body"),
        restrictToContacts: z.boolean().optional().describe("Only reply to contacts"),
        restrictToDomain: z.boolean().optional().describe("Only reply to domain"),
        startTime: z.string().optional().describe("Start time (Unix timestamp in milliseconds)"),
        endTime: z.string().optional().describe("End time (Unix timestamp in milliseconds)"),
      }),
      async ({ responseSubject, responseBodyPlainText, responseBodyHtml, restrictToContacts, restrictToDomain, startTime, endTime }) => {
        try {
          logger.info(`[GMAIL] Setting vacation responder`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.settings.updateVacation({
              userId: "me",
              requestBody: {
                enableAutoReply: true,
                responseSubject,
                responseBodyPlainText,
                responseBodyHtml,
                restrictToContacts,
                restrictToDomain,
                startTime: startTime ? String(startTime) : undefined,
                endTime: endTime ? String(endTime) : undefined,
              },
            });
          });

          logger.info(`[GMAIL] Vacation responder enabled`);

          return {
            success: true,
            message: "Vacation responder enabled successfully",
            data: {
              enableAutoReply: result.data.enableAutoReply,
              startTime: result.data.startTime,
              endTime: result.data.endTime,
            },
          };
        } catch (error: any) {
          logger.error("[GMAIL] Set vacation responder failed:", error);
          return {
            success: false,
            error: error.message || "Failed to set vacation responder",
          };
        }
      }
    );
  }

  // Disable vacation responder
  createVacationResponderDisableTool() {
    return this.createTool(
      "gmail_vacation_responder_disable",
      "Disable vacation responder",
      z.object({}),
      async () => {
        try {
          logger.info(`[GMAIL] Disabling vacation responder`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            return await gmail.users.settings.updateVacation({
              userId: "me",
              requestBody: {
                enableAutoReply: false,
              },
            });
          });

          logger.info(`[GMAIL] Vacation responder disabled`);

          return {
            success: true,
            message: "Vacation responder disabled successfully",
          };
        } catch (error: any) {
          logger.error("[GMAIL] Disable vacation responder failed:", error);
          return {
            success: false,
            error: error.message || "Failed to disable vacation responder",
          };
        }
      }
    );
  }
}

// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

// READING
export const createListUnreadTool = (userId: string) =>
  new GmailToolSuite(userId).createListUnreadTool();

export const createListEmailsTool = (userId: string) =>
  new GmailToolSuite(userId).createListEmailsTool();

export const createGetEmailTool = (userId: string) =>
  new GmailToolSuite(userId).createGetEmailTool();

export const createSearchEmailsTool = (userId: string) =>
  new GmailToolSuite(userId).createSearchEmailsTool();

export const createGetThreadTool = (userId: string) =>
  new GmailToolSuite(userId).createGetThreadTool();

export const createListThreadsTool = (userId: string) =>
  new GmailToolSuite(userId).createListThreadsTool();

export const createGetAttachmentTool = (userId: string) =>
  new GmailToolSuite(userId).createGetAttachmentTool();

export const createCountUnreadTool = (userId: string) =>
  new GmailToolSuite(userId).createCountUnreadTool();

export const createGetLabelsTool = (userId: string) =>
  new GmailToolSuite(userId).createGetLabelsTool();

// WRITING
export const createSendEmailTool = (userId: string) =>
  new GmailToolSuite(userId).createSendEmailTool();

export const createReplyTool = (userId: string) =>
  new GmailToolSuite(userId).createReplyTool();

export const createForwardTool = (userId: string) =>
  new GmailToolSuite(userId).createForwardTool();

export const createDraftCreateTool = (userId: string) =>
  new GmailToolSuite(userId).createDraftCreateTool();

export const createDraftListTool = (userId: string) =>
  new GmailToolSuite(userId).createDraftListTool();

export const createDraftSendTool = (userId: string) =>
  new GmailToolSuite(userId).createDraftSendTool();

export const createDraftDeleteTool = (userId: string) =>
  new GmailToolSuite(userId).createDraftDeleteTool();

// ORGANIZATION
export const createMarkReadTool = (userId: string) =>
  new GmailToolSuite(userId).createMarkReadTool();

export const createMarkUnreadTool = (userId: string) =>
  new GmailToolSuite(userId).createMarkUnreadTool();

export const createArchiveTool = (userId: string) =>
  new GmailToolSuite(userId).createArchiveTool();

export const createTrashTool = (userId: string) =>
  new GmailToolSuite(userId).createTrashTool();

export const createDeletePermanentlyTool = (userId: string) =>
  new GmailToolSuite(userId).createDeletePermanentlyTool();

export const createMoveToLabelTool = (userId: string) =>
  new GmailToolSuite(userId).createMoveToLabelTool();

export const createApplyLabelTool = (userId: string) =>
  new GmailToolSuite(userId).createApplyLabelTool();

export const createRemoveLabelTool = (userId: string) =>
  new GmailToolSuite(userId).createRemoveLabelTool();

export const createCreateLabelTool = (userId: string) =>
  new GmailToolSuite(userId).createCreateLabelTool();

export const createDeleteLabelTool = (userId: string) =>
  new GmailToolSuite(userId).createDeleteLabelTool();

export const createStarEmailTool = (userId: string) =>
  new GmailToolSuite(userId).createStarEmailTool();

export const createBatchArchiveTool = (userId: string) =>
  new GmailToolSuite(userId).createBatchArchiveTool();

export const createBatchReadTool = (userId: string) =>
  new GmailToolSuite(userId).createBatchReadTool();

// FILTERS & SETTINGS
export const createCreateFilterTool = (userId: string) =>
  new GmailToolSuite(userId).createCreateFilterTool();

export const createListFiltersTool = (userId: string) =>
  new GmailToolSuite(userId).createListFiltersTool();

export const createGetProfileTool = (userId: string) =>
  new GmailToolSuite(userId).createGetProfileTool();

export const createVacationResponderGetTool = (userId: string) =>
  new GmailToolSuite(userId).createVacationResponderGetTool();

export const createVacationResponderSetTool = (userId: string) =>
  new GmailToolSuite(userId).createVacationResponderSetTool();

export const createVacationResponderDisableTool = (userId: string) =>
  new GmailToolSuite(userId).createVacationResponderDisableTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createGmailTools = (userId: string) => {
  const suite = new GmailToolSuite(userId);
  return [
    // READING (9 tools)
    suite.createListUnreadTool(),
    suite.createListEmailsTool(),
    suite.createGetEmailTool(),
    suite.createSearchEmailsTool(),
    suite.createGetThreadTool(),
    suite.createListThreadsTool(),
    suite.createGetAttachmentTool(),
    suite.createCountUnreadTool(),
    suite.createGetLabelsTool(),

    // WRITING (7 tools)
    suite.createSendEmailTool(),
    suite.createReplyTool(),
    suite.createForwardTool(),
    suite.createDraftCreateTool(),
    suite.createDraftListTool(),
    suite.createDraftSendTool(),
    suite.createDraftDeleteTool(),

    // ORGANIZATION (13 tools)
    suite.createMarkReadTool(),
    suite.createMarkUnreadTool(),
    suite.createArchiveTool(),
    suite.createTrashTool(),
    suite.createDeletePermanentlyTool(),
    suite.createMoveToLabelTool(),
    suite.createApplyLabelTool(),
    suite.createRemoveLabelTool(),
    suite.createCreateLabelTool(),
    suite.createDeleteLabelTool(),
    suite.createStarEmailTool(),
    suite.createBatchArchiveTool(),
    suite.createBatchReadTool(),

    // FILTERS & SETTINGS (6 tools)
    suite.createCreateFilterTool(),
    suite.createListFiltersTool(),
    suite.createGetProfileTool(),
    suite.createVacationResponderGetTool(),
    suite.createVacationResponderSetTool(),
    suite.createVacationResponderDisableTool(),
  ];
};
