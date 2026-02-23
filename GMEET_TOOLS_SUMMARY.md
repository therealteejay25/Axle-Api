# Google Meet Tools Summary

## Overview
Google Meet tool suite with 3 tools for creating and managing Google Meet video conferences via Calendar API.

## Tool Categories

### Meeting Creation (3 tools)
- `gmeet_create_meeting` - Create a Calendar event with Google Meet link auto-generated (with title, description, start, end, attendees)
- `gmeet_get_meeting_link` - Get the Meet link for an existing calendar event
- `gmeet_schedule_instant` - Create an instant meeting (starts now) with Meet link and specified duration

## Implementation Details
- All tools extend `BaseGoogleTool`
- Uses Google Calendar API v3 with conferenceData
- Automatically generates Google Meet links via `conferenceDataVersion: 1`
- Proper error handling and logging with `[MEET]` prefix
- Zod validation for all inputs
- Factory functions for each tool
- Main export function: `createMeetTools(userId)`

## Total Tools: 3
