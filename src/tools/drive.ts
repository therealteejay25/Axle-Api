import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE DRIVE TOOL SUITE
// ============================================

export class DriveToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Search files tool
  createSearchFilesTool() {
    return this.createTool(
      "drive_search_files",
      "Find files by name, type, or content",
      z.object({
        query: z.string().optional().describe("Search query (e.g., 'name contains \"report\"', 'mimeType=\"application/pdf\"')"),
        maxResults: z.number().min(1).max(100).default(20).describe("Maximum number of files to return"),
        orderBy: z.string().optional().describe("Sort order (e.g., 'modifiedTime desc', 'name')"),
      }),
      async ({ query, maxResults, orderBy }) => {
        try {
          logger.info(`[DRIVE] Searching files with query: ${query || "none"}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.list({
              q: query,
              pageSize: maxResults,
              orderBy,
              fields: "files(id,name,mimeType,modifiedTime,size,webViewLink,webContentLink)",
            });
          });

          const files = result.data.files || [];
          logger.info(`[DRIVE] Found ${files.length} files`);

          return {
            success: true,
            data: {
              files: files.map(file => ({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                modifiedTime: file.modifiedTime,
                size: file.size,
                webViewLink: file.webViewLink,
                downloadUrl: file.webContentLink,
              })),
              totalCount: files.length,
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

  // Create folder tool
  createCreateFolderTool() {
    return this.createTool(
      "create_folder",
      "Create a new folder in Google Drive",
      z.object({
        name: z.string().min(1, "Folder name cannot be empty"),
        parentId: z.string().optional().describe("Parent folder ID (optional, defaults to root)"),
      }),
      async ({ name, parentId }) => {
        logger.info(`[DRIVE] Creating folder: ${name}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const drive = google.drive({ version: "v3", auth: oauth2Client });

          const fileMetadata = {
            name,
            mimeType: "application/vnd.google-apps.folder",
            ...(parentId && { parents: [parentId] }),
          };

          return await drive.files.create({
            requestBody: fileMetadata,
            fields: "id,name,mimeType,modifiedTime,webViewLink",
          });
        });

        logger.info(`[DRIVE] Folder created successfully. ID: ${result.data.id}`);

        return {
          success: true,
          message: `Folder "${name}" created successfully`,
          folder: {
            id: result.data.id,
            name: result.data.name,
            mimeType: result.data.mimeType,
            modifiedTime: result.data.modifiedTime,
            webViewLink: result.data.webViewLink,
          },
        };
      }
    );
  }

  // Upload file tool
  createUploadFileTool() {
    return this.createTool(
      "upload_file",
      "Upload a file to Google Drive",
      z.object({
        name: z.string().min(1, "File name cannot be empty"),
        content: z.string().min(1, "File content cannot be empty"),
        mimeType: z.string().min(1, "MIME type is required"),
        parentId: z.string().optional().describe("Parent folder ID (optional, defaults to root)"),
      }),
      async ({ name, content, mimeType, parentId }) => {
        logger.info(`[DRIVE] Uploading file: ${name} (${mimeType})`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const drive = google.drive({ version: "v3", auth: oauth2Client });

          const fileMetadata = {
            name,
            ...(parentId && { parents: [parentId] }),
          };

          // Convert content to buffer
          const buffer = Buffer.from(content, 'base64');

          const media = {
            mimeType,
            body: buffer,
          };

          return await drive.files.create({
            requestBody: fileMetadata,
            media,
            fields: "id,name,mimeType,modifiedTime,size,webViewLink,webContentLink",
          });
        });

        logger.info(`[DRIVE] File uploaded successfully. ID: ${result.data.id}`);

        return {
          success: true,
          message: `File "${name}" uploaded successfully`,
          file: {
            id: result.data.id,
            name: result.data.name,
            mimeType: result.data.mimeType,
            modifiedTime: result.data.modifiedTime,
            size: result.data.size,
            webViewLink: result.data.webViewLink,
            downloadUrl: result.data.webContentLink,
          },
        };
      }
    );
  }

  // Export document as PDF tool
  createExportDocAsPdfTool() {
    return this.createTool(
      "export_doc_as_pdf",
      "Export a Google Doc as PDF",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        outputName: z.string().optional().describe("Output filename (without extension)"),
      }),
      async ({ fileId, outputName }) => {
        logger.info(`[DRIVE] Exporting document ${fileId} as PDF`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const drive = google.drive({ version: "v3", auth: oauth2Client });

          return await drive.files.export({
            fileId,
            mimeType: "application/pdf",
          }, { responseType: 'stream' });
        });

        // Convert stream to base64
        const chunks: Buffer[] = [];
        const stream = result.data;

        return new Promise((resolve, reject) => {
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const base64Content = buffer.toString('base64');

            const filename = outputName || `export_${fileId}`;

            logger.info(`[DRIVE] Document exported as PDF successfully`);

            resolve({
              success: true,
              message: `Document exported as PDF successfully`,
              file: {
                name: `${filename}.pdf`,
                mimeType: "application/pdf",
                content: base64Content,
                size: buffer.length,
              },
            });
          });
          stream.on('error', reject);
        });
      }
    );
  }

  // Delete file tool
  createDeleteFileTool() {
    return this.createTool(
      "delete_file",
      "Move a file to trash in Google Drive",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
      }),
      async ({ fileId }) => {
        logger.info(`[DRIVE] Deleting file: ${fileId}`);

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
          message: `File moved to trash successfully`,
          fileId,
          trashed: true,
        };
      }
    );
  }

  // Share file tool
  createShareFileTool() {
    return this.createTool(
      "share_file",
      "Update sharing permissions for a Google Drive file",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        emailAddress: z.string().email("Must be a valid email address"),
        role: z.enum(["reader", "writer", "commenter"]).default("reader").describe("Permission level to grant"),
        type: z.enum(["user", "group", "domain", "anyone"]).default("user").describe("Type of grantee"),
      }),
      async ({ fileId, emailAddress, role, type }) => {
        logger.info(`[DRIVE] Sharing file ${fileId} with ${emailAddress} as ${role}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const drive = google.drive({ version: "v3", auth: oauth2Client });

          return await drive.permissions.create({
            fileId,
            requestBody: {
              emailAddress,
              role,
              type,
            },
            sendNotificationEmail: true,
          });
        });

        logger.info(`[DRIVE] File shared successfully`);

        return {
          success: true,
          message: `File shared successfully with ${emailAddress}`,
          fileId,
          permission: {
            id: result.data.id,
            emailAddress,
            role,
            type,
          },
        };
      }
    );
  }

  // Get file metadata tool
  createGetFileMetadataTool() {
    return this.createTool(
      "get_file_metadata",
      "Get detailed metadata for a Google Drive file",
      z.object({
        fileId: z.string().min(1, "File ID is required"),
        fields: z.string().optional().default("id,name,mimeType,modifiedTime,size,owners,webViewLink,webContentLink,permissions").describe("Fields to return"),
      }),
      async ({ fileId, fields }) => {
        logger.info(`[DRIVE] Getting metadata for file: ${fileId}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const drive = google.drive({ version: "v3", auth: oauth2Client });

          return await drive.files.get({
            fileId,
            fields,
          });
        });

        logger.info(`[DRIVE] Retrieved file metadata`);

        return {
          success: true,
          file: {
            id: result.data.id,
            name: result.data.name,
            mimeType: result.data.mimeType,
            modifiedTime: result.data.modifiedTime,
            size: result.data.size,
            owners: result.data.owners,
            webViewLink: result.data.webViewLink,
            webContentLink: result.data.webContentLink,
            permissions: result.data.permissions,
          },
        };
      }
    );
  }

  // List changes tool
  createListChangesTool() {
    return this.createTool(
      "list_changes",
      "List recent changes in Google Drive",
      z.object({
        maxResults: z.number().min(1).max(100).default(20).describe("Maximum number of changes to return"),
        includeRemoved: z.boolean().default(true).describe("Whether to include deleted items"),
        restrictToMyDrive: z.boolean().default(true).describe("Whether to restrict to My Drive"),
      }),
      async ({ maxResults, includeRemoved, restrictToMyDrive }) => {
        logger.info(`[DRIVE] Listing recent changes`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const drive = google.drive({ version: "v3", auth: oauth2Client });

          return await drive.changes.list({
            pageSize: maxResults,
            includeRemoved,
            restrictToMyDrive,
            fields: "changes(file(id,name,mimeType,modifiedTime),changeType,removed)",
          });
        });

        const changes = result.data.changes || [];
        logger.info(`[DRIVE] Found ${changes.length} changes`);

        return {
          success: true,
          changes: changes.map(change => ({
            file: change.file ? {
              id: change.file.id,
              name: change.file.name,
              mimeType: change.file.mimeType,
              modifiedTime: change.file.modifiedTime,
            } : null,
            changeType: change.changeType,
            removed: change.removed,
          })),
          totalCount: changes.length,
        };
      }
    );
  }
};

// Factory functions for registry
export const createSearchFilesTool = (userId: string) =>
  new DriveToolSuite(userId).createSearchFilesTool();

export const createCreateFolderTool = (userId: string) =>
  new DriveToolSuite(userId).createCreateFolderTool();

export const createUploadFileTool = (userId: string) =>
  new DriveToolSuite(userId).createUploadFileTool();

export const createExportDocAsPdfTool = (userId: string) =>
  new DriveToolSuite(userId).createExportDocAsPdfTool();

export const createDeleteFileTool = (userId: string) =>
  new DriveToolSuite(userId).createDeleteFileTool();

export const createShareFileTool = (userId: string) =>
  new DriveToolSuite(userId).createShareFileTool();

export const createGetFileMetadataTool = (userId: string) =>
  new DriveToolSuite(userId).createGetFileMetadataTool();

export const createListChangesTool = (userId: string) =>
  new DriveToolSuite(userId).createListChangesTool();
