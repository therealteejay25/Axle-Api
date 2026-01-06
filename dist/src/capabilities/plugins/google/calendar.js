"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCalendarDeleteEventTool = exports.GoogleCalendarUpdateEventTool = exports.GoogleCalendarCreateEventTool = exports.GoogleCalendarGetEventTool = exports.GoogleCalendarListEventsTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GOOGLE CALENDAR TOOLS
// ============================================
class GoogleCalendarListEventsTool extends BaseTool_1.BaseTool {
    name = 'google_calendar_list_events';
    description = 'List events from Google Calendar.';
    inputSchema = zod_1.z.object({
        calendarId: zod_1.z.string().optional().default('primary').describe('Calendar ID'),
        timeMin: zod_1.z.string().optional().describe('ISO 8601 datetime - start of time range'),
        timeMax: zod_1.z.string().optional().describe('ISO 8601 datetime - end of time range'),
        maxResults: zod_1.z.number().optional().default(10).describe('Maximum number of events')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_calendar_list_events(params, integration);
    }
}
exports.GoogleCalendarListEventsTool = GoogleCalendarListEventsTool;
class GoogleCalendarGetEventTool extends BaseTool_1.BaseTool {
    name = 'google_calendar_get_event';
    description = 'Get details of a specific calendar event.';
    inputSchema = zod_1.z.object({
        calendarId: zod_1.z.string().optional().default('primary').describe('Calendar ID'),
        eventId: zod_1.z.string().describe('Event ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_calendar_get_event(params, integration);
    }
}
exports.GoogleCalendarGetEventTool = GoogleCalendarGetEventTool;
class GoogleCalendarCreateEventTool extends BaseTool_1.BaseTool {
    name = 'google_calendar_create_event';
    description = 'Create a new calendar event.';
    inputSchema = zod_1.z.object({
        calendarId: zod_1.z.string().optional().default('primary').describe('Calendar ID'),
        summary: zod_1.z.string().describe('Event title/summary'),
        description: zod_1.z.string().optional().describe('Event description'),
        startTime: zod_1.z.string().describe('ISO 8601 datetime - event start'),
        endTime: zod_1.z.string().describe('ISO 8601 datetime - event end'),
        attendees: zod_1.z.array(zod_1.z.string().email()).optional().describe('Attendee email addresses'),
        location: zod_1.z.string().optional().describe('Event location')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_calendar_create_event(params, integration);
    }
}
exports.GoogleCalendarCreateEventTool = GoogleCalendarCreateEventTool;
class GoogleCalendarUpdateEventTool extends BaseTool_1.BaseTool {
    name = 'google_calendar_update_event';
    description = 'Update an existing calendar event.';
    inputSchema = zod_1.z.object({
        calendarId: zod_1.z.string().optional().default('primary').describe('Calendar ID'),
        eventId: zod_1.z.string().describe('Event ID'),
        summary: zod_1.z.string().optional().describe('Event title'),
        description: zod_1.z.string().optional().describe('Event description'),
        startTime: zod_1.z.string().optional().describe('ISO 8601 datetime - event start'),
        endTime: zod_1.z.string().optional().describe('ISO 8601 datetime - event end')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_calendar_update_event(params, integration);
    }
}
exports.GoogleCalendarUpdateEventTool = GoogleCalendarUpdateEventTool;
class GoogleCalendarDeleteEventTool extends BaseTool_1.BaseTool {
    name = 'google_calendar_delete_event';
    description = 'Delete a calendar event.';
    inputSchema = zod_1.z.object({
        calendarId: zod_1.z.string().optional().default('primary').describe('Calendar ID'),
        eventId: zod_1.z.string().describe('Event ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('google');
        const { googleActions } = require('../../../adapters/google');
        return googleActions.google_calendar_delete_event(params, integration);
    }
}
exports.GoogleCalendarDeleteEventTool = GoogleCalendarDeleteEventTool;
