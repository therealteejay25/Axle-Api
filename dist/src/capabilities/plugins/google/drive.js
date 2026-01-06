"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveDeleteFileTool = exports.GoogleDriveListFilesTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GOOGLE DRIVE TOOLS
// ============================================
class GoogleDriveListFilesTool extends BaseTool_1.BaseTool {
    name = 'google_drive_list_files';
    description = 'List files in Google Drive with optional query filter.';
    inputSchema = zod_1.z.object({
        query: zod_1.z.string().optional().describe('Drive search query (e.g., "name contains \'report\'")'),
        pageSize: zod_1.z.number().optional().default(10).describe('Number of files to return')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_drive_list_files(params, integration);
    }
}
exports.GoogleDriveListFilesTool = GoogleDriveListFilesTool;
class GoogleDriveDeleteFileTool extends BaseTool_1.BaseTool {
    name = 'google_drive_delete_file';
    description = 'Delete a file from Google Drive.';
    inputSchema = zod_1.z.object({
        fileId: zod_1.z.string().describe('Google Drive file ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_drive_delete_file(params, integration);
    }
}
exports.GoogleDriveDeleteFileTool = GoogleDriveDeleteFileTool;
