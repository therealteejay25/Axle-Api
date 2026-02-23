import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE CHAT TOOL SUITE - COMPREHENSIVE
// ============================================

export class ChatToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // List spaces
  createListSpacesTool() {
    return this.createTool(
      "gchat_list_spaces",
      "List all Chat spaces (rooms/DMs) the user is a member of",
      z.object({
        pageSize: z.number().min(1).max(1000).default(100).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ pageSize, pageToken }) => {
        try {
          logger.info(`[CHAT] Listing spaces`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const chat = google.chat({ version: "v1", auth: oauth2Client });

            return await chat.spaces.list({
              pageSize,
              pageToken,
            });
          });

          const spaces = result.data.spaces || [];
          logger.info(`[CHAT] Found ${spaces.length} spaces`);

          return {
            success: true,
            data: {
              spaces: spaces.map((space: any) => ({
                name: space.name,
                displayName: space.displayName,
                type: space.type,
                spaceType: space.spaceType,
                singleUserBotDm: space.singleUserBotDm,
                threaded: space.threaded,
              })),
              totalCount: spaces.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[CHAT] List spaces failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list spaces",
          };
        }
      }
    );
  }

  // Get space
  createGetSpaceTool() {
    return this.createTool(
      "gchat_get_space",
      "Get details about a specific Chat space",
      z.object({
        spaceName: z.string().min(1, "Space name is required (format: spaces/{space})"),
      }),
      async ({ spaceName }) => {
        try {
          logger.info(`[CHAT] Getting space: ${spaceName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const chat = google.chat({ version: "v1", auth: oauth2Client });

            return await chat.spaces.get({
              name: spaceName,
            });
          });

          logger.info(`[CHAT] Retrieved space`);

          return {
            success: true,
            data: {
              name: result.data.name,
              displayName: result.data.displayName,
              type: result.data.type,
              spaceType: result.data.spaceType,
              singleUserBotDm: result.data.singleUserBotDm,
              threaded: result.data.threaded,
              spaceDetails: result.data.spaceDetails,
            },
          };
        } catch (error: any) {
          logger.error("[CHAT] Get space failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get space",
          };
        }
      }
    );
  }

  // Send message
  createSendMessageTool() {
    return this.createTool(
      "gchat_send_message",
      "Send a message to a Chat space",
      z.object({
        spaceName: z.string().min(1, "Space name is required (format: spaces/{space})"),
        text: z.string().min(1, "Message text is required"),
        threadKey: z.string().optional().describe("Thread key to reply to a specific thread"),
      }),
      async ({ spaceName, text, threadKey }) => {
        try {
          logger.info(`[CHAT] Sending message to space: ${spaceName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const chat = google.chat({ version: "v1", auth: oauth2Client });

            return await chat.spaces.messages.create({
              parent: spaceName,
              threadKey,
              requestBody: {
                text,
              },
            });
          });

          logger.info(`[CHAT] Message sent: ${result.data.name}`);

          return {
            success: true,
            data: {
              name: result.data.name,
              text: result.data.text,
              createTime: result.data.createTime,
              sender: result.data.sender,
            },
          };
        } catch (error: any) {
          logger.error("[CHAT] Send message failed:", error);
          return {
            success: false,
            error: error.message || "Failed to send message",
          };
        }
      }
    );
  }

  // List messages
  createListMessagesTool() {
    return this.createTool(
      "gchat_list_messages",
      "List messages in a Chat space",
      z.object({
        spaceName: z.string().min(1, "Space name is required (format: spaces/{space})"),
        pageSize: z.number().min(1).max(1000).default(100).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ spaceName, pageSize, pageToken }) => {
        try {
          logger.info(`[CHAT] Listing messages in space: ${spaceName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const chat = google.chat({ version: "v1", auth: oauth2Client });

            return await chat.spaces.messages.list({
              parent: spaceName,
              pageSize,
              pageToken,
            });
          });

          const messages = result.data.messages || [];
          logger.info(`[CHAT] Found ${messages.length} messages`);

          return {
            success: true,
            data: {
              messages: messages.map((msg: any) => ({
                name: msg.name,
                text: msg.text,
                createTime: msg.createTime,
                sender: msg.sender,
                thread: msg.thread,
              })),
              totalCount: messages.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[CHAT] List messages failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list messages",
          };
        }
      }
    );
  }

  // Get message
  createGetMessageTool() {
    return this.createTool(
      "gchat_get_message",
      "Get a specific message from a Chat space",
      z.object({
        messageName: z.string().min(1, "Message name is required (format: spaces/{space}/messages/{message})"),
      }),
      async ({ messageName }) => {
        try {
          logger.info(`[CHAT] Getting message: ${messageName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const chat = google.chat({ version: "v1", auth: oauth2Client });

            return await chat.spaces.messages.get({
              name: messageName,
            });
          });

          logger.info(`[CHAT] Retrieved message`);

          return {
            success: true,
            data: {
              name: result.data.name,
              text: result.data.text,
              createTime: result.data.createTime,
              sender: result.data.sender,
              thread: result.data.thread,
              argumentText: result.data.argumentText,
              annotations: result.data.annotations,
            },
          };
        } catch (error: any) {
          logger.error("[CHAT] Get message failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get message",
          };
        }
      }
    );
  }

  // Update message
  createUpdateMessageTool() {
    return this.createTool(
      "gchat_update_message",
      "Update an existing message in a Chat space",
      z.object({
        messageName: z.string().min(1, "Message name is required (format: spaces/{space}/messages/{message})"),
        text: z.string().min(1, "New message text is required"),
      }),
      async ({ messageName, text }) => {
        try {
          logger.info(`[CHAT] Updating message: ${messageName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const chat = google.chat({ version: "v1", auth: oauth2Client });

            return await chat.spaces.messages.update({
              name: messageName,
              updateMask: "text",
              requestBody: {
                text,
              },
            });
          });

          logger.info(`[CHAT] Message updated successfully`);

          return {
            success: true,
            message: "Message updated successfully",
            data: {
              name: result.data.name,
              text: result.data.text,
            },
          };
        } catch (error: any) {
          logger.error("[CHAT] Update message failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update message",
          };
        }
      }
    );
  }

  // Delete message
  createDeleteMessageTool() {
    return this.createTool(
      "gchat_delete_message",
      "Delete a message from a Chat space",
      z.object({
        messageName: z.string().min(1, "Message name is required (format: spaces/{space}/messages/{message})"),
      }),
      async ({ messageName }) => {
        try {
          logger.info(`[CHAT] Deleting message: ${messageName}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const chat = google.chat({ version: "v1", auth: oauth2Client });

            return await chat.spaces.messages.delete({
              name: messageName,
            });
          });

          logger.info(`[CHAT] Message deleted successfully`);

          return {
            success: true,
            message: "Message deleted successfully",
          };
        } catch (error: any) {
          logger.error("[CHAT] Delete message failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete message",
          };
        }
      }
    );
  }

  // Create DM
  createCreateDMTool() {
    return this.createTool(
      "gchat_create_dm",
      "Create a direct message space with a user",
      z.object({
        userEmail: z.string().email("Valid email is required"),
      }),
      async ({ userEmail }) => {
        try {
          logger.info(`[CHAT] Creating DM with: ${userEmail}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const chat = google.chat({ version: "v1", auth: oauth2Client });

            return await chat.spaces.create({
              requestBody: {
                spaceType: "DIRECT_MESSAGE",
                displayName: `DM with ${userEmail}`,
              },
            });
          });

          logger.info(`[CHAT] DM created: ${result.data.name}`);

          return {
            success: true,
            data: {
              name: result.data.name,
              displayName: result.data.displayName,
              type: result.data.type,
            },
          };
        } catch (error: any) {
          logger.error("[CHAT] Create DM failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create DM",
          };
        }
      }
    );
  }
}

// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

export const createListSpacesTool = (userId: string) =>
  new ChatToolSuite(userId).createListSpacesTool();

export const createGetSpaceTool = (userId: string) =>
  new ChatToolSuite(userId).createGetSpaceTool();

export const createSendMessageTool = (userId: string) =>
  new ChatToolSuite(userId).createSendMessageTool();

export const createListMessagesTool = (userId: string) =>
  new ChatToolSuite(userId).createListMessagesTool();

export const createGetMessageTool = (userId: string) =>
  new ChatToolSuite(userId).createGetMessageTool();

export const createUpdateMessageTool = (userId: string) =>
  new ChatToolSuite(userId).createUpdateMessageTool();

export const createDeleteMessageTool = (userId: string) =>
  new ChatToolSuite(userId).createDeleteMessageTool();

export const createCreateDMTool = (userId: string) =>
  new ChatToolSuite(userId).createCreateDMTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createChatTools = (userId: string) => {
  const suite = new ChatToolSuite(userId);
  return [
    suite.createListSpacesTool(),
    suite.createGetSpaceTool(),
    suite.createSendMessageTool(),
    suite.createListMessagesTool(),
    suite.createGetMessageTool(),
    suite.createUpdateMessageTool(),
    suite.createDeleteMessageTool(),
    suite.createCreateDMTool(),
  ];
};
