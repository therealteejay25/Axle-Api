import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE DOCS TOOL SUITE
// ============================================

export class DocsToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Get content tool
  createGetContentTool() {
    return this.createTool(
      "docs_get_content",
      "Extract all text from a Google Doc for analysis",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
      }),
      async ({ documentId }) => {
        try {
          logger.info(`[DOCS] Getting content from document: ${documentId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.get({
              documentId,
            });
          });

          // Extract text content from the document
          const content = this.extractTextFromDocument(result.data);
          logger.info(`[DOCS] Extracted ${content.length} characters of text`);

          return {
            success: true,
            documentId,
            title: result.data.title,
            content,
            contentLength: content.length,
          };
        } catch (error) {
          logger.error("[DOCS] Get content failed:", error);
          return {
            success: false,
            error: (error as Error).message || "Failed to get document content",
          };
        }
      }
    );
  }

  // Append text tool
  createAppendTextTool() {
    return this.createTool(
      "docs_append_text",
      "Write summary reports to the end of a document",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        text: z.string().min(1, "Text to append cannot be empty"),
      }),
      async ({ documentId, text }) => {
        try {
          logger.info(`[DOCS] Appending text to document: ${documentId}`);

          // First get the document to find the end
          const docResult = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.get({
              documentId,
            });
          });

          // Find the last index in the document
          const endIndex = this.findDocumentEndIndex(docResult.data);

          // Create the append request
          const requests = [
            {
              insertText: {
                location: {
                  index: endIndex,
                },
                text: "\n\n" + text,
              },
            },
          ];

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const docs = google.docs({ version: "v1", auth: oauth2Client });

            return await docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests,
              },
            });
          });

          logger.info(`[DOCS] Text appended successfully`);

          return {
            success: true,
            documentId,
            appendedText: text,
            operations: result.data.replies?.length || 0,
          };
        } catch (error) {
          logger.error("[DOCS] Append text failed:", error);
          return {
            success: false,
            error: (error as Error).message || "Failed to append text to document",
          };
        }
      }
    );
  }

  // Helper method to extract text from Google Docs document structure
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
        // Handle tables - extract cell content
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
            text += "\t"; // Tab separator for cells
          }
          text += "\n"; // New line for rows
        }
      }
    }

    return text.trim();
  }

  // Helper method to find the end index of a document
  private findDocumentEndIndex(document: any): number {
    const content = document.body?.content || [];

    if (content.length === 0) {
      return 1; // Empty document, start after the initial newline
    }

    // Find the last structural element
    const lastElement = content[content.length - 1];

    if (lastElement.endIndex) {
      return lastElement.endIndex;
    }

    // Fallback: calculate based on content length
    return Math.max(1, content.length * 10);
  }
  // Create document tool
  createCreateDocumentTool() {
    return this.createTool(
      "docs_create_document",
      "Create a new Google Doc with optional content",
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
                        location: {
                          index: 1,
                        },
                        text: content,
                      },
                    },
                  ],
                },
              });
            }

            return doc;
          });

          if (!result.data.documentId) {
            throw new Error("Failed to create document - no document ID returned from content insertion");
          }

          logger.info(`[DOCS] Document created successfully: ${result.data.documentId}`);

          return {
            success: true,
            documentId: result.data.documentId,
            title: result.data.title,
            url: `https://docs.google.com/document/d/${result.data.documentId}/edit`,
          };
        } catch (error) {
          logger.error("[DOCS] Create document failed:", error);
          return {
            success: false,
            error: (error as Error).message || "Failed to create document",
          };
        }
      }
    );
  }
}

// Factory functions for registry
export const createDocsGetContentTool = (userId: string) =>
  new DocsToolSuite(userId).createGetContentTool();

export const createDocsAppendTextTool = (userId: string) =>
  new DocsToolSuite(userId).createAppendTextTool();

export const createDocsCreateDocumentTool = (userId: string) =>
  new DocsToolSuite(userId).createCreateDocumentTool();
