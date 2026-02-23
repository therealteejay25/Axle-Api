# Google Calendar Tools Summary

## Overview
Comprehensive Google Calendar tool suite with 13 tools for managing calendars, events, and meetings.

## Tool Categories

### Calendar Management (2 tools)
- `gcal_list_calendars` - List all calendars the user has access to
- `gcal_create_calendar` - Create a new calendar

### Event Management (7 tools)
- `gcal_get_events` - Get events for a calendar with timeMin, timeMax, maxResults
- `gcal_get_event` - Get a specific event by ID
- `gcal_search_events` - Search events by text query
- `gcal_create_event` - Create event with full details (title, description, start, end, attendees, recurrence, reminders)
- `gcal_update_event` - Update any field of an existing event
- `gcal_delete_event` - Delete an event
- `gcal_quick_add` - Create event from natural language string (e.g., "Lunch with John tomorrow at noon")

### Event Discovery (2 tools)
- `gcal_list_today` - Get today's events
- `gcal_list_upcoming` - Get next N events from now

### Availability & RSVP (2 tools)
- `gcal_check_availability` - Check if a time slot is free across calendars (freebusy)
- `gcal_accept_event` - RSVP accept to an event invitation

## Implementation Details
- All tools extend `BaseGoogleTool`
- Uses Google Calendar API v3
- Proper error handling and logging with `[CALENDAR]` prefix
- Zod validation for all inputs
- Factory functions for each tool
- Main export function: `createCalendarTools(userId)`

## Total Tools: 13
