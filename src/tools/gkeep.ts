import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE KEEP TOOL SUITE - COMPREHENSIVE
// ============================================

export class KeepToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // List notes
  createListNotesTool() {
    return this.createTool(
      "gkeep_list_notes",
      "List all Keep notes with optional pageToken and pageSize",
      z.object({
        pageSize: z.number().min(1).max(100).default(50).optional(),
        pageToken: z.string().optional(),
        filter: z.string().optional().describe("Filter notes (e.g., 'trashed=false')"),
      }),
      async ({ pageSize, pageToken, filter }) => {
        try {
          logger.info(`[KEEP] Listing notes`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const keep = google.keep({ version: "v1", auth: oauth2Client });

            return await keep.notes.list({
              pageSize,
              pageToken,
              filter,
            });
          });

          const notes = result.data.notes || [];
          logger.info(`[KEEP] Found ${notes.length} notes`);

          return {
            success: true,
            data: {
              notes: notes.map((note: any) => ({
                name: note.name,
                title: note.title,
                body: note.body?.text?.text,
                createTime: note.createTime,
                updateTime: note.updateTime,
                trashed: note.trashed,
                pinned: note.pinned,
                archived: note.archived,
              })),
              totalCount: notes.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[KEEP] List notes failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list notes",
          };
        }
      }
    );
  }

  // Get note
  createGetNoteTool() {
    return this.createTool(
      "gkeep_get_note",
      "Get a specific Keep note by name",
      z.object({
        noteName: z.string().min(1, "Note name is required (format: notes/{note})"),
      }),
      async ({ noteName }) => {
        try {
          logger.info(`[KEEP] Getting note: ${noteName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const keep = google.keep({ version: "v1", auth: oauth2Client });

            return await keep.notes.get({
              name: noteName,
            });
          });

          logger.info(`[KEEP] Retrieved note`);

          return {
            success: true,
            data: {
              name: result.data.name,
              title: result.data.title,
              body: result.data.body?.text?.text,
              createTime: result.data.createTime,
              updateTime: result.data.updateTime,
              trashed: result.data.trashed,
              pinned: result.data.pinned,
              archived: result.data.archived,
              attachments: result.data.attachments,
            },
          };
        } catch (error: any) {
          logger.error("[KEEP] Get note failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get note",
          };
        }
      }
    );
  }

  // Create note
  createCreateNoteTool() {
    return this.createTool(
      "gkeep_create_note",
      "Create a new text note in Keep",
      z.object({
        title: z.string().optional().describe("Note title"),
        body: z.string().min(1, "Note body is required"),
      }),
      async ({ title, body }) => {
        try {
          logger.info(`[KEEP] Creating note: ${title || "Untitled"}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const keep = google.keep({ version: "v1", auth: oauth2Client });

            return await keep.notes.create({
              requestBody: {
                title,
                body: {
                  text: {
                    text: body,
                  },
                },
              },
            });
          });

          logger.info(`[KEEP] Note created: ${result.data.name}`);

          return {
            success: true,
            data: {
              name: result.data.name,
              title: result.data.title,
              body: result.data.body?.text?.text,
              createTime: result.data.createTime,
            },
          };
        } catch (error: any) {
          logger.error("[KEEP] Create note failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create note",
          };
        }
      }
    );
  }

  // Create list note
  createCreateListNoteTool() {
    return this.createTool(
      "gkeep_create_list_note",
      "Create a checklist note in Keep",
      z.object({
        title: z.string().optional().describe("Note title"),
        items: z.array(z.object({
          text: z.string().min(1),
          checked: z.boolean().default(false).optional(),
        })).min(1, "At least one item is required"),
      }),
      async ({ title, items }) => {
        try {
          logger.info(`[KEEP] Creating list note: ${title || "Untitled"}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const keep = google.keep({ version: "v1", auth: oauth2Client });

            return await keep.notes.create({
              requestBody: {
                title,
                body: {
                  list: {
                    listItems: items.map(item => ({
                      text: { text: item.text },
                      checked: item.checked || false,
                    })),
                  },
                },
              },
            });
          });

          logger.info(`[KEEP] List note created: ${result.data.name}`);

          return {
            success: true,
            data: {
              name: result.data.name,
              title: result.data.title,
              itemCount: items.length,
              createTime: result.data.createTime,
            },
          };
        } catch (error: any) {
          logger.error("[KEEP] Create list note failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create list note",
          };
        }
      }
    );
  }

  // Update note
  createUpdateNoteTool() {
    return this.createTool(
      "gkeep_update_note",
      "Update an existing Keep note",
      z.object({
        noteName: z.string().min(1, "Note name is required (format: notes/{note})"),
        title: z.string().optional(),
        body: z.string().optional(),
      }),
      async ({ noteName, title, body }) => {
        try {
          logger.info(`[KEEP] Updating note: ${noteName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const keep = google.keep({ version: "v1", auth: oauth2Client });

            const updateData: any = {};
            const updateMask: string[] = [];

            if (title !== undefined) {
              updateData.title = title;
              updateMask.push("title");
            }
            if (body !== undefined) {
              updateData.body = {
                text: {
                  text: body,
                },
              };
              updateMask.push("body.text.text");
            }

            return await keep.notes.patch({
              name: noteName,
              updateMask: updateMask.join(","),
              requestBody: updateData,
            });
          });

          logger.info(`[KEEP] Note updated successfully`);

          return {
            success: true,
            message: "Note updated successfully",
            data: {
              name: result.data.name,
              title: result.data.title,
            },
          };
        } catch (error: any) {
          logger.error("[KEEP] Update note failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update note",
          };
        }
      }
    );
  }

  // Delete note
  createDeleteNoteTool() {
    return this.createTool(
      "gkeep_delete_note",
      "Delete a Keep note (moves to trash)",
      z.object({
        noteName: z.string().min(1, "Note name is required (format: notes/{note})"),
      }),
      async ({ noteName }) => {
        try {
          logger.info(`[KEEP] Deleting note: ${noteName}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const keep = google.keep({ version: "v1", auth: oauth2Client });

            return await keep.notes.delete({
              name: noteName,
            });
          });

          logger.info(`[KEEP] Note deleted successfully`);

          return {
            success: true,
            message: "Note deleted successfully",
          };
        } catch (error: any) {
          logger.error("[KEEP] Delete note failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete note",
          };
        }
      }
    );
  }

  // Pin note
  createPinNoteTool() {
    return this.createTool(
      "gkeep_pin_note",
      "Pin or unpin a Keep note",
      z.object({
        noteName: z.string().min(1, "Note name is required (format: notes/{note})"),
        pinned: z.boolean().describe("True to pin, false to unpin"),
      }),
      async ({ noteName, pinned }) => {
        try {
          logger.info(`[KEEP] ${pinned ? "Pinning" : "Unpinning"} note: ${noteName}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const keep = google.keep({ version: "v1", auth: oauth2Client });

            return await keep.notes.patch({
              name: noteName,
              updateMask: "pinned",
              requestBody: {
                pinned,
              },
            });
          });

          logger.info(`[KEEP] Note ${pinned ? "pinned" : "unpinned"} successfully`);

          return {
            success: true,
            message: `Note ${pinned ? "pinned" : "unpinned"} successfully`,
          };
        } catch (error: any) {
          logger.error("[KEEP] Pin note failed:", error);
          return {
            success: false,
            error: error.message || "Failed to pin/unpin note",
          };
        }
      }
    );
  }

  // Archive note
  createArchiveNoteTool() {
    return this.createTool(
      "gkeep_archive_note",
      "Archive or unarchive a Keep note",
      z.object({
        noteName: z.string().min(1, "Note name is required (format: notes/{note})"),
        archived: z.boolean().describe("True to archive, false to unarchive"),
      }),
      async ({ noteName, archived }) => {
        try {
          logger.info(`[KEEP] ${archived ? "Archiving" : "Unarchiving"} note: ${noteName}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const keep = google.keep({ version: "v1", auth: oauth2Client });

            return await keep.notes.patch({
              name: noteName,
              updateMask: "archived",
              requestBody: {
                archived,
              },
            });
          });

          logger.info(`[KEEP] Note ${archived ? "archived" : "unarchived"} successfully`);

          return {
            success: true,
            message: `Note ${archived ? "archived" : "unarchived"} successfully`,
          };
        } catch (error: any) {
          logger.error("[KEEP] Archive note failed:", error);
          return {
            success: false,
            error: error.message || "Failed to archive/unarchive note",
          };
        }
      }
    );
  }
}

// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

export const createListNotesTool = (userId: string) =>
  new KeepToolSuite(userId).createListNotesTool();

export const createGetNoteTool = (userId: string) =>
  new KeepToolSuite(userId).createGetNoteTool();

export const createCreateNoteTool = (userId: string) =>
  new KeepToolSuite(userId).createCreateNoteTool();

export const createCreateListNoteTool = (userId: string) =>
  new KeepToolSuite(userId).createCreateListNoteTool();

export const createUpdateNoteTool = (userId: string) =>
  new KeepToolSuite(userId).createUpdateNoteTool();

export const createDeleteNoteTool = (userId: string) =>
  new KeepToolSuite(userId).createDeleteNoteTool();

export const createPinNoteTool = (userId: string) =>
  new KeepToolSuite(userId).createPinNoteTool();

export const createArchiveNoteTool = (userId: string) =>
  new KeepToolSuite(userId).createArchiveNoteTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createKeepTools = (userId: string) => {
  const suite = new KeepToolSuite(userId);
  return [
    suite.createListNotesTool(),
    suite.createGetNoteTool(),
    suite.createCreateNoteTool(),
    suite.createCreateListNoteTool(),
    suite.createUpdateNoteTool(),
    suite.createDeleteNoteTool(),
    suite.createPinNoteTool(),
    suite.createArchiveNoteTool(),
  ];
};
