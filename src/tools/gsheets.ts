import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE SHEETS TOOL SUITE - COMPREHENSIVE
// ============================================

export class SheetsToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Create spreadsheet
  createCreateTool() {
    return this.createTool(
      "gsheets_create",
      "Create a new spreadsheet with optional title and sheets",
      z.object({
        title: z.string().min(1, "Title is required"),
        sheetTitles: z.array(z.string()).optional().describe("Names of sheets to create"),
      }),
      async ({ title, sheetTitles }) => {
        try {
          logger.info(`[SHEETS] Creating spreadsheet: ${title}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            const sheets_data = sheetTitles?.map(title => ({ properties: { title } })) || [];

            return await sheets.spreadsheets.create({
              requestBody: {
                properties: { title },
                sheets: sheets_data.length > 0 ? sheets_data : undefined,
              },
            });
          });

          logger.info(`[SHEETS] Spreadsheet created: ${result.data.spreadsheetId}`);

          return {
            success: true,
            data: {
              spreadsheetId: result.data.spreadsheetId,
              title: result.data.properties?.title,
              url: result.data.spreadsheetUrl,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Create failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create spreadsheet",
          };
        }
      }
    );
  }

  // Get values
  createGetValuesTool() {
    return this.createTool(
      "gsheets_get_values",
      "Read values from a range (A1 notation)",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        range: z.string().min(1, "Range is required (e.g., 'A1:D10', 'Sheet1!A1:B20')"),
        valueRenderOption: z.enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"]).default("FORMATTED_VALUE").optional(),
      }),
      async ({ spreadsheetId, range, valueRenderOption }) => {
        try {
          logger.info(`[SHEETS] Getting values from ${range}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.values.get({
              spreadsheetId,
              range,
              valueRenderOption,
            });
          });

          const values = result.data.values || [];
          logger.info(`[SHEETS] Retrieved ${values.length} rows`);

          return {
            success: true,
            data: {
              range: result.data.range,
              values,
              rowCount: values.length,
              columnCount: values.length > 0 ? values[0].length : 0,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Get values failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get values",
          };
        }
      }
    );
  }

  // Batch get
  createBatchGetTool() {
    return this.createTool(
      "gsheets_batch_get",
      "Read multiple ranges at once",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        ranges: z.array(z.string()).min(1, "At least one range is required"),
        valueRenderOption: z.enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"]).default("FORMATTED_VALUE").optional(),
      }),
      async ({ spreadsheetId, ranges, valueRenderOption }) => {
        try {
          logger.info(`[SHEETS] Batch getting ${ranges.length} ranges`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.values.batchGet({
              spreadsheetId,
              ranges,
              valueRenderOption,
            });
          });

          const valueRanges = result.data.valueRanges || [];
          logger.info(`[SHEETS] Retrieved ${valueRanges.length} ranges`);

          return {
            success: true,
            data: {
              valueRanges: valueRanges.map((vr: any) => ({
                range: vr.range,
                values: vr.values || [],
              })),
              totalRanges: valueRanges.length,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Batch get failed:", error);
          return {
            success: false,
            error: error.message || "Failed to batch get values",
          };
        }
      }
    );
  }

  // Update values
  createUpdateValuesTool() {
    return this.createTool(
      "gsheets_update_values",
      "Write values to a range",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        range: z.string().min(1, "Range is required"),
        values: z.array(z.array(z.any())).min(1, "Values are required"),
        valueInputOption: z.enum(["RAW", "USER_ENTERED"]).default("USER_ENTERED").optional(),
      }),
      async ({ spreadsheetId, range, values, valueInputOption }) => {
        try {
          logger.info(`[SHEETS] Updating values in ${range}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.values.update({
              spreadsheetId,
              range,
              valueInputOption,
              requestBody: { values },
            });
          });

          logger.info(`[SHEETS] Updated ${result.data.updatedCells} cells`);

          return {
            success: true,
            data: {
              updatedRange: result.data.updatedRange,
              updatedRows: result.data.updatedRows,
              updatedColumns: result.data.updatedColumns,
              updatedCells: result.data.updatedCells,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Update values failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update values",
          };
        }
      }
    );
  }

  // Batch update
  createBatchUpdateTool() {
    return this.createTool(
      "gsheets_batch_update",
      "Write to multiple ranges in one call",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        data: z.array(z.object({
          range: z.string(),
          values: z.array(z.array(z.any())),
        })).min(1, "At least one range is required"),
        valueInputOption: z.enum(["RAW", "USER_ENTERED"]).default("USER_ENTERED").optional(),
      }),
      async ({ spreadsheetId, data, valueInputOption }) => {
        try {
          logger.info(`[SHEETS] Batch updating ${data.length} ranges`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.values.batchUpdate({
              spreadsheetId,
              requestBody: {
                data,
                valueInputOption,
              },
            });
          });

          logger.info(`[SHEETS] Batch update completed`);

          return {
            success: true,
            data: {
              totalUpdatedRows: result.data.totalUpdatedRows,
              totalUpdatedColumns: result.data.totalUpdatedColumns,
              totalUpdatedCells: result.data.totalUpdatedCells,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Batch update failed:", error);
          return {
            success: false,
            error: error.message || "Failed to batch update",
          };
        }
      }
    );
  }

  // Append values
  createAppendValuesTool() {
    return this.createTool(
      "gsheets_append_values",
      "Append rows to the end of a sheet",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        range: z.string().min(1, "Range is required"),
        values: z.array(z.array(z.any())).min(1, "Values are required"),
        valueInputOption: z.enum(["RAW", "USER_ENTERED"]).default("USER_ENTERED").optional(),
      }),
      async ({ spreadsheetId, range, values, valueInputOption }) => {
        try {
          logger.info(`[SHEETS] Appending ${values.length} rows`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.values.append({
              spreadsheetId,
              range,
              valueInputOption,
              requestBody: { values },
            });
          });

          logger.info(`[SHEETS] Appended successfully`);

          return {
            success: true,
            data: {
              updatedRange: result.data.updates?.updatedRange,
              updatedRows: result.data.updates?.updatedRows,
              updatedCells: result.data.updates?.updatedCells,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Append values failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append values",
          };
        }
      }
    );
  }

  // Clear range
  createClearRangeTool() {
    return this.createTool(
      "gsheets_clear_range",
      "Clear values from a range",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        range: z.string().min(1, "Range is required"),
      }),
      async ({ spreadsheetId, range }) => {
        try {
          logger.info(`[SHEETS] Clearing range ${range}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.values.clear({
              spreadsheetId,
              range,
            });
          });

          logger.info(`[SHEETS] Range cleared successfully`);

          return {
            success: true,
            message: "Range cleared successfully",
          };
        } catch (error: any) {
          logger.error("[SHEETS] Clear range failed:", error);
          return {
            success: false,
            error: error.message || "Failed to clear range",
          };
        }
      }
    );
  }

  // Get sheet names
  createGetSheetNamesTool() {
    return this.createTool(
      "gsheets_get_sheet_names",
      "List all sheets/tabs in a spreadsheet",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
      }),
      async ({ spreadsheetId }) => {
        try {
          logger.info(`[SHEETS] Getting sheet names`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.get({
              spreadsheetId,
            });
          });

          const sheetNames = result.data.sheets?.map((sheet: any) => ({
            sheetId: sheet.properties?.sheetId,
            title: sheet.properties?.title,
            index: sheet.properties?.index,
          })) || [];

          logger.info(`[SHEETS] Found ${sheetNames.length} sheets`);

          return {
            success: true,
            data: {
              sheets: sheetNames,
              totalCount: sheetNames.length,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Get sheet names failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get sheet names",
          };
        }
      }
    );
  }

  // Add sheet
  createAddSheetTool() {
    return this.createTool(
      "gsheets_add_sheet",
      "Add a new sheet/tab",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        title: z.string().min(1, "Sheet title is required"),
      }),
      async ({ spreadsheetId, title }) => {
        try {
          logger.info(`[SHEETS] Adding sheet: ${title}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    addSheet: {
                      properties: { title },
                    },
                  },
                ],
              },
            });
          });

          const sheetId = result.data.replies?.[0]?.addSheet?.properties?.sheetId;
          logger.info(`[SHEETS] Sheet added with ID: ${sheetId}`);

          return {
            success: true,
            data: {
              sheetId,
              title,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Add sheet failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add sheet",
          };
        }
      }
    );
  }

  // Delete sheet
  createDeleteSheetTool() {
    return this.createTool(
      "gsheets_delete_sheet",
      "Delete a sheet/tab",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
      }),
      async ({ spreadsheetId, sheetId }) => {
        try {
          logger.info(`[SHEETS] Deleting sheet ID: ${sheetId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    deleteSheet: { sheetId },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Sheet deleted successfully`);

          return {
            success: true,
            message: "Sheet deleted successfully",
          };
        } catch (error: any) {
          logger.error("[SHEETS] Delete sheet failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete sheet",
          };
        }
      }
    );
  }

  // Rename sheet
  createRenameSheetTool() {
    return this.createTool(
      "gsheets_rename_sheet",
      "Rename a sheet/tab",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        newTitle: z.string().min(1, "New title is required"),
      }),
      async ({ spreadsheetId, sheetId, newTitle }) => {
        try {
          logger.info(`[SHEETS] Renaming sheet ID ${sheetId} to: ${newTitle}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    updateSheetProperties: {
                      properties: {
                        sheetId,
                        title: newTitle,
                      },
                      fields: "title",
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Sheet renamed successfully`);

          return {
            success: true,
            message: `Sheet renamed to "${newTitle}"`,
          };
        } catch (error: any) {
          logger.error("[SHEETS] Rename sheet failed:", error);
          return {
            success: false,
            error: error.message || "Failed to rename sheet",
          };
        }
      }
    );
  }

  // Duplicate sheet
  createDuplicateSheetTool() {
    return this.createTool(
      "gsheets_duplicate_sheet",
      "Duplicate a sheet within the spreadsheet",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sourceSheetId: z.number().min(0, "Source sheet ID is required"),
        newSheetName: z.string().optional().describe("Name for the duplicated sheet"),
      }),
      async ({ spreadsheetId, sourceSheetId, newSheetName }) => {
        try {
          logger.info(`[SHEETS] Duplicating sheet ID: ${sourceSheetId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    duplicateSheet: {
                      sourceSheetId,
                      newSheetName,
                    },
                  },
                ],
              },
            });
          });

          const newSheetId = result.data.replies?.[0]?.duplicateSheet?.properties?.sheetId;
          logger.info(`[SHEETS] Sheet duplicated with ID: ${newSheetId}`);

          return {
            success: true,
            data: {
              newSheetId,
              newSheetName: result.data.replies?.[0]?.duplicateSheet?.properties?.title,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Duplicate sheet failed:", error);
          return {
            success: false,
            error: error.message || "Failed to duplicate sheet",
          };
        }
      }
    );
  }

  // Find and replace
  createFindReplaceTool() {
    return this.createTool(
      "gsheets_find_replace",
      "Find and replace values across the sheet",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        find: z.string().min(1, "Text to find is required"),
        replacement: z.string().describe("Replacement text"),
        sheetId: z.number().optional().describe("Specific sheet ID (optional, searches all if not provided)"),
        matchCase: z.boolean().default(false).optional(),
        matchEntireCell: z.boolean().default(false).optional(),
      }),
      async ({ spreadsheetId, find, replacement, sheetId, matchCase, matchEntireCell }) => {
        try {
          logger.info(`[SHEETS] Finding and replacing: "${find}" with "${replacement}"`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    findReplace: {
                      find,
                      replacement,
                      sheetId,
                      matchCase,
                      matchEntireCell,
                      allSheets: sheetId === undefined,
                    },
                  },
                ],
              },
            });
          });

          const occurrences = result.data.replies?.[0]?.findReplace?.occurrencesChanged || 0;
          logger.info(`[SHEETS] Replaced ${occurrences} occurrences`);

          return {
            success: true,
            data: {
              occurrencesChanged: occurrences,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Find replace failed:", error);
          return {
            success: false,
            error: error.message || "Failed to find and replace",
          };
        }
      }
    );
  }

  // Format range
  createFormatRangeTool() {
    return this.createTool(
      "gsheets_format_range",
      "Apply formatting (bold, color, alignment, number format) to a range",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        startRowIndex: z.number().min(0),
        endRowIndex: z.number().min(0),
        startColumnIndex: z.number().min(0),
        endColumnIndex: z.number().min(0),
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
        backgroundColor: z.object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1),
        }).optional(),
        horizontalAlignment: z.enum(["LEFT", "CENTER", "RIGHT"]).optional(),
        numberFormat: z.string().optional().describe("Number format pattern (e.g., '0.00', '$#,##0.00')"),
      }),
      async ({ spreadsheetId, sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, bold, italic, backgroundColor, horizontalAlignment, numberFormat }) => {
        try {
          logger.info(`[SHEETS] Formatting range`);

          const cellFormat: any = {};
          if (bold !== undefined || italic !== undefined) {
            cellFormat.textFormat = {};
            if (bold !== undefined) cellFormat.textFormat.bold = bold;
            if (italic !== undefined) cellFormat.textFormat.italic = italic;
          }
          if (backgroundColor) {
            cellFormat.backgroundColor = backgroundColor;
          }
          if (horizontalAlignment) {
            cellFormat.horizontalAlignment = horizontalAlignment;
          }
          if (numberFormat) {
            cellFormat.numberFormat = { type: "NUMBER", pattern: numberFormat };
          }

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    repeatCell: {
                      range: {
                        sheetId,
                        startRowIndex,
                        endRowIndex,
                        startColumnIndex,
                        endColumnIndex,
                      },
                      cell: {
                        userEnteredFormat: cellFormat,
                      },
                      fields: Object.keys(cellFormat).map(k => `userEnteredFormat.${k}`).join(","),
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Range formatted successfully`);

          return {
            success: true,
            message: "Range formatted successfully",
          };
        } catch (error: any) {
          logger.error("[SHEETS] Format range failed:", error);
          return {
            success: false,
            error: error.message || "Failed to format range",
          };
        }
      }
    );
  }

  // Auto resize columns
  createAutoResizeColumnsTool() {
    return this.createTool(
      "gsheets_auto_resize_columns",
      "Auto-resize columns to fit content",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        startColumnIndex: z.number().min(0),
        endColumnIndex: z.number().min(0),
      }),
      async ({ spreadsheetId, sheetId, startColumnIndex, endColumnIndex }) => {
        try {
          logger.info(`[SHEETS] Auto-resizing columns ${startColumnIndex}-${endColumnIndex}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    autoResizeDimensions: {
                      dimensions: {
                        sheetId,
                        dimension: "COLUMNS",
                        startIndex: startColumnIndex,
                        endIndex: endColumnIndex,
                      },
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Columns auto-resized successfully`);

          return {
            success: true,
            message: "Columns auto-resized successfully",
          };
        } catch (error: any) {
          logger.error("[SHEETS] Auto resize columns failed:", error);
          return {
            success: false,
            error: error.message || "Failed to auto-resize columns",
          };
        }
      }
    );
  }

  // Freeze rows
  createFreezeRowsTool() {
    return this.createTool(
      "gsheets_freeze_rows",
      "Freeze top N rows",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        frozenRowCount: z.number().min(0).max(10, "Maximum 10 rows can be frozen"),
      }),
      async ({ spreadsheetId, sheetId, frozenRowCount }) => {
        try {
          logger.info(`[SHEETS] Freezing ${frozenRowCount} rows`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    updateSheetProperties: {
                      properties: {
                        sheetId,
                        gridProperties: {
                          frozenRowCount,
                        },
                      },
                      fields: "gridProperties.frozenRowCount",
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Rows frozen successfully`);

          return {
            success: true,
            message: `${frozenRowCount} rows frozen successfully`,
          };
        } catch (error: any) {
          logger.error("[SHEETS] Freeze rows failed:", error);
          return {
            success: false,
            error: error.message || "Failed to freeze rows",
          };
        }
      }
    );
  }

  // Add chart (simplified)
  createAddChartTool() {
    return this.createTool(
      "gsheets_add_chart",
      "Create a chart from a data range",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        chartType: z.enum(["LINE", "BAR", "COLUMN", "PIE", "SCATTER"]),
        dataRange: z.object({
          sheetId: z.number(),
          startRowIndex: z.number(),
          endRowIndex: z.number(),
          startColumnIndex: z.number(),
          endColumnIndex: z.number(),
        }),
        title: z.string().optional(),
      }),
      async ({ spreadsheetId, sheetId, chartType, dataRange, title }) => {
        try {
          logger.info(`[SHEETS] Adding ${chartType} chart`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    addChart: {
                      chart: {
                        spec: {
                          title,
                          basicChart: {
                            chartType,
                            domains: [{
                              domain: { sourceRange: { sources: [dataRange] } },
                            }],
                            series: [{
                              series: { sourceRange: { sources: [dataRange] } },
                            }],
                          },
                        },
                        position: {
                          overlayPosition: {
                            anchorCell: { sheetId, rowIndex: 0, columnIndex: 0 },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Chart added successfully`);

          return {
            success: true,
            message: "Chart added successfully",
          };
        } catch (error: any) {
          logger.error("[SHEETS] Add chart failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add chart",
          };
        }
      }
    );
  }

  // Sort range
  createSortRangeTool() {
    return this.createTool(
      "gsheets_sort_range",
      "Sort a range by a column",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        startRowIndex: z.number().min(0),
        endRowIndex: z.number().min(0),
        startColumnIndex: z.number().min(0),
        endColumnIndex: z.number().min(0),
        sortColumnIndex: z.number().min(0).describe("Column index to sort by"),
        ascending: z.boolean().default(true).optional(),
      }),
      async ({ spreadsheetId, sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, sortColumnIndex, ascending }) => {
        try {
          logger.info(`[SHEETS] Sorting range by column ${sortColumnIndex}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    sortRange: {
                      range: {
                        sheetId,
                        startRowIndex,
                        endRowIndex,
                        startColumnIndex,
                        endColumnIndex,
                      },
                      sortSpecs: [
                        {
                          dimensionIndex: sortColumnIndex,
                          sortOrder: ascending ? "ASCENDING" : "DESCENDING",
                        },
                      ],
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Range sorted successfully`);

          return {
            success: true,
            message: "Range sorted successfully",
          };
        } catch (error: any) {
          logger.error("[SHEETS] Sort range failed:", error);
          return {
            success: false,
            error: error.message || "Failed to sort range",
          };
        }
      }
    );
  }

  // Create filter view
  createFilterViewTool() {
    return this.createTool(
      "gsheets_filter_view",
      "Create a filter view",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        title: z.string().min(1, "Filter view title is required"),
        startRowIndex: z.number().min(0),
        endRowIndex: z.number().min(0),
        startColumnIndex: z.number().min(0),
        endColumnIndex: z.number().min(0),
      }),
      async ({ spreadsheetId, sheetId, title, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex }) => {
        try {
          logger.info(`[SHEETS] Creating filter view: ${title}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    addFilterView: {
                      filter: {
                        title,
                        range: {
                          sheetId,
                          startRowIndex,
                          endRowIndex,
                          startColumnIndex,
                          endColumnIndex,
                        },
                      },
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Filter view created successfully`);

          return {
            success: true,
            message: `Filter view "${title}" created successfully`,
          };
        } catch (error: any) {
          logger.error("[SHEETS] Create filter view failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create filter view",
          };
        }
      }
    );
  }

  // Protect range
  createProtectRangeTool() {
    return this.createTool(
      "gsheets_protect_range",
      "Protect a range from editing",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        startRowIndex: z.number().min(0),
        endRowIndex: z.number().min(0),
        startColumnIndex: z.number().min(0),
        endColumnIndex: z.number().min(0),
        description: z.string().optional(),
      }),
      async ({ spreadsheetId, sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, description }) => {
        try {
          logger.info(`[SHEETS] Protecting range`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    addProtectedRange: {
                      protectedRange: {
                        range: {
                          sheetId,
                          startRowIndex,
                          endRowIndex,
                          startColumnIndex,
                          endColumnIndex,
                        },
                        description,
                        warningOnly: false,
                      },
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Range protected successfully`);

          return {
            success: true,
            message: "Range protected successfully",
          };
        } catch (error: any) {
          logger.error("[SHEETS] Protect range failed:", error);
          return {
            success: false,
            error: error.message || "Failed to protect range",
          };
        }
      }
    );
  }

  // Get formulas
  createGetFormulasTool() {
    return this.createTool(
      "gsheets_get_formulas",
      "Get formulas (not values) from a range",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        range: z.string().min(1, "Range is required"),
      }),
      async ({ spreadsheetId, range }) => {
        try {
          logger.info(`[SHEETS] Getting formulas from ${range}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.values.get({
              spreadsheetId,
              range,
              valueRenderOption: "FORMULA",
            });
          });

          const formulas = result.data.values || [];
          logger.info(`[SHEETS] Retrieved ${formulas.length} rows of formulas`);

          return {
            success: true,
            data: {
              range: result.data.range,
              formulas,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Get formulas failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get formulas",
          };
        }
      }
    );
  }

  // Validate range
  createValidateRangeTool() {
    return this.createTool(
      "gsheets_validate_range",
      "Add data validation to a range (dropdown, number, date)",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        startRowIndex: z.number().min(0),
        endRowIndex: z.number().min(0),
        startColumnIndex: z.number().min(0),
        endColumnIndex: z.number().min(0),
        validationType: z.enum(["ONE_OF_LIST", "NUMBER_GREATER", "NUMBER_LESS", "DATE_AFTER", "DATE_BEFORE"]),
        values: z.array(z.string()).optional().describe("For ONE_OF_LIST validation"),
        condition: z.any().optional().describe("For other validation types"),
      }),
      async ({ spreadsheetId, sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, validationType, values, condition }) => {
        try {
          logger.info(`[SHEETS] Adding data validation: ${validationType}`);

          const rule: any = { condition: { type: validationType } };
          if (validationType === "ONE_OF_LIST" && values) {
            rule.condition.values = values.map(v => ({ userEnteredValue: v }));
          } else if (condition) {
            rule.condition = condition;
          }

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    setDataValidation: {
                      range: {
                        sheetId,
                        startRowIndex,
                        endRowIndex,
                        startColumnIndex,
                        endColumnIndex,
                      },
                      rule,
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Data validation added successfully`);

          return {
            success: true,
            message: "Data validation added successfully",
          };
        } catch (error: any) {
          logger.error("[SHEETS] Validate range failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add data validation",
          };
        }
      }
    );
  }

  // Add conditional format
  createAddConditionalFormatTool() {
    return this.createTool(
      "gsheets_add_conditional_format",
      "Add conditional formatting rules",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        startRowIndex: z.number().min(0),
        endRowIndex: z.number().min(0),
        startColumnIndex: z.number().min(0),
        endColumnIndex: z.number().min(0),
        conditionType: z.enum(["NUMBER_GREATER", "NUMBER_LESS", "TEXT_CONTAINS", "CUSTOM_FORMULA"]),
        conditionValue: z.string().describe("Value or formula for the condition"),
        backgroundColor: z.object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1),
        }).optional(),
      }),
      async ({ spreadsheetId, sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, conditionType, conditionValue, backgroundColor }) => {
        try {
          logger.info(`[SHEETS] Adding conditional format: ${conditionType}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    addConditionalFormatRule: {
                      rule: {
                        ranges: [{
                          sheetId,
                          startRowIndex,
                          endRowIndex,
                          startColumnIndex,
                          endColumnIndex,
                        }],
                        booleanRule: {
                          condition: {
                            type: conditionType,
                            values: [{ userEnteredValue: conditionValue }],
                          },
                          format: {
                            backgroundColor: backgroundColor || { red: 1, green: 0.9, blue: 0.9 },
                          },
                        },
                      },
                      index: 0,
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Conditional format added successfully`);

          return {
            success: true,
            message: "Conditional format added successfully",
          };
        } catch (error: any) {
          logger.error("[SHEETS] Add conditional format failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add conditional format",
          };
        }
      }
    );
  }

  // Merge cells
  createMergeCellsTool() {
    return this.createTool(
      "gsheets_merge_cells",
      "Merge a range of cells",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
        startRowIndex: z.number().min(0),
        endRowIndex: z.number().min(0),
        startColumnIndex: z.number().min(0),
        endColumnIndex: z.number().min(0),
        mergeType: z.enum(["MERGE_ALL", "MERGE_COLUMNS", "MERGE_ROWS"]).default("MERGE_ALL").optional(),
      }),
      async ({ spreadsheetId, sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, mergeType }) => {
        try {
          logger.info(`[SHEETS] Merging cells with type: ${mergeType}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const sheets = google.sheets({ version: "v4", auth: oauth2Client });

            return await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    mergeCells: {
                      range: {
                        sheetId,
                        startRowIndex,
                        endRowIndex,
                        startColumnIndex,
                        endColumnIndex,
                      },
                      mergeType,
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SHEETS] Cells merged successfully`);

          return {
            success: true,
            message: "Cells merged successfully",
          };
        } catch (error: any) {
          logger.error("[SHEETS] Merge cells failed:", error);
          return {
            success: false,
            error: error.message || "Failed to merge cells",
          };
        }
      }
    );
  }

  // Export CSV
  createExportCsvTool() {
    return this.createTool(
      "gsheets_export_csv",
      "Export a sheet as CSV text",
      z.object({
        spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
        sheetId: z.number().min(0, "Sheet ID is required"),
      }),
      async ({ spreadsheetId, sheetId }) => {
        try {
          logger.info(`[SHEETS] Exporting sheet as CSV`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.export({
              fileId: spreadsheetId,
              mimeType: "text/csv",
            }, {
              responseType: "text",
            });
          });

          logger.info(`[SHEETS] CSV exported successfully`);

          return {
            success: true,
            data: {
              csv: result.data as string,
              downloadUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetId}`,
            },
          };
        } catch (error: any) {
          logger.error("[SHEETS] Export CSV failed:", error);
          return {
            success: false,
            error: error.message || "Failed to export CSV",
          };
        }
      }
    );
  }
}


// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

export const createCreateTool = (userId: string) =>
  new SheetsToolSuite(userId).createCreateTool();

export const createGetValuesTool = (userId: string) =>
  new SheetsToolSuite(userId).createGetValuesTool();

export const createBatchGetTool = (userId: string) =>
  new SheetsToolSuite(userId).createBatchGetTool();

export const createUpdateValuesTool = (userId: string) =>
  new SheetsToolSuite(userId).createUpdateValuesTool();

export const createBatchUpdateTool = (userId: string) =>
  new SheetsToolSuite(userId).createBatchUpdateTool();

export const createAppendValuesTool = (userId: string) =>
  new SheetsToolSuite(userId).createAppendValuesTool();

export const createClearRangeTool = (userId: string) =>
  new SheetsToolSuite(userId).createClearRangeTool();

export const createGetSheetNamesTool = (userId: string) =>
  new SheetsToolSuite(userId).createGetSheetNamesTool();

export const createAddSheetTool = (userId: string) =>
  new SheetsToolSuite(userId).createAddSheetTool();

export const createDeleteSheetTool = (userId: string) =>
  new SheetsToolSuite(userId).createDeleteSheetTool();

export const createRenameSheetTool = (userId: string) =>
  new SheetsToolSuite(userId).createRenameSheetTool();

export const createDuplicateSheetTool = (userId: string) =>
  new SheetsToolSuite(userId).createDuplicateSheetTool();

export const createFindReplaceTool = (userId: string) =>
  new SheetsToolSuite(userId).createFindReplaceTool();

export const createFormatRangeTool = (userId: string) =>
  new SheetsToolSuite(userId).createFormatRangeTool();

export const createAutoResizeColumnsTool = (userId: string) =>
  new SheetsToolSuite(userId).createAutoResizeColumnsTool();

export const createFreezeRowsTool = (userId: string) =>
  new SheetsToolSuite(userId).createFreezeRowsTool();

export const createAddChartTool = (userId: string) =>
  new SheetsToolSuite(userId).createAddChartTool();

export const createSortRangeTool = (userId: string) =>
  new SheetsToolSuite(userId).createSortRangeTool();

export const createFilterViewTool = (userId: string) =>
  new SheetsToolSuite(userId).createFilterViewTool();

export const createProtectRangeTool = (userId: string) =>
  new SheetsToolSuite(userId).createProtectRangeTool();

export const createGetFormulasTool = (userId: string) =>
  new SheetsToolSuite(userId).createGetFormulasTool();

export const createValidateRangeTool = (userId: string) =>
  new SheetsToolSuite(userId).createValidateRangeTool();

export const createAddConditionalFormatTool = (userId: string) =>
  new SheetsToolSuite(userId).createAddConditionalFormatTool();

export const createMergeCellsTool = (userId: string) =>
  new SheetsToolSuite(userId).createMergeCellsTool();

export const createExportCsvTool = (userId: string) =>
  new SheetsToolSuite(userId).createExportCsvTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createSheetsTools = (userId: string) => {
  const suite = new SheetsToolSuite(userId);
  return [
    suite.createCreateTool(),
    suite.createGetValuesTool(),
    suite.createBatchGetTool(),
    suite.createUpdateValuesTool(),
    suite.createBatchUpdateTool(),
    suite.createAppendValuesTool(),
    suite.createClearRangeTool(),
    suite.createGetSheetNamesTool(),
    suite.createAddSheetTool(),
    suite.createDeleteSheetTool(),
    suite.createRenameSheetTool(),
    suite.createDuplicateSheetTool(),
    suite.createFindReplaceTool(),
    suite.createFormatRangeTool(),
    suite.createAutoResizeColumnsTool(),
    suite.createFreezeRowsTool(),
    suite.createAddChartTool(),
    suite.createSortRangeTool(),
    suite.createFilterViewTool(),
    suite.createProtectRangeTool(),
    suite.createGetFormulasTool(),
    suite.createValidateRangeTool(),
    suite.createAddConditionalFormatTool(),
    suite.createMergeCellsTool(),
    suite.createExportCsvTool(),
  ];
};
