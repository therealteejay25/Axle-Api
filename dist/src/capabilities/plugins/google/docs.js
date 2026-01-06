"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDocsInsertTextTool = exports.GoogleDocsEditDocTool = exports.GoogleDocsCreateDocTool = exports.GoogleDocsGetDocTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GOOGLE DOCS TOOLS
// ============================================
class GoogleDocsGetDocTool extends BaseTool_1.BaseTool {
    name = 'google_docs_get_doc';
    description = 'Get the content and metadata of a Google Doc.';
    inputSchema = zod_1.z.object({
        documentId: zod_1.z.string().describe('Google Docs document ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_docs_get_doc(params, integration);
    }
}
exports.GoogleDocsGetDocTool = GoogleDocsGetDocTool;
class GoogleDocsCreateDocTool extends BaseTool_1.BaseTool {
    name = 'google_docs_create_doc';
    description = 'Create a new Google Doc.';
    inputSchema = zod_1.z.object({
        title: zod_1.z.string().describe('Document title')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_docs_create_doc(params, integration);
    }
}
exports.GoogleDocsCreateDocTool = GoogleDocsCreateDocTool;
class GoogleDocsEditDocTool extends BaseTool_1.BaseTool {
    name = 'google_docs_edit_doc';
    description = 'Edit a Google Doc with batch update requests.';
    inputSchema = zod_1.z.object({
        documentId: zod_1.z.string().describe('Google Docs document ID'),
        requests: zod_1.z.array(zod_1.z.any()).optional().describe('Array of batch update requests'),
        text: zod_1.z.string().optional().describe('Simple text to insert'),
        index: zod_1.z.number().optional().default(1).describe('Index position to insert text')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_docs_edit_doc(params, integration);
    }
}
exports.GoogleDocsEditDocTool = GoogleDocsEditDocTool;
class GoogleDocsInsertTextTool extends BaseTool_1.BaseTool {
    name = 'google_docs_insert_text';
    description = 'Insert text into a Google Doc at a specific position.';
    inputSchema = zod_1.z.object({
        documentId: zod_1.z.string().describe('Google Docs document ID'),
        text: zod_1.z.string().describe('Text to insert'),
        index: zod_1.z.number().optional().default(1).describe('Index position to insert text')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_docs_insert_text(params, integration);
    }
}
exports.GoogleDocsInsertTextTool = GoogleDocsInsertTextTool;
