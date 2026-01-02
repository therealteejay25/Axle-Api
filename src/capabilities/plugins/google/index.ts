import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GMAIL
// ============================================

export class GmailSendEmailTool extends BaseTool {
  name = 'gmail_send_email';
  description = 'Send an email via Gmail.';
  inputSchema = z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string()
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_gmail_send_email(params, integration);
  }
}

export class GmailListEmailsTool extends BaseTool {
    name = 'gmail_list_emails';
    description = 'List or search emails.';
    inputSchema = z.object({
        query: z.string().optional(),
        limit: z.number().default(10)
    });
    
    async runImpl(params: any, context: ToolContext) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_gmail_list_emails({ query: params.query, maxResults: params.limit }, integration);
    }
}

// ============================================
// GOOGLE CALENDAR
// ============================================

export class CalendarListEventsTool extends BaseTool {
  name = 'calendar_list_events';
  description = 'List upcoming calendar events.';
  inputSchema = z.object({
    timeMin: z.string().optional().describe('ISO date string for start time'),
    maxResults: z.number().default(10)
  });

  async runImpl(params: any, context: ToolContext) {
     const integration = context.integrations.get('google');
     const { googleActions } = require('../../../adapters/google');
     return googleActions.google_calendar_list_events(params, integration);
  }
}

export class CalendarCreateEventTool extends BaseTool {
    name = 'calendar_create_event';
    description = 'Create a new calendar event.';
    inputSchema = z.object({
        summary: z.string(),
        startTime: z.string().describe('ISO date string'),
        endTime: z.string().describe('ISO date string'),
        attendees: z.array(z.string().email()).optional()
    });
    
    async runImpl(params: any, context: ToolContext) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_calendar_create_event(params, integration);
    }
}

// ============================================
// GOOGLE DRIVE
// ============================================

export class DriveListFilesTool extends BaseTool {
    name = 'drive_list_files';
    description = 'List files in Google Drive.';
    inputSchema = z.object({
        query: z.string().optional(),
        pageSize: z.number().default(10)
    });
    
    async runImpl(params: any, context: ToolContext) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        // Adapting to hypothetical adapter method if not present
        return googleActions.google_drive_list_files ? 
               googleActions.google_drive_list_files(params, integration) :
               { error: 'Method not implemented in adapter' };
    }
}

// ============================================
// GOOGLE DOCS
// ============================================

export class DocsCreateTool extends BaseTool {
    name = 'docs_create';
    description = 'Create a new Google Doc.';
    inputSchema = z.object({
        title: z.string()
    });
    
    async runImpl(params: any, context: ToolContext) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        const result = await googleActions.google_docs_create_doc(params, integration);
        
        // Share state
        if (context.session?.state) {
            context.session.state.set('last_doc', { id: result.documentId, title: result.title });
        }
        return result;
    }
}
