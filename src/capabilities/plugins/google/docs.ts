import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GOOGLE DOCS TOOLS
// ============================================

export class GoogleDocsGetDocTool extends BaseTool {
  name = 'google_docs_get_doc';
  description = 'Get the content and metadata of a Google Doc.';
  
  inputSchema = z.object({
    documentId: z.string().describe('Google Docs document ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_docs_get_doc(params, integration);
  }
}

export class GoogleDocsCreateDocTool extends BaseTool {
  name = 'google_docs_create_doc';
  description = 'Create a new Google Doc (requires Google integration, falls back to mock when not connected).';
  
  inputSchema = z.object({
    title: z.string().describe('Document title')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_docs_create_doc(params, integration);
  }
}

export class GoogleDocsEditDocTool extends BaseTool {
  name = 'google_docs_edit_doc';
  description = 'Edit a Google Doc with batch update requests.';
  
  inputSchema = z.object({
    documentId: z.string().describe('Google Docs document ID'),
    requests: z.array(z.any()).optional().describe('Array of batch update requests'),
    text: z.string().optional().describe('Simple text to insert'),
    index: z.number().optional().default(1).describe('Index position to insert text')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_docs_edit_doc(params, integration);
  }
}

export class GoogleDocsInsertTextTool extends BaseTool {
  name = 'google_docs_insert_text';
  description = 'Insert text into a Google Doc at a specific position.';
  
  inputSchema = z.object({
    documentId: z.string().describe('Google Docs document ID'),
    text: z.string().describe('Text to insert'),
    index: z.number().optional().default(1).describe('Index position to insert text')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_docs_insert_text(params, integration);
  }
}
