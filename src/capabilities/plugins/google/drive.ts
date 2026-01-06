import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GOOGLE DRIVE TOOLS
// ============================================

export class GoogleDriveListFilesTool extends BaseTool {
  name = 'google_drive_list_files';
  description = 'List files in Google Drive with optional query filter.';
  
  inputSchema = z.object({
    query: z.string().optional().describe('Drive search query (e.g., "name contains \'report\'")'),
    pageSize: z.number().optional().default(10).describe('Number of files to return')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_drive_list_files(params, integration);
  }
}

export class GoogleDriveDeleteFileTool extends BaseTool {
  name = 'google_drive_delete_file';
  description = 'Delete a file from Google Drive.';
  
  inputSchema = z.object({
    fileId: z.string().describe('Google Drive file ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_drive_delete_file(params, integration);
  }
}
