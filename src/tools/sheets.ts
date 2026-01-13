import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE SHEETS TOOL SUITE
// ============================================

export class SheetsToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Read values tool
  createReadValuesTool() {
    return this.createTool(
      "sheets_read_values",
      "Extract data from a range in Google Sheets",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        range: z.string().min(1, "Range is required (e.g., 'A1:D10', 'Sheet1!A1:B20')"),
        valueRenderOption: z.enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"]).optional().default("FORMATTED_VALUE"),
        dateTimeRenderOption: z.enum(["SERIAL_NUMBER", "FORMATTED_STRING"]).optional().default("FORMATTED_STRING"),
      }),
      async ({ spreadsheetId, range, valueRenderOption, dateTimeRenderOption }) => {
        logger.info(`[SHEETS] Reading values from ${spreadsheetId}, range: ${range}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const sheets = google.sheets({ version: "v4", auth: oauth2Client });

          return await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
            valueRenderOption,
            dateTimeRenderOption,
          });
        });

        const values = result.data.values || [];
        logger.info(`[SHEETS] Retrieved ${values.length} rows`);

        return {
          success: true,
          range: result.data.range,
          values,
          rowCount: values.length,
          columnCount: values.length > 0 ? values[0].length : 0,
        };
      }
    );
  }

  // Append row tool
  createAppendRowTool() {
    return this.createTool(
      "sheets_append_row",
      "Add data to the bottom of a Google Sheet",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        range: z.string().min(1, "Range is required (e.g., 'Sheet1!A:A')"),
        values: z.array(z.array(z.any())).min(1, "At least one row of data is required"),
        valueInputOption: z.enum(["RAW", "USER_ENTERED"]).optional().default("USER_ENTERED"),
        insertDataOption: z.enum(["OVERWRITE", "INSERT_ROWS"]).optional().default("INSERT_ROWS"),
      }),
      async ({ spreadsheetId, range, values, valueInputOption, insertDataOption }) => {
        logger.info(`[SHEETS] Appending ${values.length} rows to ${spreadsheetId}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const sheets = google.sheets({ version: "v4", auth: oauth2Client });

          return await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption,
            insertDataOption,
            requestBody: {
              values,
            },
          });
        });

        logger.info(`[SHEETS] Successfully appended rows`);

        return {
          success: true,
          spreadsheetId,
          updatedRange: result.data.updates?.updatedRange,
          updatedRows: result.data.updates?.updatedRows,
          updatedColumns: result.data.updates?.updatedColumns,
          updatedCells: result.data.updates?.updatedCells,
        };
      }
    );
  }

  // Update cell tool
  createUpdateCellTool() {
    return this.createTool(
      "sheets_update_cell",
      "Change specific data points in Google Sheets",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        range: z.string().min(1, "Range is required (e.g., 'Sheet1!A1', 'B2:C3')"),
        values: z.array(z.array(z.any())).min(1, "Values are required"),
        valueInputOption: z.enum(["RAW", "USER_ENTERED"]).optional().default("USER_ENTERED"),
      }),
      async ({ spreadsheetId, range, values, valueInputOption }) => {
        logger.info(`[SHEETS] Updating cells in ${spreadsheetId}, range: ${range}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const sheets = google.sheets({ version: "v4", auth: oauth2Client });

          return await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption,
            requestBody: {
              values,
            },
          });
        });

        logger.info(`[SHEETS] Successfully updated cells`);

        return {
          success: true,
          spreadsheetId,
          updatedRange: result.data.updatedRange,
          updatedRows: result.data.updatedRows,
          updatedColumns: result.data.updatedColumns,
          updatedCells: result.data.updatedCells,
        };
      }
    );
  }
}

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
        logger.info(`[DOCS] Getting content from document: ${documentId}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const docs = google.docs({ version: "v1", auth: oauth2Client });

          return await docs.documents.get({
            documentId,
          });
        });

        // Extract text content from the document structure
        const content = this.extractTextFromDoc(result.data);
        logger.info(`[DOCS] Extracted ${content.length} characters of text`);

        return {
          success: true,
          documentId,
          title: result.data.title,
          content,
          contentLength: content.length,
        };
      }
    );
  }

  // Append text tool
  createAppendTextTool() {
    return this.createTool(
      "docs_append_text",
      "Write summary reports to the end of a Google Doc",
      z.object({
        documentId: z.string().min(1, "Document ID is required"),
        text: z.string().min(1, "Text to append is required"),
      }),
      async ({ documentId, text }) => {
        logger.info(`[DOCS] Appending text to document: ${documentId}`);

        // First get the document to find the end
        const docResult = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const docs = google.docs({ version: "v1", auth: oauth2Client });

          return await docs.documents.get({
            documentId,
          });
        });

        const endOfDoc = this.findEndOfDocument(docResult.data);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const docs = google.docs({ version: "v1", auth: oauth2Client });

          return await docs.documents.batchUpdate({
            documentId,
            requestBody: {
              requests: [
                {
                  insertText: {
                    location: {
                      index: endOfDoc,
                    },
                    text: `\n\n${text}`,
                  },
                },
              ],
            },
          });
        });

        logger.info(`[DOCS] Successfully appended text`);

        return {
          success: true,
          documentId,
          appendedText: text,
          textLength: text.length,
        };
      }
    );
  }

  // Helper method to extract text from Google Docs structure
  private extractTextFromDoc(document: any): string {
    const content = document.body?.content || [];
    let text = "";

    for (const element of content) {
      if (element.paragraph) {
        for (const paragraphElement of element.paragraph.elements || []) {
          if (paragraphElement.textRun) {
            text += paragraphElement.textRun.content || "";
          }
        }
      }
    }

    return text;
  }

  // Helper method to find the end of document index
  private findEndOfDocument(document: any): number {
    const content = document.body?.content || [];
    if (content.length === 0) return 1;

    // Find the last element and its end index
    const lastElement = content[content.length - 1];
    return lastElement.endIndex || 1;
  }
}

// Factory functions for registry
// Sheets tools
export const createSheetsReadValuesTool = (userId: string) =>
  new SheetsToolSuite(userId).createReadValuesTool();

export const createSheetsAppendRowTool = (userId: string) =>
  new SheetsToolSuite(userId).createAppendRowTool();

export const createSheetsUpdateCellTool = (userId: string) =>
  new SheetsToolSuite(userId).createUpdateCellTool();

// Docs tools
export const createDocsGetContentTool = (userId: string) =>
  new DocsToolSuite(userId).createGetContentTool();

export const createDocsAppendTextTool = (userId: string) =>
  new DocsToolSuite(userId).createAppendTextTool();
