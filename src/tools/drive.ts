import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE DRIVE TOOL SUITE - COMPREHENSIVE
// ============================================

export class DriveToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // ============================================
  // BROWSING TOOLS
  // ============================================

  // List files with full filter support
  createListFilesTool() {
    return this.createTool(
      "gdrive_list_files",
      "List files with query, mimeType filter, folderId, pageToken, orderBy",
      z.object({
        query: z.string().optional().describe("Drive query syntax (e.g., 'name contains \"report\"')"),
        mimeType: z.string().optional().describe("Filter by MIME type"),
        folderId: z.string().optional().describe("List files in specific folder"),
        pageToken: z.string().optional().describe("Page token for pagination"),
        orderBy: z.string().optional().describe("Sort order (e.g., 'modifiedTime desc', 'name')"),
        maxResults: z.number().min(1).max(1000).default(100).describe("Maximum number of files"),
      }),
      async ({ query, mimeType, folderId, pageToken, orderBy, maxResults }) => {
        try {
          logger.info(`[DRIVE] Listing files`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            // Build query
            let q = query || "";
            if (mimeType) {
              q += (q ? " and " : "") + `mimeType='${mimeType}'`;
            }
            if (folderId) {
              q += (q ? " and " : "") + `'${folderId}' in parents`;
            }

            return await drive.files.list({
              q: q || undefined,
              pageSize: maxResults,
              pageToken,
              orderBy,
              fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, parents, createdTime, owners)",
            });
          });

          const files = result.data.files || [];
          logger.info(`[DRIVE] Found ${files.length} files`);

          return {
            success: true,
            data: {
              files: files.map((file: any) => ({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size,
                modifiedTime: file.modifiedTime,
                webViewLink: file.webViewLink,
                parents: file.parents,
                createdTime: file.createdTime,
                owners: file.owners,
              })),
              totalCount: files.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] List files failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list files",
          };
        }
      }
    );
  }

  // Get file metadata
  createGetFileTool() {
    return this.createTool(
      "gdrive_get_file",
      "Get file metadata by ID (name, size, mimeType, modifiedTime, webViewLink)",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
      }),
      async ({ fileId }) => {
        try {
          logger.info(`[DRIVE] Getting file metadata: ${fileId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.get({
              fileId,
              fields: "id, name, mimeType, size, modifiedTime, createdTime, webViewLink, webContentLink, parents, owners, shared, permissions",
            });
          });

          logger.info(`[DRIVE] Retrieved file: ${result.data.name}`);

          return {
            success: true,
            data: {
              id: result.data.id,
              name: result.data.name,
              mimeType: result.data.mimeType,
              size: result.data.size,
              modifiedTime: result.data.modifiedTime,
              createdTime: result.data.createdTime,
              webViewLink: result.data.webViewLink,
              webContentLink: result.data.webContentLink,
              parents: result.data.parents,
              owners: result.data.owners,
              shared: result.data.shared,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Get file failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get file",
          };
        }
      }
    );
  }

  // Search files with full Drive query syntax
  createSearchFilesTool() {
    return this.createTool(
      "gdrive_search_files",
      "Search files with full Drive query syntax",
      z.object({
        query: z.string().min(1, "Search query is required").describe("Drive query syntax"),
        maxResults: z.number().min(1).max(1000).default(100),
        orderBy: z.string().optional(),
        pageToken: z.string().optional(),
      }),
      async ({ query, maxResults, orderBy, pageToken }) => {
        try {
          logger.info(`[DRIVE] Searching files: ${query}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.list({
              q: query,
              pageSize: maxResults,
              orderBy,
              pageToken,
              fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, parents)",
            });
          });

          const files = result.data.files || [];
          logger.info(`[DRIVE] Found ${files.length} files`);

          return {
            success: true,
            data: {
              files,
              totalCount: files.length,
              nextPageToken: result.data.nextPageToken,
              query,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Search files failed:", error);
          return {
            success: false,
            error: error.message || "Failed to search files",
          };
        }
      }
    );
  }

  // List folders only
  createListFoldersTool() {
    return this.createTool(
      "gdrive_list_folders",
      "List folders only, optionally inside a parent folder",
      z.object({
        parentFolderId: z.string().optional().describe("Parent folder ID to list folders from"),
        maxResults: z.number().min(1).max(1000).default(100),
        pageToken: z.string().optional(),
      }),
      async ({ parentFolderId, maxResults, pageToken }) => {
        try {
          logger.info(`[DRIVE] Listing folders`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            let q = "mimeType='application/vnd.google-apps.folder'";
            if (parentFolderId) {
              q += ` and '${parentFolderId}' in parents`;
            }

            return await drive.files.list({
              q,
              pageSize: maxResults,
              pageToken,
              fields: "nextPageToken, files(id, name, modifiedTime, createdTime, webViewLink, parents)",
            });
          });

          const folders = result.data.files || [];
          logger.info(`[DRIVE] Found ${folders.length} folders`);

          return {
            success: true,
            data: {
              folders,
              totalCount: folders.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] List folders failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list folders",
          };
        }
      }
    );
  }

  // Get folder contents
  createGetFolderContentsTool() {
    return this.createTool(
      "gdrive_get_folder_contents",
      "Get everything inside a specific folder",
      z.object({
        folderId: z.string().min(1, "Folder ID is required"),
        maxResults: z.number().min(1).max(1000).default(100),
        pageToken: z.string().optional(),
      }),
      async ({ folderId, maxResults, pageToken }) => {
        try {
          logger.info(`[DRIVE] Getting folder contents: ${folderId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.list({
              q: `'${folderId}' in parents`,
              pageSize: maxResults,
              pageToken,
              fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)",
            });
          });

          const files = result.data.files || [];
          logger.info(`[DRIVE] Found ${files.length} items in folder`);

          return {
            success: true,
            data: {
              folderId,
              files,
              totalCount: files.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Get folder contents failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get folder contents",
          };
        }
      }
    );
  }

  // Get recent files
  createGetRecentFilesTool() {
    return this.createTool(
      "gdrive_get_recent_files",
      "Get recently modified files",
      z.object({
        maxResults: z.number().min(1).max(1000).default(20),
        pageToken: z.string().optional(),
      }),
      async ({ maxResults, pageToken }) => {
        try {
          logger.info(`[DRIVE] Getting recent files`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.list({
              pageSize: maxResults,
              pageToken,
              orderBy: "modifiedTime desc",
              fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)",
            });
          });

          const files = result.data.files || [];
          logger.info(`[DRIVE] Found ${files.length} recent files`);

          return {
            success: true,
            data: {
              files,
              totalCount: files.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Get recent files failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get recent files",
          };
        }
      }
    );
  }

  // Get shared files
  createGetSharedFilesTool() {
    return this.createTool(
      "gdrive_get_shared_files",
      "List files shared with the user",
      z.object({
        maxResults: z.number().min(1).max(1000).default(100),
        pageToken: z.string().optional(),
      }),
      async ({ maxResults, pageToken }) => {
        try {
          logger.info(`[DRIVE] Getting shared files`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.list({
              q: "sharedWithMe=true",
              pageSize: maxResults,
              pageToken,
              fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, owners)",
            });
          });

          const files = result.data.files || [];
          logger.info(`[DRIVE] Found ${files.length} shared files`);

          return {
            success: true,
            data: {
              files,
              totalCount: files.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Get shared files failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get shared files",
          };
        }
      }
    );
  }

  // Get shared drives
  createGetSharedDrivesTool() {
    return this.createTool(
      "gdrive_get_shared_drives",
      "List all shared drives the user has access to",
      z.object({
        maxResults: z.number().min(1).max(100).default(10),
        pageToken: z.string().optional(),
      }),
      async ({ maxResults, pageToken }) => {
        try {
          logger.info(`[DRIVE] Getting shared drives`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.drives.list({
              pageSize: maxResults,
              pageToken,
            });
          });

          const drives = result.data.drives || [];
          logger.info(`[DRIVE] Found ${drives.length} shared drives`);

          return {
            success: true,
            data: {
              drives: drives.map((drive: any) => ({
                id: drive.id,
                name: drive.name,
                createdTime: drive.createdTime,
              })),
              totalCount: drives.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Get shared drives failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get shared drives",
          };
        }
      }
    );
  }

  // ============================================
  // READING TOOLS
  // ============================================

  // Download file content
  createDownloadFileTool() {
    return this.createTool(
      "gdrive_download_file",
      "Download file content, return as text or base64",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        encoding: z.enum(["text", "base64"]).default("text").describe("Return format"),
      }),
      async ({ fileId, encoding }) => {
        try {
          logger.info(`[DRIVE] Downloading file: ${fileId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.get({
              fileId,
              alt: "media",
            }, { responseType: "arraybuffer" });
          });

          const buffer = Buffer.from(result.data as ArrayBuffer);
          const content = encoding === "base64" 
            ? buffer.toString("base64")
            : buffer.toString("utf-8");

          logger.info(`[DRIVE] Downloaded file (${buffer.length} bytes)`);

          return {
            success: true,
            data: {
              fileId,
              content,
              encoding,
              size: buffer.length,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Download file failed:", error);
          return {
            success: false,
            error: error.message || "Failed to download file",
          };
        }
      }
    );
  }

  // Export file
  createExportFileTool() {
    return this.createTool(
      "gdrive_export_file",
      "Export Google Doc/Sheet/Slide as PDF, DOCX, XLSX, CSV",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        mimeType: z.enum([
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv",
          "text/plain",
        ]).describe("Export format"),
        encoding: z.enum(["text", "base64"]).default("base64"),
      }),
      async ({ fileId, mimeType, encoding }) => {
        try {
          logger.info(`[DRIVE] Exporting file ${fileId} as ${mimeType}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.export({
              fileId,
              mimeType,
            }, { responseType: "arraybuffer" });
          });

          const buffer = Buffer.from(result.data as ArrayBuffer);
          const content = encoding === "base64"
            ? buffer.toString("base64")
            : buffer.toString("utf-8");

          logger.info(`[DRIVE] Exported file (${buffer.length} bytes)`);

          return {
            success: true,
            data: {
              fileId,
              content,
              mimeType,
              encoding,
              size: buffer.length,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Export file failed:", error);
          return {
            success: false,
            error: error.message || "Failed to export file",
          };
        }
      }
    );
  }

  // Get file permissions
  createGetFilePermissionsTool() {
    return this.createTool(
      "gdrive_get_file_permissions",
      "List all permissions on a file",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
      }),
      async ({ fileId }) => {
        try {
          logger.info(`[DRIVE] Getting permissions for file: ${fileId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.permissions.list({
              fileId,
              fields: "permissions(id, type, role, emailAddress, domain, displayName)",
            });
          });

          const permissions = result.data.permissions || [];
          logger.info(`[DRIVE] Found ${permissions.length} permissions`);

          return {
            success: true,
            data: {
              fileId,
              permissions: permissions.map((perm: any) => ({
                id: perm.id,
                type: perm.type,
                role: perm.role,
                emailAddress: perm.emailAddress,
                domain: perm.domain,
                displayName: perm.displayName,
              })),
              totalCount: permissions.length,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Get file permissions failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get file permissions",
          };
        }
      }
    );
  }

  // ============================================
  // WRITING TOOLS
  // ============================================

  // Upload file
  createUploadFileTool() {
    return this.createTool(
      "gdrive_upload_file",
      "Upload a file with name, mimeType, content (base64 or text), optional folderId",
      z.object({
        name: z.string().min(1, "File name is required"),
        mimeType: z.string().min(1, "MIME type is required"),
        content: z.string().min(1, "File content is required (base64 or text)"),
        encoding: z.enum(["base64", "text"]).default("text"),
        folderId: z.string().optional().describe("Parent folder ID"),
      }),
      async ({ name, mimeType, content, encoding, folderId }) => {
        try {
          logger.info(`[DRIVE] Uploading file: ${name}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            const buffer = encoding === "base64"
              ? Buffer.from(content, "base64")
              : Buffer.from(content, "utf-8");

            const media = {
              mimeType,
              body: buffer,
            };

            const fileMetadata: any = {
              name,
            };

            if (folderId) {
              fileMetadata.parents = [folderId];
            }

            return await drive.files.create({
              requestBody: fileMetadata,
              media,
              fields: "id, name, mimeType, size, webViewLink, webContentLink",
            });
          });

          logger.info(`[DRIVE] File uploaded successfully: ${result.data.id}`);

          return {
            success: true,
            message: `File "${name}" uploaded successfully`,
            data: {
              fileId: result.data.id,
              name: result.data.name,
              mimeType: result.data.mimeType,
              size: result.data.size,
              webViewLink: result.data.webViewLink,
              webContentLink: result.data.webContentLink,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Upload file failed:", error);
          return {
            success: false,
            error: error.message || "Failed to upload file",
          };
        }
      }
    );
  }

  // Create folder
  createCreateFolderTool() {
    return this.createTool(
      "gdrive_create_folder",
      "Create a new folder, optional parent folderId",
      z.object({
        name: z.string().min(1, "Folder name is required"),
        parentFolderId: z.string().optional().describe("Parent folder ID"),
      }),
      async ({ name, parentFolderId }) => {
        try {
          logger.info(`[DRIVE] Creating folder: ${name}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            const fileMetadata: any = {
              name,
              mimeType: "application/vnd.google-apps.folder",
            };

            if (parentFolderId) {
              fileMetadata.parents = [parentFolderId];
            }

            return await drive.files.create({
              requestBody: fileMetadata,
              fields: "id, name, webViewLink",
            });
          });

          logger.info(`[DRIVE] Folder created successfully: ${result.data.id}`);

          return {
            success: true,
            message: `Folder "${name}" created successfully`,
            data: {
              folderId: result.data.id,
              name: result.data.name,
              webViewLink: result.data.webViewLink,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Create folder failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create folder",
          };
        }
      }
    );
  }

  // Copy file
  createCopyFileTool() {
    return this.createTool(
      "gdrive_copy_file",
      "Copy a file to a destination folder with new name",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        newName: z.string().min(1, "New name is required"),
        destinationFolderId: z.string().optional().describe("Destination folder ID"),
      }),
      async ({ fileId, newName, destinationFolderId }) => {
        try {
          logger.info(`[DRIVE] Copying file ${fileId} to ${newName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            const fileMetadata: any = {
              name: newName,
            };

            if (destinationFolderId) {
              fileMetadata.parents = [destinationFolderId];
            }

            return await drive.files.copy({
              fileId,
              requestBody: fileMetadata,
              fields: "id, name, mimeType, webViewLink",
            });
          });

          logger.info(`[DRIVE] File copied successfully: ${result.data.id}`);

          return {
            success: true,
            message: `File copied successfully as "${newName}"`,
            data: {
              fileId: result.data.id,
              name: result.data.name,
              mimeType: result.data.mimeType,
              webViewLink: result.data.webViewLink,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Copy file failed:", error);
          return {
            success: false,
            error: error.message || "Failed to copy file",
          };
        }
      }
    );
  }

  // Move file
  createMoveFileTool() {
    return this.createTool(
      "gdrive_move_file",
      "Move file to a different folder",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        newParentFolderId: z.string().min(1, "New parent folder ID is required"),
      }),
      async ({ fileId, newParentFolderId }) => {
        try {
          logger.info(`[DRIVE] Moving file ${fileId} to folder ${newParentFolderId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            // Get current parents
            const file = await drive.files.get({
              fileId,
              fields: "parents",
            });

            const previousParents = file.data.parents?.join(",") || "";

            // Move file
            return await drive.files.update({
              fileId,
              addParents: newParentFolderId,
              removeParents: previousParents,
              fields: "id, name, parents, webViewLink",
            });
          });

          logger.info(`[DRIVE] File moved successfully`);

          return {
            success: true,
            message: "File moved successfully",
            data: {
              fileId: result.data.id,
              name: result.data.name,
              parents: result.data.parents,
              webViewLink: result.data.webViewLink,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Move file failed:", error);
          return {
            success: false,
            error: error.message || "Failed to move file",
          };
        }
      }
    );
  }

  // Rename file
  createRenameFileTool() {
    return this.createTool(
      "gdrive_rename_file",
      "Rename a file",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        newName: z.string().min(1, "New name is required"),
      }),
      async ({ fileId, newName }) => {
        try {
          logger.info(`[DRIVE] Renaming file ${fileId} to ${newName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.update({
              fileId,
              requestBody: {
                name: newName,
              },
              fields: "id, name, webViewLink",
            });
          });

          logger.info(`[DRIVE] File renamed successfully`);

          return {
            success: true,
            message: `File renamed to "${newName}"`,
            data: {
              fileId: result.data.id,
              name: result.data.name,
              webViewLink: result.data.webViewLink,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Rename file failed:", error);
          return {
            success: false,
            error: error.message || "Failed to rename file",
          };
        }
      }
    );
  }

  // Update file content
  createUpdateFileTool() {
    return this.createTool(
      "gdrive_update_file",
      "Update file content in place",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        content: z.string().min(1, "New content is required"),
        encoding: z.enum(["base64", "text"]).default("text"),
        mimeType: z.string().optional().describe("MIME type (optional)"),
      }),
      async ({ fileId, content, encoding, mimeType }) => {
        try {
          logger.info(`[DRIVE] Updating file content: ${fileId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            const buffer = encoding === "base64"
              ? Buffer.from(content, "base64")
              : Buffer.from(content, "utf-8");

            const media: any = {
              body: buffer,
            };

            if (mimeType) {
              media.mimeType = mimeType;
            }

            return await drive.files.update({
              fileId,
              media,
              fields: "id, name, mimeType, size, modifiedTime, webViewLink",
            });
          });

          logger.info(`[DRIVE] File updated successfully`);

          return {
            success: true,
            message: "File content updated successfully",
            data: {
              fileId: result.data.id,
              name: result.data.name,
              mimeType: result.data.mimeType,
              size: result.data.size,
              modifiedTime: result.data.modifiedTime,
              webViewLink: result.data.webViewLink,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Update file failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update file",
          };
        }
      }
    );
  }

  // Delete file (move to trash)
  createDeleteFileTool() {
    return this.createTool(
      "gdrive_delete_file",
      "Move file to trash",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
      }),
      async ({ fileId }) => {
        try {
          logger.info(`[DRIVE] Moving file to trash: ${fileId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.update({
              fileId,
              requestBody: {
                trashed: true,
              },
            });
          });

          logger.info(`[DRIVE] File moved to trash successfully`);

          return {
            success: true,
            message: "File moved to trash",
            data: {
              fileId: result.data.id,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Delete file failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete file",
          };
        }
      }
    );
  }

  // Delete permanently
  createDeletePermanentlyTool() {
    return this.createTool(
      "gdrive_delete_permanently",
      "Permanently delete a file (cannot be undone)",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
      }),
      async ({ fileId }) => {
        try {
          logger.info(`[DRIVE] Permanently deleting file: ${fileId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.delete({
              fileId,
            });
          });

          logger.info(`[DRIVE] File permanently deleted`);

          return {
            success: true,
            message: "File permanently deleted",
          };
        } catch (error: any) {
          logger.error("[DRIVE] Delete permanently failed:", error);
          return {
            success: false,
            error: error.message || "Failed to permanently delete file",
          };
        }
      }
    );
  }

  // ============================================
  // SHARING TOOLS
  // ============================================

  // Share file
  createShareFileTool() {
    return this.createTool(
      "gdrive_share_file",
      "Share file with email, role (reader/commenter/writer), type (user/domain/anyone)",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        email: z.string().email().optional().describe("Email address (for user/group type)"),
        role: z.enum(["reader", "commenter", "writer", "owner"]).describe("Permission role"),
        type: z.enum(["user", "group", "domain", "anyone"]).describe("Permission type"),
        domain: z.string().optional().describe("Domain name (for domain type)"),
        sendNotificationEmail: z.boolean().optional().default(true),
      }),
      async ({ fileId, email, role, type, domain, sendNotificationEmail }) => {
        try {
          logger.info(`[DRIVE] Sharing file ${fileId} with ${email || type}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            const permission: any = {
              type,
              role,
            };

            if (email && (type === "user" || type === "group")) {
              permission.emailAddress = email;
            }

            if (domain && type === "domain") {
              permission.domain = domain;
            }

            return await drive.permissions.create({
              fileId,
              requestBody: permission,
              sendNotificationEmail,
              fields: "id, type, role, emailAddress, domain",
            });
          });

          logger.info(`[DRIVE] File shared successfully`);

          return {
            success: true,
            message: "File shared successfully",
            data: {
              permissionId: result.data.id,
              type: result.data.type,
              role: result.data.role,
              emailAddress: result.data.emailAddress,
              domain: result.data.domain,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Share file failed:", error);
          return {
            success: false,
            error: error.message || "Failed to share file",
          };
        }
      }
    );
  }

  // Remove permission
  createRemovePermissionTool() {
    return this.createTool(
      "gdrive_remove_permission",
      "Remove a specific permission from a file",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        permissionId: z.string().min(1, "Permission ID is required"),
      }),
      async ({ fileId, permissionId }) => {
        try {
          logger.info(`[DRIVE] Removing permission ${permissionId} from file ${fileId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.permissions.delete({
              fileId,
              permissionId,
            });
          });

          logger.info(`[DRIVE] Permission removed successfully`);

          return {
            success: true,
            message: "Permission removed successfully",
          };
        } catch (error: any) {
          logger.error("[DRIVE] Remove permission failed:", error);
          return {
            success: false,
            error: error.message || "Failed to remove permission",
          };
        }
      }
    );
  }

  // Make public
  createMakePublicTool() {
    return this.createTool(
      "gdrive_make_public",
      "Make a file publicly accessible with link",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        role: z.enum(["reader", "commenter", "writer"]).default("reader"),
      }),
      async ({ fileId, role }) => {
        try {
          logger.info(`[DRIVE] Making file ${fileId} public`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.permissions.create({
              fileId,
              requestBody: {
                type: "anyone",
                role,
              },
              fields: "id, type, role",
            });
          });

          // Get the shareable link
          const fileResult = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.get({
              fileId,
              fields: "webViewLink, webContentLink",
            });
          });

          logger.info(`[DRIVE] File made public successfully`);

          return {
            success: true,
            message: "File is now publicly accessible",
            data: {
              permissionId: result.data.id,
              webViewLink: fileResult.data.webViewLink,
              webContentLink: fileResult.data.webContentLink,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Make public failed:", error);
          return {
            success: false,
            error: error.message || "Failed to make file public",
          };
        }
      }
    );
  }

  // Make private
  createMakePrivateTool() {
    return this.createTool(
      "gdrive_make_private",
      "Remove public access from a file",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
      }),
      async ({ fileId }) => {
        try {
          logger.info(`[DRIVE] Making file ${fileId} private`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            // Get all permissions
            const permissions = await drive.permissions.list({
              fileId,
              fields: "permissions(id, type)",
            });

            // Find and remove "anyone" permissions
            const anyonePermissions = permissions.data.permissions?.filter(
              (p: any) => p.type === "anyone"
            ) || [];

            for (const perm of anyonePermissions) {
              await drive.permissions.delete({
                fileId,
                permissionId: perm.id!,
              });
            }

            return { data: { removedCount: anyonePermissions.length } };
          });

          logger.info(`[DRIVE] File made private successfully`);

          return {
            success: true,
            message: "Public access removed",
            data: {
              removedPermissions: result.data.removedCount,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Make private failed:", error);
          return {
            success: false,
            error: error.message || "Failed to make file private",
          };
        }
      }
    );
  }

  // Get share link
  createGetShareLinkTool() {
    return this.createTool(
      "gdrive_get_share_link",
      "Get the shareable link for a file",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
      }),
      async ({ fileId }) => {
        try {
          logger.info(`[DRIVE] Getting share link for file: ${fileId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.get({
              fileId,
              fields: "id, name, webViewLink, webContentLink",
            });
          });

          logger.info(`[DRIVE] Retrieved share link`);

          return {
            success: true,
            data: {
              fileId: result.data.id,
              name: result.data.name,
              webViewLink: result.data.webViewLink,
              webContentLink: result.data.webContentLink,
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Get share link failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get share link",
          };
        }
      }
    );
  }

  // ============================================
  // STORAGE TOOLS
  // ============================================

  // Get storage quota
  createGetStorageQuotaTool() {
    return this.createTool(
      "gdrive_get_storage_quota",
      "Get used/total storage quota for the account",
      z.object({}),
      async () => {
        try {
          logger.info(`[DRIVE] Getting storage quota`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.about.get({
              fields: "storageQuota, user",
            });
          });

          const quota = result.data.storageQuota;
          const used = parseInt(quota?.usage || "0");
          const limit = parseInt(quota?.limit || "0");
          const usageInDrive = parseInt(quota?.usageInDrive || "0");
          const usageInDriveTrash = parseInt(quota?.usageInDriveTrash || "0");

          logger.info(`[DRIVE] Storage: ${used} / ${limit} bytes used`);

          return {
            success: true,
            data: {
              user: result.data.user,
              quota: {
                usage: used,
                limit,
                usageInDrive,
                usageInDriveTrash,
                percentUsed: limit > 0 ? ((used / limit) * 100).toFixed(2) : "0",
              },
            },
          };
        } catch (error: any) {
          logger.error("[DRIVE] Get storage quota failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get storage quota",
          };
        }
      }
    );
  }
}

// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

// BROWSING
export const createListFilesTool = (userId: string) =>
  new DriveToolSuite(userId).createListFilesTool();

export const createGetFileTool = (userId: string) =>
  new DriveToolSuite(userId).createGetFileTool();

export const createSearchFilesTool = (userId: string) =>
  new DriveToolSuite(userId).createSearchFilesTool();

export const createListFoldersTool = (userId: string) =>
  new DriveToolSuite(userId).createListFoldersTool();

export const createGetFolderContentsTool = (userId: string) =>
  new DriveToolSuite(userId).createGetFolderContentsTool();

export const createGetRecentFilesTool = (userId: string) =>
  new DriveToolSuite(userId).createGetRecentFilesTool();

export const createGetSharedFilesTool = (userId: string) =>
  new DriveToolSuite(userId).createGetSharedFilesTool();

export const createGetSharedDrivesTool = (userId: string) =>
  new DriveToolSuite(userId).createGetSharedDrivesTool();

// READING
export const createDownloadFileTool = (userId: string) =>
  new DriveToolSuite(userId).createDownloadFileTool();

export const createExportFileTool = (userId: string) =>
  new DriveToolSuite(userId).createExportFileTool();

export const createGetFilePermissionsTool = (userId: string) =>
  new DriveToolSuite(userId).createGetFilePermissionsTool();

// WRITING
export const createUploadFileTool = (userId: string) =>
  new DriveToolSuite(userId).createUploadFileTool();

export const createCreateFolderTool = (userId: string) =>
  new DriveToolSuite(userId).createCreateFolderTool();

export const createCopyFileTool = (userId: string) =>
  new DriveToolSuite(userId).createCopyFileTool();

export const createMoveFileTool = (userId: string) =>
  new DriveToolSuite(userId).createMoveFileTool();

export const createRenameFileTool = (userId: string) =>
  new DriveToolSuite(userId).createRenameFileTool();

export const createUpdateFileTool = (userId: string) =>
  new DriveToolSuite(userId).createUpdateFileTool();

export const createDeleteFileTool = (userId: string) =>
  new DriveToolSuite(userId).createDeleteFileTool();

export const createDeletePermanentlyTool = (userId: string) =>
  new DriveToolSuite(userId).createDeletePermanentlyTool();

// SHARING
export const createShareFileTool = (userId: string) =>
  new DriveToolSuite(userId).createShareFileTool();

export const createRemovePermissionTool = (userId: string) =>
  new DriveToolSuite(userId).createRemovePermissionTool();

export const createMakePublicTool = (userId: string) =>
  new DriveToolSuite(userId).createMakePublicTool();

export const createMakePrivateTool = (userId: string) =>
  new DriveToolSuite(userId).createMakePrivateTool();

export const createGetShareLinkTool = (userId: string) =>
  new DriveToolSuite(userId).createGetShareLinkTool();

// STORAGE
export const createGetStorageQuotaTool = (userId: string) =>
  new DriveToolSuite(userId).createGetStorageQuotaTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createDriveTools = (userId: string) => {
  const suite = new DriveToolSuite(userId);
  return [
    // BROWSING (8 tools)
    suite.createListFilesTool(),
    suite.createGetFileTool(),
    suite.createSearchFilesTool(),
    suite.createListFoldersTool(),
    suite.createGetFolderContentsTool(),
    suite.createGetRecentFilesTool(),
    suite.createGetSharedFilesTool(),
    suite.createGetSharedDrivesTool(),

    // READING (3 tools)
    suite.createDownloadFileTool(),
    suite.createExportFileTool(),
    suite.createGetFilePermissionsTool(),

    // WRITING (8 tools)
    suite.createUploadFileTool(),
    suite.createCreateFolderTool(),
    suite.createCopyFileTool(),
    suite.createMoveFileTool(),
    suite.createRenameFileTool(),
    suite.createUpdateFileTool(),
    suite.createDeleteFileTool(),
    suite.createDeletePermanentlyTool(),

    // SHARING (5 tools)
    suite.createShareFileTool(),
    suite.createRemovePermissionTool(),
    suite.createMakePublicTool(),
    suite.createMakePrivateTool(),
    suite.createGetShareLinkTool(),

    // STORAGE (1 tool)
    suite.createGetStorageQuotaTool(),
  ];
};
