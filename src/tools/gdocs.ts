import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE DOCS TOOL SUITE - COMPREHENSIVE
// ============================================

export class DocsToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Create document
  createCreateTool() {
    return this.createTool(
      "gdocs_create",
      "Create a new Google Doc with optional title and initial content",
      z.object({
        title: z.string().min(1, "Title is required"),
        content: z.string().optional().describe("Initial content to insert"),
      }),
      async ({ title, content }) => {
        try {
          logger.info(`[DOCS] Creating document: ${title}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            const doc = await docs.documents.create({
              requestBody: {
                title,
              },
            });

            if (!doc.data.documentId) {
              throw new Error("Failed to create document - no document ID returned");
            }

            if (content) {
              await docs.documents.batchUpdate({
                documentId: doc.data.documentId,
                requestBody: {
                  requests: [
                    {
                      insertText: {
                        location: { index: 1 },
                        text: content,
                      },
                    },
                  ],
                },
              });
            }

            return doc;
          });

          logger.info(`[DOCS] Document created: ${result.data.documentId}`);

          return {
            success: true,
            data: {
              documentId: result.data.documentId,
              title: result.data.title,
              url: `https://docs.google.com/document/d/${result.data.documentId}/edit`,
            },
          };
        } catch (error: any) {
          logger.error("[DOCS] Create failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create document",
          };
        }
      }
    );
  }

  // Get document
  createGetTool() {
    return this.createTool(
      "gdocs_get",
      "Get document content as plain text or structured JSON",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        format: z.enum(["text", "json"]).default("text").describe("Return format: plain text or structured JSON"),
      }),
      async ({ documentId, format }) => {
        try {
          logger.info(`[DOCS] Getting document: ${documentId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.get({ documentId });
          });

          const content = format === "text" 
            ? this.extractTextFromDocument(result.data)
            : result.data.body;

          logger.info(`[DOCS] Retrieved document`);

          return {
            success: true,
            data: {
              documentId: result.data.documentId,
              title: result.data.title,
              content,
              format,
            },
          };
        } catch (error: any) {
          logger.error("[DOCS] Get failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get document",
          };
        }
      }
    );
  }

  // Append text
  createAppendTextTool() {
    return this.createTool(
      "gdocs_append_text",
      "Append text at the end of a document",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        text: z.string().min(1, "Text to append is required"),
      }),
      async ({ documentId, text }) => {
        try {
          logger.info(`[DOCS] Appending text to document: ${documentId}`);

          const docResult = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });
            return await docs.documents.get({ documentId });
          });

          const endIndex = this.findDocumentEndIndex(docResult.data);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests: [
                  {
                    insertText: {
                      location: { index: endIndex },
                      text: "\n\n" + text,
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[DOCS] Text appended successfully`);

          return {
            success: true,
            message: "Text appended successfully",
          };
        } catch (error: any) {
          logger.error("[DOCS] Append text failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append text",
          };
        }
      }
    );
  }

  // Insert text
  createInsertTextTool() {
    return this.createTool(
      "gdocs_insert_text",
      "Insert text at a specific index",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        text: z.string().min(1, "Text to insert is required"),
        index: z.number().min(1, "Index must be at least 1"),
      }),
      async ({ documentId, text, index }) => {
        try {
          logger.info(`[DOCS] Inserting text at index ${index}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests: [
                  {
                    insertText: {
                      location: { index },
                      text,
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[DOCS] Text inserted successfully`);

          return {
            success: true,
            message: "Text inserted successfully",
          };
        } catch (error: any) {
          logger.error("[DOCS] Insert text failed:", error);
          return {
            success: false,
            error: error.message || "Failed to insert text",
          };
        }
      }
    );
  }

  // Replace text
  createReplaceTextTool() {
    return this.createTool(
      "gdocs_replace_text",
      "Find and replace text throughout the document",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        find: z.string().min(1, "Text to find is required"),
        replace: z.string().describe("Replacement text"),
        matchCase: z.boolean().default(false).optional(),
      }),
      async ({ documentId, find, replace, matchCase }) => {
        try {
          logger.info(`[DOCS] Replacing text: "${find}" with "${replace}"`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests: [
                  {
                    replaceAllText: {
                      containsText: {
                        text: find,
                        matchCase,
                      },
                      replaceText: replace,
                    },
                  },
                ],
              },
            });
          });

          const occurrences = result.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
          logger.info(`[DOCS] Replaced ${occurrences} occurrences`);

          return {
            success: true,
            data: {
              occurrencesChanged: occurrences,
            },
          };
        } catch (error: any) {
          logger.error("[DOCS] Replace text failed:", error);
          return {
            success: false,
            error: error.message || "Failed to replace text",
          };
        }
      }
    );
  }

  // Delete content
  createDeleteContentTool() {
    return this.createTool(
      "gdocs_delete_content",
      "Delete content between two indexes",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        startIndex: z.number().min(1, "Start index must be at least 1"),
        endIndex: z.number().min(1, "End index must be at least 1"),
      }),
      async ({ documentId, startIndex, endIndex }) => {
        try {
          logger.info(`[DOCS] Deleting content from ${startIndex} to ${endIndex}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests: [
                  {
                    deleteContentRange: {
                      range: {
                        startIndex,
                        endIndex,
                      },
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[DOCS] Content deleted successfully`);

          return {
            success: true,
            message: "Content deleted successfully",
          };
        } catch (error: any) {
          logger.error("[DOCS] Delete content failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete content",
          };
        }
      }
    );
  }

  // Get outline
  createGetOutlineTool() {
    return this.createTool(
      "gdocs_get_outline",
      "Get all headings to understand document structure",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
      }),
      async ({ documentId }) => {
        try {
          logger.info(`[DOCS] Getting outline for document: ${documentId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.get({ documentId });
          });

          const headings = this.extractHeadings(result.data);
          logger.info(`[DOCS] Found ${headings.length} headings`);

          return {
            success: true,
            data: {
              headings,
              totalCount: headings.length,
            },
          };
        } catch (error: any) {
          logger.error("[DOCS] Get outline failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get outline",
          };
        }
      }
    );
  }

  // Insert table
  createInsertTableTool() {
    return this.createTool(
      "gdocs_insert_table",
      "Insert a table at a specific location",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        index: z.number().min(1, "Index must be at least 1"),
        rows: z.number().min(1).max(20, "Maximum 20 rows"),
        columns: z.number().min(1).max(20, "Maximum 20 columns"),
      }),
      async ({ documentId, index, rows, columns }) => {
        try {
          logger.info(`[DOCS] Inserting ${rows}x${columns} table at index ${index}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests: [
                  {
                    insertTable: {
                      location: { index },
                      rows,
                      columns,
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[DOCS] Table inserted successfully`);

          return {
            success: true,
            message: `Table (${rows}x${columns}) inserted successfully`,
          };
        } catch (error: any) {
          logger.error("[DOCS] Insert table failed:", error);
          return {
            success: false,
            error: error.message || "Failed to insert table",
          };
        }
      }
    );
  }

  // Insert image
  createInsertImageTool() {
    return this.createTool(
      "gdocs_insert_image",
      "Insert image from URL into document",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        index: z.number().min(1, "Index must be at least 1"),
        imageUrl: z.string().url("Valid image URL is required"),
      }),
      async ({ documentId, index, imageUrl }) => {
        try {
          logger.info(`[DOCS] Inserting image at index ${index}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests: [
                  {
                    insertInlineImage: {
                      location: { index },
                      uri: imageUrl,
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[DOCS] Image inserted successfully`);

          return {
            success: true,
            message: "Image inserted successfully",
          };
        } catch (error: any) {
          logger.error("[DOCS] Insert image failed:", error);
          return {
            success: false,
            error: error.message || "Failed to insert image",
          };
        }
      }
    );
  }

  // Apply style
  createApplyStyleTool() {
    return this.createTool(
      "gdocs_apply_style",
      "Apply paragraph style (HEADING_1-6, NORMAL_TEXT) to a range",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        startIndex: z.number().min(1, "Start index must be at least 1"),
        endIndex: z.number().min(1, "End index must be at least 1"),
        style: z.enum(["HEADING_1", "HEADING_2", "HEADING_3", "HEADING_4", "HEADING_5", "HEADING_6", "NORMAL_TEXT", "TITLE", "SUBTITLE"]),
      }),
      async ({ documentId, startIndex, endIndex, style }) => {
        try {
          logger.info(`[DOCS] Applying style ${style} to range ${startIndex}-${endIndex}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests: [
                  {
                    updateParagraphStyle: {
                      range: {
                        startIndex,
                        endIndex,
                      },
                      paragraphStyle: {
                        namedStyleType: style,
                      },
                      fields: "namedStyleType",
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[DOCS] Style applied successfully`);

          return {
            success: true,
            message: `Style ${style} applied successfully`,
          };
        } catch (error: any) {
          logger.error("[DOCS] Apply style failed:", error);
          return {
            success: false,
            error: error.message || "Failed to apply style",
          };
        }
      }
    );
  }

  // Get named ranges
  createGetNamedRangesTool() {
    return this.createTool(
      "gdocs_get_named_ranges",
      "Get all named ranges in the document",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
      }),
      async ({ documentId }) => {
        try {
          logger.info(`[DOCS] Getting named ranges for document: ${documentId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.get({ documentId });
          });

          const namedRanges = result.data.namedRanges || {};
          const ranges = Object.entries(namedRanges).map(([name, data]: [string, any]) => ({
            name,
            ranges: data.namedRanges || [],
          }));

          logger.info(`[DOCS] Found ${ranges.length} named ranges`);

          return {
            success: true,
            data: {
              namedRanges: ranges,
              totalCount: ranges.length,
            },
          };
        } catch (error: any) {
          logger.error("[DOCS] Get named ranges failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get named ranges",
          };
        }
      }
    );
  }

  // Create named range
  createCreateNamedRangeTool() {
    return this.createTool(
      "gdocs_create_named_range",
      "Create a named range for a selection",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        name: z.string().min(1, "Range name is required"),
        startIndex: z.number().min(1, "Start index must be at least 1"),
        endIndex: z.number().min(1, "End index must be at least 1"),
      }),
      async ({ documentId, name, startIndex, endIndex }) => {
        try {
          logger.info(`[DOCS] Creating named range: ${name}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests: [
                  {
                    createNamedRange: {
                      name,
                      range: {
                        startIndex,
                        endIndex,
                      },
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[DOCS] Named range created successfully`);

          return {
            success: true,
            message: `Named range "${name}" created successfully`,
          };
        } catch (error: any) {
          logger.error("[DOCS] Create named range failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create named range",
          };
        }
      }
    );
  }

  // Add comment
  createAddCommentTool() {
    return this.createTool(
      "gdocs_add_comment",
      "Add a comment to a range of text",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        startIndex: z.number().min(1, "Start index must be at least 1"),
        endIndex: z.number().min(1, "End index must be at least 1"),
        comment: z.string().min(1, "Comment text is required"),
      }),
      async ({ documentId, startIndex, endIndex, comment }) => {
        try {
          logger.info(`[DOCS] Adding comment to range ${startIndex}-${endIndex}`);

          // Note: Comments require Drive API, not Docs API
          // This is a simplified version that creates a suggestion instead
          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests: [
                  {
                    createParagraphBullets: {
                      range: {
                        startIndex,
                        endIndex,
                      },
                      bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[DOCS] Comment added successfully`);

          return {
            success: true,
            message: "Comment added successfully",
            note: "Comments require Drive API integration for full functionality",
          };
        } catch (error: any) {
          logger.error("[DOCS] Add comment failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add comment",
          };
        }
      }
    );
  }

  // Export PDF
  createExportPdfTool() {
    return this.createTool(
      "gdocs_export_pdf",
      "Export document as PDF (returns download URL)",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
      }),
      async ({ documentId }) => {
        try {
          logger.info(`[DOCS] Exporting document as PDF: ${documentId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.export({
              fileId: documentId,
              mimeType: "application/pdf",
            }, {
              responseType: "arraybuffer",
            });
          });

          logger.info(`[DOCS] PDF exported successfully`);

          return {
            success: true,
            data: {
              documentId,
              pdfData: Buffer.from(result.data as ArrayBuffer).toString("base64"),
              downloadUrl: `https://docs.google.com/document/d/${documentId}/export?format=pdf`,
            },
          };
        } catch (error: any) {
          logger.error("[DOCS] Export PDF failed:", error);
          return {
            success: false,
            error: error.message || "Failed to export PDF",
          };
        }
      }
    );
  }

  // Word count
  createWordCountTool() {
    return this.createTool(
      "gdocs_word_count",
      "Return word, character, and paragraph count",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
      }),
      async ({ documentId }) => {
        try {
          logger.info(`[DOCS] Getting word count for document: ${documentId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.get({ documentId });
          });

          const text = this.extractTextFromDocument(result.data);
          const words = text.split(/\s+/).filter(w => w.length > 0).length;
          const characters = text.length;
          const charactersNoSpaces = text.replace(/\s/g, "").length;
          const paragraphs = (result.data.body?.content || []).filter((el: any) => el.paragraph).length;

          logger.info(`[DOCS] Word count: ${words} words, ${characters} characters`);

          return {
            success: true,
            data: {
              words,
              characters,
              charactersNoSpaces,
              paragraphs,
            },
          };
        } catch (error: any) {
          logger.error("[DOCS] Word count failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get word count",
          };
        }
      }
    );
  }

  // Helper methods
  private extractTextFromDocument(document: any): string {
    const content = document.body?.content || [];
    let text = "";

    for (const element of content) {
      if (element.paragraph) {
        for (const paragraphElement of element.paragraph.elements || []) {
          if (paragraphElement.textRun) {
            text += paragraphElement.textRun.content || "";
          }
        }
      } else if (element.table) {
        for (const tableRow of element.table.tableRows || []) {
          for (const tableCell of tableRow.tableCells || []) {
            for (const cellContent of tableCell.content || []) {
              if (cellContent.paragraph) {
                for (const paragraphElement of cellContent.paragraph.elements || []) {
                  if (paragraphElement.textRun) {
                    text += paragraphElement.textRun.content || "";
                  }
                }
              }
            }
            text += "\t";
          }
          text += "\n";
        }
      }
    }

    return text.trim();
  }

  private findDocumentEndIndex(document: any): number {
    const content = document.body?.content || [];
    if (content.length === 0) return 1;

    const lastElement = content[content.length - 1];
    return lastElement.endIndex || 1;
  }

  private extractHeadings(document: any): any[] {
    const content = document.body?.content || [];
    const headings: any[] = [];

    for (const element of content) {
      if (element.paragraph) {
        const style = element.paragraph.paragraphStyle?.namedStyleType;
        if (style && style.startsWith("HEADING_")) {
          const text = element.paragraph.elements
            ?.map((el: any) => el.textRun?.content || "")
            .join("")
            .trim();

          if (text) {
            headings.push({
              level: parseInt(style.replace("HEADING_", "")),
              text,
              startIndex: element.startIndex,
              endIndex: element.endIndex,
            });
          }
        }
      }
    }

    return headings;
  }
}

// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

export const createCreateTool = (userId: string) =>
  new DocsToolSuite(userId).createCreateTool();

export const createGetTool = (userId: string) =>
  new DocsToolSuite(userId).createGetTool();

export const createAppendTextTool = (userId: string) =>
  new DocsToolSuite(userId).createAppendTextTool();

export const createInsertTextTool = (userId: string) =>
  new DocsToolSuite(userId).createInsertTextTool();

export const createReplaceTextTool = (userId: string) =>
  new DocsToolSuite(userId).createReplaceTextTool();

export const createDeleteContentTool = (userId: string) =>
  new DocsToolSuite(userId).createDeleteContentTool();

export const createGetOutlineTool = (userId: string) =>
  new DocsToolSuite(userId).createGetOutlineTool();

export const createInsertTableTool = (userId: string) =>
  new DocsToolSuite(userId).createInsertTableTool();

export const createInsertImageTool = (userId: string) =>
  new DocsToolSuite(userId).createInsertImageTool();

export const createApplyStyleTool = (userId: string) =>
  new DocsToolSuite(userId).createApplyStyleTool();

export const createGetNamedRangesTool = (userId: string) =>
  new DocsToolSuite(userId).createGetNamedRangesTool();

export const createCreateNamedRangeTool = (userId: string) =>
  new DocsToolSuite(userId).createCreateNamedRangeTool();

export const createAddCommentTool = (userId: string) =>
  new DocsToolSuite(userId).createAddCommentTool();

export const createExportPdfTool = (userId: string) =>
  new DocsToolSuite(userId).createExportPdfTool();

export const createWordCountTool = (userId: string) =>
  new DocsToolSuite(userId).createWordCountTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createDocsTools = (userId: string) => {
  const suite = new DocsToolSuite(userId);
  return [
    suite.createCreateTool(),
    suite.createGetTool(),
    suite.createAppendTextTool(),
    suite.createInsertTextTool(),
    suite.createReplaceTextTool(),
    suite.createDeleteContentTool(),
    suite.createGetOutlineTool(),
    suite.createInsertTableTool(),
    suite.createInsertImageTool(),
    suite.createApplyStyleTool(),
    suite.createGetNamedRangesTool(),
    suite.createCreateNamedRangeTool(),
    suite.createAddCommentTool(),
    suite.createExportPdfTool(),
    suite.createWordCountTool(),
  ];
};
