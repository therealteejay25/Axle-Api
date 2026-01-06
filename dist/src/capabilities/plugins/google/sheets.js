"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSheetsUpdateRangeTool = exports.GoogleSheetsWriteCellsTool = exports.GoogleSheetsReadCellsTool = exports.GoogleSheetsGetSheetTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GOOGLE SHEETS TOOLS
// ============================================
class GoogleSheetsGetSheetTool extends BaseTool_1.BaseTool {
    name = 'google_sheets_get_sheet';
    description = 'Get metadata and properties of a Google Sheet.';
    inputSchema = zod_1.z.object({
        spreadsheetId: zod_1.z.string().describe('Google Sheets spreadsheet ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_sheets_get_sheet(params, integration);
    }
}
exports.GoogleSheetsGetSheetTool = GoogleSheetsGetSheetTool;
class GoogleSheetsReadCellsTool extends BaseTool_1.BaseTool {
    name = 'google_sheets_read_cells';
    description = 'Read cell values from a Google Sheet range.';
    inputSchema = zod_1.z.object({
        spreadsheetId: zod_1.z.string().describe('Google Sheets spreadsheet ID'),
        range: zod_1.z.string().describe('A1 notation range (e.g., "Sheet1!A1:D10")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_sheets_read_cells(params, integration);
    }
}
exports.GoogleSheetsReadCellsTool = GoogleSheetsReadCellsTool;
class GoogleSheetsWriteCellsTool extends BaseTool_1.BaseTool {
    name = 'google_sheets_write_cells';
    description = 'Write values to a Google Sheet range.';
    inputSchema = zod_1.z.object({
        spreadsheetId: zod_1.z.string().describe('Google Sheets spreadsheet ID'),
        range: zod_1.z.string().describe('A1 notation range (e.g., "Sheet1!A1:D10")'),
        values: zod_1.z.array(zod_1.z.array(zod_1.z.any())).describe('2D array of values to write')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_sheets_write_cells(params, integration);
    }
}
exports.GoogleSheetsWriteCellsTool = GoogleSheetsWriteCellsTool;
class GoogleSheetsUpdateRangeTool extends BaseTool_1.BaseTool {
    name = 'google_sheets_update_range';
    description = 'Update a range of cells in a Google Sheet.';
    inputSchema = zod_1.z.object({
        spreadsheetId: zod_1.z.string().describe('Google Sheets spreadsheet ID'),
        range: zod_1.z.string().describe('A1 notation range'),
        values: zod_1.z.array(zod_1.z.array(zod_1.z.any())).describe('2D array of values')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_sheets_update_range(params, integration);
    }
}
exports.GoogleSheetsUpdateRangeTool = GoogleSheetsUpdateRangeTool;
