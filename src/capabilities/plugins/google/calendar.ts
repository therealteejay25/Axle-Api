import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GOOGLE CALENDAR TOOLS
// ============================================

export class GoogleCalendarListEventsTool extends BaseTool {
  name = 'google_calendar_list_events';
  description = 'List events from Google Calendar.';
  
  inputSchema = z.object({
    calendarId: z.string().optional().default('primary').describe('Calendar ID'),
    timeMin: z.string().optional().describe('ISO 8601 datetime - start of time range'),
    timeMax: z.string().optional().describe('ISO 8601 datetime - end of time range'),
    maxResults: z.number().optional().default(10).describe('Maximum number of events')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_calendar_list_events(params, integration);
  }
}

export class GoogleCalendarGetEventTool extends BaseTool {
  name = 'google_calendar_get_event';
  description = 'Get details of a specific calendar event.';
  
  inputSchema = z.object({
    calendarId: z.string().optional().default('primary').describe('Calendar ID'),
    eventId: z.string().describe('Event ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_calendar_get_event(params, integration);
  }
}

export class GoogleCalendarCreateEventTool extends BaseTool {
  name = 'google_calendar_create_event';
  description = 'Create a new calendar event.';
  
  inputSchema = z.object({
    calendarId: z.string().optional().default('primary').describe('Calendar ID'),
    summary: z.string().describe('Event title/summary'),
    description: z.string().optional().describe('Event description'),
    startTime: z.string().describe('ISO 8601 datetime - event start'),
    endTime: z.string().describe('ISO 8601 datetime - event end'),
    attendees: z.array(z.string().email()).optional().describe('Attendee email addresses'),
    location: z.string().optional().describe('Event location')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_calendar_create_event(params, integration);
  }
}

export class GoogleCalendarUpdateEventTool extends BaseTool {
  name = 'google_calendar_update_event';
  description = 'Update an existing calendar event.';
  
  inputSchema = z.object({
    calendarId: z.string().optional().default('primary').describe('Calendar ID'),
    eventId: z.string().describe('Event ID'),
    summary: z.string().optional().describe('Event title'),
    description: z.string().optional().describe('Event description'),
    startTime: z.string().optional().describe('ISO 8601 datetime - event start'),
    endTime: z.string().optional().describe('ISO 8601 datetime - event end')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_calendar_update_event(params, integration);
  }
}

export class GoogleCalendarDeleteEventTool extends BaseTool {
  name = 'google_calendar_delete_event';
  description = 'Delete a calendar event.';
  
  inputSchema = z.object({
    calendarId: z.string().optional().default('primary').describe('Calendar ID'),
    eventId: z.string().describe('Event ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('google');
    const { googleActions } = require('../../../adapters/google');
    return googleActions.google_calendar_delete_event(params, integration);
  }
}
