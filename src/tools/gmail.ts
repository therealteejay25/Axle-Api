import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GMAIL TOOL SUITE
// ============================================

export class GmailToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Send email tool
  createSendEmailTool() {
    return this.createTool(
      "send_email",
      "Send an email to a recipient using Gmail",
      z.object({
        to: z.string().email("Must be a valid email address"),
        subject: z.string().min(1, "Subject cannot be empty"),
        body: z.string().min(1, "Email body cannot be empty"),
      }),
      async ({ to, subject, body }) => {
        logger.info(`[GMAIL] Sending email to ${to} with subject: ${subject}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          // Create email content
          const emailContent = [
            `To: ${to}`,
            `Subject: ${subject}`,
            "",
            body,
          ].join("\n");

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

        logger.info(
          `[GMAIL] Email sent successfully. Message ID: ${result.data.id}`
        );

        return {
          success: true,
          message: `Email sent successfully to ${to}`,
          messageId: result.data.id,
          threadId: result.data.threadId,
        };
      }
    );
  }

  // List messages tool
  createListMessagesTool() {
    return this.createTool(
      "gmail_list_messages",
      "Search emails with queries (e.g., is:unread)",
      z.object({
        query: z
          .string()
          .optional()
          .describe(
            "Gmail search query (e.g., 'is:unread', 'from:someone@example.com')"
          ),
        maxResults: z
          .number()
          .min(1)
          .max(100)
          .default(20)
          .describe("Maximum number of messages to return"),
        labelIds: z
          .array(z.string())
          .optional()
          .describe("Gmail label IDs to filter by"),
      }),
      async ({ query, maxResults, labelIds }) => {
        try {
          logger.info(
            `[GMAIL] Listing messages with query: ${query || "none"}`
          );

          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const gmail = google.gmail({ version: "v1", auth: oauth2Client });

              return await gmail.users.messages.list({
                userId: "me",
                q: query,
                maxResults,
                labelIds: labelIds?.length ? labelIds : undefined,
              });
            }
          );

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
              query: query || "all",
            },
          };
        } catch (error) {
          logger.error("[GMAIL] List messages failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list messages",
          };
        }
      }
    );
  }

  // Get message details tool
  createGetMessageDetailsTool() {
    return this.createTool(
      "gmail_get_message",
      "Retrieve full email body and headers",
      z.object({
        messageId: z.string().min(1, "Message ID is required"),
        format: z
          .enum(["full", "metadata", "minimal"])
          .default("full")
          .describe("Amount of detail to return"),
      }),
      async ({ messageId, format }) => {
        try {
          logger.info(`[GMAIL] Getting message details for ID: ${messageId}`);

          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const gmail = google.gmail({ version: "v1", auth: oauth2Client });

              return await gmail.users.messages.get({
                userId: "me",
                id: messageId,
                format,
              });
            }
          );

          logger.info(`[GMAIL] Retrieved message details`);

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
            },
          };
        } catch (error) {
          logger.error("[GMAIL] Get message details failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get message details",
          };
        }
      }
    );
  }

  // Create draft tool
  createCreateDraftTool() {
    return this.createTool(
      "create_draft",
      "Create a draft email in Gmail",
      z.object({
        to: z.string().email("Must be a valid email address"),
        subject: z.string().min(1, "Subject cannot be empty"),
        body: z.string().min(1, "Email body cannot be empty"),
      }),
      async ({ to, subject, body }) => {
        logger.info(`[GMAIL] Creating draft email to ${to}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          // Create email content
          const emailContent = [
            `To: ${to}`,
            `Subject: ${subject}`,
            "",
            body,
          ].join("\n");

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

        logger.info(
          `[GMAIL] Draft created successfully. Draft ID: ${result.data.id}`
        );

        return {
          success: true,
          message: `Draft email created successfully`,
          draftId: result.data.id,
          messageId: result.data.message?.id,
        };
      }
    );
  }

  // Reply to thread tool
  createReplyToThreadToolLegacy() {
    return this.createTool(
      "reply_to_thread",
      "Reply to an existing email thread in Gmail",
      z.object({
        threadId: z.string().min(1, "Thread ID is required"),
        body: z.string().min(1, "Reply body cannot be empty"),
        to: z
          .string()
          .email()
          .optional()
          .describe("Override recipient (defaults to original sender)"),
      }),
      async ({ threadId, body, to }) => {
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
          const fromHeader = headers.find(
            (h) => h.name?.toLowerCase() === "from"
          );
          const recipient = to || fromHeader?.value;

          if (!recipient) {
            throw new Error("Could not determine reply recipient");
          }

          // Create reply content
          const replyContent = [
            `To: ${recipient}`,
            `Subject: Re:`,
            "",
            body,
          ].join("\n");

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

        logger.info(
          `[GMAIL] Reply sent successfully. Message ID: ${result.data.id}`
        );

        return {
          success: true,
          message: `Reply sent successfully`,
          messageId: result.data.id,
          threadId: result.data.threadId,
        };
      }
    );
  }

  // Forward message tool
  createForwardMessageToolLegacy() {
    return this.createTool(
      "forward_message",
      "Forward an email message to a new recipient",
      z.object({
        messageId: z.string().min(1, "Message ID is required"),
        to: z.string().email("Must be a valid email address"),
        additionalBody: z
          .string()
          .optional()
          .describe("Additional message to include in forward"),
      }),
      async ({ messageId, to, additionalBody }) => {
        logger.info(`[GMAIL] Forwarding message ${messageId} to ${to}`);

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
          const subjectHeader = headers.find(
            (h) => h.name?.toLowerCase() === "subject"
          );
          const fromHeader = headers.find(
            (h) => h.name?.toLowerCase() === "from"
          );

          // Create forward content
          const forwardContent = [
            `To: ${to}`,
            `Subject: Fwd: ${subjectHeader?.value || "Forwarded Message"}`,
            "",
            `---------- Forwarded message ---------`,
            `From: ${fromHeader?.value || "Unknown"}`,
            "",
            originalSnippet,
            ...(additionalBody ? ["", additionalBody] : []),
          ].join("\n");

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

        logger.info(
          `[GMAIL] Message forwarded successfully. New message ID: ${result.data.id}`
        );

        return {
          success: true,
          message: `Message forwarded successfully to ${to}`,
          messageId: result.data.id,
          threadId: result.data.threadId,
        };
      }
    );
  }

  // Mark as read tool
  createMarkAsReadTool() {
    return this.createTool(
      "mark_as_read",
      "Mark Gmail messages as read/unread",
      z.object({
        messageIds: z
          .array(z.string())
          .min(1, "At least one message ID is required"),
        markAsRead: z
          .boolean()
          .default(true)
          .describe("True to mark as read, false to mark as unread"),
      }),
      async ({ messageIds, markAsRead }) => {
        logger.info(
          `[GMAIL] Marking ${messageIds.length} messages as ${markAsRead ? "read" : "unread"
          }`
        );

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          // Batch modify messages
          return await gmail.users.messages.batchModify({
            userId: "me",
            requestBody: {
              ids: messageIds,
              removeLabelIds: markAsRead ? ["UNREAD"] : [],
              addLabelIds: markAsRead ? [] : ["UNREAD"],
            },
          });
        });

        logger.info(
          `[GMAIL] Successfully marked ${messageIds.length} messages`
        );

        return {
          success: true,
          message: `Marked ${messageIds.length} messages as ${markAsRead ? "read" : "unread"
            }`,
          modifiedCount: messageIds.length,
        };
      }
    );
  }

  // Trash message tool
  createTrashMessageTool() {
    return this.createTool(
      "trash_message",
      "Move Gmail messages to trash",
      z.object({
        messageIds: z
          .array(z.string())
          .min(1, "At least one message ID is required"),
      }),
      async ({ messageIds }) => {
        logger.info(`[GMAIL] Moving ${messageIds.length} messages to trash`);

        const results = [];
        for (const messageId of messageIds) {
          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const gmail = google.gmail({ version: "v1", auth: oauth2Client });

              return await gmail.users.messages.trash({
                userId: "me",
                id: messageId,
              });
            }
          );
          results.push(result);
        }

        logger.info(`[GMAIL] Successfully trashed ${results.length} messages`);

        return {
          success: true,
          message: `Moved ${results.length} messages to trash`,
          trashedCount: results.length,
          trashedMessages: results.map((r, i) => ({
            originalId: messageIds[i],
            trashedId: r.data.id,
          })),
        };
      }
    );
  }

  // List labels tool
  createListLabelsTool() {
    return this.createTool(
      "list_labels",
      "Get all Gmail labels for the user",
      z.object({}),
      async () => {
        logger.info(`[GMAIL] Listing all labels`);

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
          labels: labels.map((label) => ({
            id: label.id,
            name: label.name,
            type: label.type,
            messageListVisibility: label.messageListVisibility,
            labelListVisibility: label.labelListVisibility,
          })),
          totalCount: labels.length,
        };
      }
    );
  }

  // Apply label tool
  createApplyLabelTool() {
    return this.createTool(
      "apply_label",
      "Apply or remove labels from Gmail messages",
      z.object({
        messageIds: z
          .array(z.string())
          .min(1, "At least one message ID is required"),
        addLabelIds: z
          .array(z.string())
          .optional()
          .describe("Label IDs to add"),
        removeLabelIds: z
          .array(z.string())
          .optional()
          .describe("Label IDs to remove"),
      }),
      async ({ messageIds, addLabelIds, removeLabelIds }) => {
        logger.info(`[GMAIL] Applying labels to ${messageIds.length} messages`);

        if (
          (!addLabelIds || addLabelIds.length === 0) &&
          (!removeLabelIds || removeLabelIds.length === 0)
        ) {
          throw new Error("Must specify either addLabelIds or removeLabelIds");
        }

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          return await gmail.users.messages.batchModify({
            userId: "me",
            requestBody: {
              ids: messageIds,
              addLabelIds: addLabelIds || [],
              removeLabelIds: removeLabelIds || [],
            },
          });
        });

        logger.info(
          `[GMAIL] Successfully applied labels to ${messageIds.length} messages`
        );

        return {
          success: true,
          message: `Applied labels to ${messageIds.length} messages`,
          modifiedCount: messageIds.length,
          addedLabels: addLabelIds || [],
          removedLabels: removeLabelIds || [],
        };
      }
    );
  }

  // Create draft tool
  createCreateDraftTool() {
    return this.createTool(
      "gmail_create_draft",
      "Save a draft for human review",
      z.object({
        to: z.string().email("Must be a valid email address"),
        subject: z.string().min(1, "Subject cannot be empty"),
        body: z.string().min(1, "Email body cannot be empty"),
      }),
      async ({ to, subject, body }) => {
        try {
          logger.info(`[GMAIL] Creating draft email to ${to}`);

          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const gmail = google.gmail({ version: "v1", auth: oauth2Client });

              // Create email content
              const emailContent = [
                `To: ${to}`,
                `Subject: ${subject}`,
                "",
                body,
              ].join("\n");

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
            }
          );

          logger.info(
            `[GMAIL] Draft created successfully. Draft ID: ${result.data.id}`
          );

          return {
            success: true,
            data: {
              draftId: result.data.id,
              messageId: result.data.message?.id,
            },
          };
        } catch (error) {
          logger.error("[GMAIL] Create draft failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create draft",
          };
        }
      }
    );
  }

  // Reply to thread tool
  createReplyToThreadTool() {
    return this.createTool(
      "gmail_reply_to_thread",
      "Reply to an existing conversation",
      z.object({
        threadId: z.string().min(1, "Thread ID is required"),
        body: z.string().min(1, "Reply body cannot be empty"),
        to: z
          .string()
          .email()
          .optional()
          .describe("Override recipient (defaults to original sender)"),
      }),
      async ({ threadId, body, to }) => {
        try {
          logger.info(`[GMAIL] Replying to thread: ${threadId}`);

          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
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
              const fromHeader = headers.find(
                (h) => h.name?.toLowerCase() === "from"
              );
              const recipient = to || fromHeader?.value;

              if (!recipient) {
                throw new Error("Could not determine reply recipient");
              }

              // Create reply content
              const replyContent = [
                `To: ${recipient}`,
                `Subject: Re:`,
                "",
                body,
              ].join("\n");

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
            }
          );

          logger.info(
            `[GMAIL] Reply sent successfully. Message ID: ${result.data.id}`
          );

          return {
            success: true,
            data: {
              messageId: result.data.id,
              threadId: result.data.threadId,
            },
          };
        } catch (error) {
          logger.error("[GMAIL] Reply to thread failed:", error);
          return {
            success: false,
            error: error.message || "Failed to reply to thread",
          };
        }
      }
    );
  }

  // Forward message tool
  createForwardMessageTool() {
    return this.createTool(
      "gmail_forward_message",
      "Forward an email to a new recipient",
      z.object({
        messageId: z.string().min(1, "Message ID is required"),
        to: z.string().email("Must be a valid email address"),
        additionalBody: z
          .string()
          .optional()
          .describe("Additional message to include in forward"),
      }),
      async ({ messageId, to, additionalBody }) => {
        try {
          logger.info(`[GMAIL] Forwarding message ${messageId} to ${to}`);

          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
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
              const subjectHeader = headers.find(
                (h) => h.name?.toLowerCase() === "subject"
              );
              const fromHeader = headers.find(
                (h) => h.name?.toLowerCase() === "from"
              );

              // Create forward content
              const forwardContent = [
                `To: ${to}`,
                `Subject: Fwd: ${subjectHeader?.value || "Forwarded Message"}`,
                "",
                `---------- Forwarded message ---------`,
                `From: ${fromHeader?.value || "Unknown"}`,
                "",
                originalSnippet,
                ...(additionalBody ? ["", additionalBody] : []),
              ].join("\n");

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
            }
          );

          logger.info(
            `[GMAIL] Message forwarded successfully. New message ID: ${result.data.id}`
          );

          return {
            success: true,
            data: {
              messageId: result.data.id,
              threadId: result.data.threadId,
            },
          };
        } catch (error) {
          logger.error("[GMAIL] Forward message failed:", error);
          return {
            success: false,
            error: error.message || "Failed to forward message",
          };
        }
      }
    );
  }

  // Mark as read tool
  createMarkAsReadTool() {
    return this.createTool(
      "gmail_mark_as_read",
      "Update thread metadata",
      z.object({
        messageIds: z
          .array(z.string())
          .min(1, "At least one message ID is required"),
        markAsRead: z
          .boolean()
          .default(true)
          .describe("True to mark as read, false to mark as unread"),
      }),
      async ({ messageIds, markAsRead }) => {
        try {
          logger.info(
            `[GMAIL] Marking ${messageIds.length} messages as ${markAsRead ? "read" : "unread"
            }`
          );

          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const gmail = google.gmail({ version: "v1", auth: oauth2Client });

              // Batch modify messages
              return await gmail.users.messages.batchModify({
                userId: "me",
                requestBody: {
                  ids: messageIds,
                  removeLabelIds: markAsRead ? ["UNREAD"] : [],
                  addLabelIds: markAsRead ? [] : ["UNREAD"],
                },
              });
            }
          );

          logger.info(
            `[GMAIL] Successfully marked ${messageIds.length} messages`
          );

          return {
            success: true,
            data: {
              modifiedCount: messageIds.length,
              markedAsRead: markAsRead,
            },
          };
        } catch (error) {
          logger.error("[GMAIL] Mark as read failed:", error);
          return {
            success: false,
            error: error.message || "Failed to mark messages as read/unread",
          };
        }
      }
    );
  }

  // Trash message tool
  createTrashMessageTool() {
    return this.createTool(
      "gmail_trash_message",
      "Move to bin",
      z.object({
        messageIds: z
          .array(z.string())
          .min(1, "At least one message ID is required"),
      }),
      async ({ messageIds }) => {
        try {
          logger.info(`[GMAIL] Moving ${messageIds.length} messages to trash`);

          const results = [];
          for (const messageId of messageIds) {
            const result = await this.executeGoogleRequest(
              async (oauth2Client) => {
                const { google } = await import("googleapis");
                const gmail = google.gmail({
                  version: "v1",
                  auth: oauth2Client,
                });

                return await gmail.users.messages.trash({
                  userId: "me",
                  id: messageId,
                });
              }
            );
            results.push(result);
          }

          logger.info(
            `[GMAIL] Successfully trashed ${results.length} messages`
          );

          return {
            success: true,
            data: {
              trashedCount: results.length,
              trashedMessages: results.map((r, i) => ({
                originalId: messageIds[i],
                trashedId: r.data.id,
              })),
            },
          };
        } catch (error) {
          logger.error("[GMAIL] Trash message failed:", error);
          return {
            success: false,
            error: error.message || "Failed to trash messages",
          };
        }
      }
    );
  }

  // List labels tool
  createListLabelsTool() {
    return this.createTool(
      "gmail_list_labels",
      "Get user's custom inbox labels",
      z.object({}),
      async () => {
        try {
          logger.info(`[GMAIL] Listing all labels`);

          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const gmail = google.gmail({
                version: "v1",
                auth: oauth2Client,
              });

              return await gmail.users.labels.list({
                userId: "me",
              });
            }
          );

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
              })),
              totalCount: labels.length,
            },
          };
        } catch (error) {
          logger.error("[GMAIL] List labels failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list labels",
          };
        }
      }
    );
  }

  // Apply label tool
  createApplyLabelTool() {
    return this.createTool(
      "gmail_apply_label",
      "Organize mail into specific categories",
      z.object({
        messageIds: z
          .array(z.string())
          .min(1, "At least one message ID is required"),
        addLabelIds: z
          .array(z.string())
          .optional()
          .describe("Label IDs to add to the messages"),
        removeLabelIds: z
          .array(z.string())
          .optional()
          .describe("Label IDs to remove from the messages"),
      }),
      async ({ messageIds, addLabelIds, removeLabelIds }) => {
        try {
          logger.info(
            `[GMAIL] Applying labels to ${messageIds.length} messages`
          );

          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const gmail = google.gmail({
                version: "v1",
                auth: oauth2Client,
              });

              return await gmail.users.messages.batchModify({
                userId: "me",
                requestBody: {
                  ids: messageIds,
                  addLabelIds: addLabelIds?.length ? addLabelIds : undefined,
                  removeLabelIds: removeLabelIds?.length
                    ? removeLabelIds
                    : undefined,
                },
              });
            }
          );

          logger.info(
            `[GMAIL] Successfully modified labels for ${messageIds.length} messages`
          );

          return {
            success: true,
            data: {
              modifiedCount: messageIds.length,
              addedLabels: addLabelIds || [],
              removedLabels: removeLabelIds || [],
            },
          };
        } catch (error) {
          logger.error("[GMAIL] Apply labels failed:", error);
          return {
            success: false,
            error: error.message || "Failed to apply labels",
          };
        }
      }
    );
  }
}

// Factory functions for registry
export const createSendEmailTool = (userId: string) =>
  new GmailToolSuite(userId).createSendEmailTool();

export const createListMessagesTool = (userId: string) =>
  new GmailToolSuite(userId).createListMessagesTool();

export const createGetMessageDetailsTool = (userId: string) =>
  new GmailToolSuite(userId).createGetMessageDetailsTool();

export const createCreateDraftTool = (userId: string) =>
  new GmailToolSuite(userId).createCreateDraftTool();

export const createReplyToThreadTool = (userId: string) =>
  new GmailToolSuite(userId).createReplyToThreadTool();

export const createForwardMessageTool = (userId: string) =>
  new GmailToolSuite(userId).createForwardMessageTool();

export const createMarkAsReadTool = (userId: string) =>
  new GmailToolSuite(userId).createMarkAsReadTool();

export const createTrashMessageTool = (userId: string) =>
  new GmailToolSuite(userId).createTrashMessageTool();

export const createListLabelsTool = (userId: string) =>
  new GmailToolSuite(userId).createListLabelsTool();

export const createApplyLabelTool = (userId: string) =>
  new GmailToolSuite(userId).createApplyLabelTool();
