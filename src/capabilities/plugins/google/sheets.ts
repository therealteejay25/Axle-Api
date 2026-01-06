import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GOOGLE SHEETS TOOLS
// ============================================

export class GoogleSheetsGetSheetTool extends BaseTool {
  name = 'google_sheets_get_sheet';
  description = 'Get metadata and properties of a Google Sheet.';
  
  inputSchema = z.object({
    spreadsheetId: z.string().describe('Google Sheets spreadsheet ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_sheets_get_sheet(params, integration);
  }
}

export class GoogleSheetsReadCellsTool extends BaseTool {
  name = 'google_sheets_read_cells';
  description = 'Read cell values from a Google Sheet range.';
  
  inputSchema = z.object({
    spreadsheetId: z.string().describe('Google Sheets spreadsheet ID'),
    range: z.string().describe('A1 notation range (e.g., "Sheet1!A1:D10")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_sheets_read_cells(params, integration);
  }
}

export class GoogleSheetsWriteCellsTool extends BaseTool {
  name = 'google_sheets_write_cells';
  description = 'Write values to a Google Sheet range.';
  
  inputSchema = z.object({
    spreadsheetId: z.string().describe('Google Sheets spreadsheet ID'),
    range: z.string().describe('A1 notation range (e.g., "Sheet1!A1:D10")'),
    values: z.array(z.array(z.any())).describe('2D array of values to write')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_sheets_write_cells(params, integration);
  }
}

export class GoogleSheetsUpdateRangeTool extends BaseTool {
  name = 'google_sheets_update_range';
  description = 'Update a range of cells in a Google Sheet.';
  
  inputSchema = z.object({
    spreadsheetId: z.string().describe('Google Sheets spreadsheet ID'),
    range: z.string().describe('A1 notation range'),
    values: z.array(z.array(z.any())).describe('2D array of values')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_sheets_update_range(params, integration);
  }
}
