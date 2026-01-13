import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE CALENDAR TOOL SUITE
// ============================================

export class CalendarToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // List events tool
  createListEventsTool() {
    return this.createTool(
      "list_events",
      "List upcoming events from Google Calendar",
      z.object({
        calendarId: z.string().default("primary").describe("Calendar ID (defaults to primary)"),
        maxResults: z.number().min(1).max(100).default(10).describe("Maximum number of events to return"),
        timeMin: z.string().optional().describe("Start time in RFC3339 format (defaults to now)"),
        timeMax: z.string().optional().describe("End time in RFC3339 format"),
        query: z.string().optional().describe("Search query to filter events"),
        singleEvents: z.boolean().default(true).describe("Expand recurring events into individual instances"),
      }),
      async ({ calendarId, maxResults, timeMin, timeMax, query, singleEvents }) => {
        logger.info(`[CALENDAR] Listing events for calendar: ${calendarId}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });

          return await calendar.events.list({
            calendarId,
            maxResults,
            timeMin: timeMin || new Date().toISOString(),
            timeMax,
            q: query,
            singleEvents,
            orderBy: "startTime",
          });
        });

        const events = result.data.items || [];
        logger.info(`[CALENDAR] Found ${events.length} events`);

        return {
          success: true,
          events: events.map(event => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start,
            end: event.end,
            location: event.location,
            status: event.status,
            htmlLink: event.htmlLink,
            created: event.created,
            updated: event.updated,
          })),
          totalCount: events.length,
        };
      }
    );
  }

  // Create event tool
  createCreateEventTool() {
    return this.createTool(
      "calendar_create_event",
      "Add a meeting with title, time, and location",
      z.object({
        calendarId: z.string().default("primary").describe("Calendar ID (defaults to primary)"),
        summary: z.string().min(1, "Event summary cannot be empty"),
        description: z.string().optional().describe("Event description"),
        start: z.object({
          dateTime: z.string().optional().describe("Start time in RFC3339 format"),
          timeZone: z.string().optional().describe("Timezone (e.g., 'America/New_York')"),
        }),
        end: z.object({
          dateTime: z.string().optional().describe("End time in RFC3339 format"),
          timeZone: z.string().optional().describe("Timezone (e.g., 'America/New_York')"),
        }),
        location: z.string().optional().describe("Event location"),
        attendees: z.array(z.object({
          email: z.string().email(),
          displayName: z.string().optional(),
        })).optional().describe("List of attendees"),
      }),
      async ({ calendarId, summary, description, start, end, location, attendees }) => {
        try {
          logger.info(`[CALENDAR] Creating event: ${summary}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            const event = {
              summary,
              description,
              start,
              end,
              location,
              attendees: attendees?.map(attendee => ({
                email: attendee.email,
                displayName: attendee.displayName,
              })),
            };

            return await calendar.events.insert({
              calendarId,
              requestBody: event,
            });
          });

          logger.info(`[CALENDAR] Event created successfully. ID: ${result.data.id}`);

          return {
            success: true,
            data: {
              id: result.data.id,
              summary: result.data.summary,
              htmlLink: result.data.htmlLink,
              created: result.data.created,
              updated: result.data.updated,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] Create event failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create event",
          };
        }
      }
    );
  }

  // Delete event tool
  createDeleteEventTool() {
    return this.createTool(
      "delete_event",
      "Delete an event from Google Calendar",
      z.object({
        calendarId: z.string().default("primary").describe("Calendar ID (defaults to primary)"),
        eventId: z.string().min(1, "Event ID is required"),
      }),
      async ({ calendarId, eventId }) => {
        logger.info(`[CALENDAR] Deleting event: ${eventId}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });

          return await calendar.events.delete({
            calendarId,
            eventId,
          });
        });

        logger.info(`[CALENDAR] Event deleted successfully`);

        return {
          success: true,
          message: `Event deleted successfully`,
          eventId,
        };
      }
    );
  }

  // Update event tool
  createUpdateEventTool() {
    return this.createTool(
      "update_event",
      "Update an existing event in Google Calendar",
      z.object({
        calendarId: z.string().default("primary").describe("Calendar ID (defaults to primary)"),
        eventId: z.string().min(1, "Event ID is required"),
        summary: z.string().optional().describe("Updated event title"),
        description: z.string().optional().describe("Updated event description"),
        start: z.object({
          dateTime: z.string().optional().describe("Updated start time in RFC3339 format"),
          timeZone: z.string().optional().describe("Updated timezone"),
        }).optional(),
        end: z.object({
          dateTime: z.string().optional().describe("Updated end time in RFC3339 format"),
          timeZone: z.string().optional().describe("Updated timezone"),
        }).optional(),
        location: z.string().optional().describe("Updated event location"),
      }),
      async ({ calendarId, eventId, summary, description, start, end, location }) => {
        logger.info(`[CALENDAR] Updating event: ${eventId}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });

          const updates: any = {};
          if (summary !== undefined) updates.summary = summary;
          if (description !== undefined) updates.description = description;
          if (start) updates.start = start;
          if (end) updates.end = end;
          if (location !== undefined) updates.location = location;

          return await calendar.events.update({
            calendarId,
            eventId,
            requestBody: updates,
          });
        });

        logger.info(`[CALENDAR] Event updated successfully`);

        return {
          success: true,
          message: `Event updated successfully`,
          event: {
            id: result.data.id,
            summary: result.data.summary,
            htmlLink: result.data.htmlLink,
            updated: result.data.updated,
          },
        };
      }
    );
  }

  // Get free busy tool
  createGetFreeBusyToolLegacy() {
    return this.createTool(
      "get_free_busy",
      "Check free/busy times for calendars without revealing private details",
      z.object({
        calendarIds: z.array(z.string()).min(1, "At least one calendar ID is required"),
        timeMin: z.string().describe("Start time in RFC3339 format"),
        timeMax: z.string().describe("End time in RFC3339 format"),
      }),
      async ({ calendarIds, timeMin, timeMax }) => {
        logger.info(`[CALENDAR] Checking free/busy for ${calendarIds.length} calendars`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });

          return await calendar.freebusy.query({
            requestBody: {
              timeMin,
              timeMax,
              items: calendarIds.map(id => ({ id })),
            },
          });
        });

        logger.info(`[CALENDAR] Retrieved free/busy information`);

        return {
          success: true,
          freeBusy: Object.entries(result.data.calendars || {}).map(([calendarId, calendarData]: [string, any]) => ({
            calendarId,
            busy: calendarData.busy?.map((busy: any) => ({
              start: busy.start,
              end: busy.end,
            })) || [],
          })),
        };
      }
    );
  }

  // List calendars tool
  createListCalendarsTool() {
    return this.createTool(
      "list_calendars",
      "Get all calendars that the user has access to",
      z.object({
        maxResults: z.number().min(1).max(100).default(25).describe("Maximum number of calendars to return"),
      }),
      async ({ maxResults }) => {
        logger.info(`[CALENDAR] Listing calendars`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });

          return await calendar.calendarList.list({
            maxResults,
          });
        });

        const calendars = result.data.items || [];
        logger.info(`[CALENDAR] Found ${calendars.length} calendars`);

        return {
          success: true,
          calendars: calendars.map(cal => ({
            id: cal.id,
            summary: cal.summary,
            description: cal.description,
            primary: cal.primary,
            accessRole: cal.accessRole,
            backgroundColor: cal.backgroundColor,
          })),
          totalCount: calendars.length,
        };
      }
    );
  }

  // Add attendee tool
  createAddAttendeeTool() {
    return this.createTool(
      "add_attendee",
      "Add an email address to an existing calendar event",
      z.object({
        calendarId: z.string().default("primary").describe("Calendar ID (defaults to primary)"),
        eventId: z.string().min(1, "Event ID is required"),
        email: z.string().email("Must be a valid email address"),
        displayName: z.string().optional().describe("Display name for the attendee"),
      }),
      async ({ calendarId, eventId, email, displayName }) => {
        logger.info(`[CALENDAR] Adding attendee ${email} to event ${eventId}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });

          // First get the current event
          const event = await calendar.events.get({
            calendarId,
            eventId,
          });

          // Add the new attendee to existing attendees
          const currentAttendees = event.data.attendees || [];
          const newAttendee = {
            email,
            ...(displayName && { displayName }),
          };

          // Check if attendee already exists
          const existingAttendee = currentAttendees.find((a: any) => a.email === email);
          if (existingAttendee) {
            throw new Error(`Attendee ${email} is already added to this event`);
          }

          // Update the event with new attendee
          return await calendar.events.update({
            calendarId,
            eventId,
            requestBody: {
              ...event.data,
              attendees: [...currentAttendees, newAttendee],
            },
          });
        });

        logger.info(`[CALENDAR] Attendee added successfully`);

        return {
          success: true,
          message: `Attendee ${email} added to event successfully`,
          eventId,
          attendee: {
            email,
            displayName,
          },
        };
      }
    );
  }

  // Get free busy tool
  createGetFreeBusyTool() {
    return this.createTool(
      "calendar_get_free_busy",
      "Check availability without reading private details",
      z.object({
        timeMin: z.string().describe("Start time in RFC3339 format"),
        timeMax: z.string().describe("End time in RFC3339 format"),
        calendarIds: z
          .array(z.string())
          .optional()
          .describe("Calendar IDs to check (defaults to primary)"),
      }),
      async ({ timeMin, timeMax, calendarIds }) => {
        try {
          logger.info(`[CALENDAR] Getting free/busy information`);

          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const calendar = google.calendar({ version: "v3", auth: oauth2Client });

              return await calendar.freebusy.query({
                requestBody: {
                  timeMin,
                  timeMax,
                  items: (calendarIds || ["primary"]).map((id) => ({ id })),
                },
              });
            }
          );

          logger.info(`[CALENDAR] Retrieved free/busy data`);

          return {
            success: true,
            data: {
              calendars: result.data.calendars,
              timeMin,
              timeMax,
            },
          };
        } catch (error) {
          logger.error("[CALENDAR] Get free busy failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get free/busy information",
          };
        }
      }
    );
  }

  // List calendars tool
  createListCalendarsTool() {
    return this.createTool(
      "calendar_list_calendars",
      "Get all calendars the user has access to",
      z.object({
        maxResults: z
          .number()
          .min(1)
          .max(250)
          .default(25)
          .describe("Maximum number of calendars to return"),
        showHidden: z
          .boolean()
          .default(false)
          .describe("Include hidden calendars"),
      }),
      async ({ maxResults, showHidden }) => {
        try {
          logger.info(`[CALENDAR] Listing calendars`);

          const result = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const calendar = google.calendar({ version: "v3", auth: oauth2Client });

              return await calendar.calendarList.list({
                maxResults,
                showHidden,
              });
            }
          );

          const calendars = result.data.items || [];
          logger.info(`[CALENDAR] Found ${calendars.length} calendars`);

          return {
            success: true,
            data: {
              calendars: calendars.map((cal: any) => ({
                id: cal.id,
                name: cal.summary,
                description: cal.description,
                primary: cal.primary,
                accessRole: cal.accessRole,
                backgroundColor: cal.backgroundColor,
                foregroundColor: cal.foregroundColor,
              })),
              totalCount: calendars.length,
            },
          };
        } catch (error) {
          logger.error("[CALENDAR] List calendars failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list calendars",
          };
        }
      }
    );
  }

  // Add attendee tool
  createAddAttendeeTool() {
    return this.createTool(
      "calendar_add_attendee",
      "Add an email to an existing event",
      z.object({
        calendarId: z.string().default("primary").describe("Calendar ID"),
        eventId: z.string().min(1, "Event ID is required"),
        email: z.string().email("Must be a valid email address"),
        displayName: z.string().optional().describe("Display name for the attendee"),
      }),
      async ({ calendarId, eventId, email, displayName }) => {
        try {
          logger.info(`[CALENDAR] Adding attendee ${email} to event ${eventId}`);

          // First get the current event
          const getResult = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const calendar = google.calendar({ version: "v3", auth: oauth2Client });

              return await calendar.events.get({
                calendarId,
                eventId,
              });
            }
          );

          const currentEvent = getResult.data;
          const currentAttendees = currentEvent.attendees || [];

          // Check if attendee already exists
          const existingAttendee = currentAttendees.find(
            (attendee: any) => attendee.email === email
          );

          if (existingAttendee) {
            return {
              success: false,
              error: `Attendee ${email} is already added to this event`,
            };
          }

          // Add new attendee
          const newAttendee = {
            email,
            displayName,
          };

          const updateResult = await this.executeGoogleRequest(
            async (oauth2Client) => {
              const { google } = await import("googleapis");
              const calendar = google.calendar({ version: "v3", auth: oauth2Client });

              return await calendar.events.update({
                calendarId,
                eventId,
                requestBody: {
                  ...currentEvent,
                  attendees: [...currentAttendees, newAttendee],
                },
              });
            }
          );

          logger.info(`[CALENDAR] Attendee added successfully`);

          return {
            success: true,
            data: {
              eventId,
              attendee: {
                email,
                displayName,
              },
              totalAttendees: (updateResult.data.attendees || []).length,
            },
          };
        } catch (error) {
          logger.error("[CALENDAR] Add attendee failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add attendee",
          };
        }
      }
    );
  }
}

// Factory functions for registry
export const createListEventsTool = (userId: string) =>
  new CalendarToolSuite(userId).createListEventsTool();

export const createCreateEventTool = (userId: string) =>
  new CalendarToolSuite(userId).createCreateEventTool();

export const createUpdateEventTool = (userId: string) =>
  new CalendarToolSuite(userId).createUpdateEventTool();

export const createDeleteEventTool = (userId: string) =>
  new CalendarToolSuite(userId).createDeleteEventTool();

export const createGetFreeBusyTool = (userId: string) =>
  new CalendarToolSuite(userId).createGetFreeBusyTool();

export const createListCalendarsTool = (userId: string) =>
  new CalendarToolSuite(userId).createListCalendarsTool();

export const createAddAttendeeTool = (userId: string) =>
  new CalendarToolSuite(userId).createAddAttendeeTool();

