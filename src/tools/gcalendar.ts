import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE CALENDAR TOOL SUITE - COMPREHENSIVE
// ============================================

export class CalendarToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // List calendars
  createListCalendarsTool() {
    return this.createTool(
      "gcal_list_calendars",
      "List all calendars the user has access to",
      z.object({
        maxResults: z.number().min(1).max(250).default(100).optional(),
      }),
      async ({ maxResults }) => {
        try {
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
            data: {
              calendars: calendars.map((cal: any) => ({
                id: cal.id,
                summary: cal.summary,
                description: cal.description,
                timeZone: cal.timeZone,
                primary: cal.primary,
                accessRole: cal.accessRole,
                backgroundColor: cal.backgroundColor,
              })),
              totalCount: calendars.length,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] List calendars failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list calendars",
          };
        }
      }
    );
  }

  // Get events
  createGetEventsTool() {
    return this.createTool(
      "gcal_get_events",
      "Get events for a calendar with timeMin, timeMax, maxResults",
      z.object({
        calendarId: z.string().default("primary"),
        timeMin: z.string().optional().describe("Start time (ISO 8601)"),
        timeMax: z.string().optional().describe("End time (ISO 8601)"),
        maxResults: z.number().min(1).max(2500).default(250).optional(),
        orderBy: z.enum(["startTime", "updated"]).optional(),
        singleEvents: z.boolean().default(true).optional(),
      }),
      async ({ calendarId, timeMin, timeMax, maxResults, orderBy, singleEvents }) => {
        try {
          logger.info(`[CALENDAR] Getting events for calendar: ${calendarId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            return await calendar.events.list({
              calendarId,
              timeMin,
              timeMax,
              maxResults,
              orderBy,
              singleEvents,
            });
          });

          const events = result.data.items || [];
          logger.info(`[CALENDAR] Found ${events.length} events`);

          return {
            success: true,
            data: {
              events: events.map((event: any) => ({
                id: event.id,
                summary: event.summary,
                description: event.description,
                start: event.start,
                end: event.end,
                location: event.location,
                attendees: event.attendees,
                status: event.status,
                htmlLink: event.htmlLink,
                hangoutLink: event.hangoutLink,
                conferenceData: event.conferenceData,
              })),
              totalCount: events.length,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] Get events failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get events",
          };
        }
      }
    );
  }

  // Get specific event
  createGetEventTool() {
    return this.createTool(
      "gcal_get_event",
      "Get a specific event by ID",
      z.object({
        calendarId: z.string().default("primary"),
        eventId: z.string().min(1, "Event ID is required"),
      }),
      async ({ calendarId, eventId }) => {
        try {
          logger.info(`[CALENDAR] Getting event: ${eventId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            return await calendar.events.get({
              calendarId,
              eventId,
            });
          });

          logger.info(`[CALENDAR] Retrieved event: ${result.data.summary}`);

          return {
            success: true,
            data: {
              id: result.data.id,
              summary: result.data.summary,
              description: result.data.description,
              start: result.data.start,
              end: result.data.end,
              location: result.data.location,
              attendees: result.data.attendees,
              status: result.data.status,
              htmlLink: result.data.htmlLink,
              hangoutLink: result.data.hangoutLink,
              conferenceData: result.data.conferenceData,
              recurrence: result.data.recurrence,
              reminders: result.data.reminders,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] Get event failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get event",
          };
        }
      }
    );
  }

  // Search events
  createSearchEventsTool() {
    return this.createTool(
      "gcal_search_events",
      "Search events by text query",
      z.object({
        calendarId: z.string().default("primary"),
        query: z.string().min(1, "Search query is required"),
        maxResults: z.number().min(1).max(2500).default(250).optional(),
      }),
      async ({ calendarId, query, maxResults }) => {
        try {
          logger.info(`[CALENDAR] Searching events: ${query}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            return await calendar.events.list({
              calendarId,
              q: query,
              maxResults,
              singleEvents: true,
            });
          });

          const events = result.data.items || [];
          logger.info(`[CALENDAR] Found ${events.length} events`);

          return {
            success: true,
            data: {
              events,
              totalCount: events.length,
              query,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] Search events failed:", error);
          return {
            success: false,
            error: error.message || "Failed to search events",
          };
        }
      }
    );
  }

  // Create event
  createCreateEventTool() {
    return this.createTool(
      "gcal_create_event",
      "Create event with title, description, start, end, timezone, attendees, location, recurrence, reminders",
      z.object({
        calendarId: z.string().default("primary"),
        summary: z.string().min(1, "Event title is required"),
        description: z.string().optional(),
        start: z.object({
          dateTime: z.string().optional(),
          date: z.string().optional(),
          timeZone: z.string().optional(),
        }),
        end: z.object({
          dateTime: z.string().optional(),
          date: z.string().optional(),
          timeZone: z.string().optional(),
        }),
        location: z.string().optional(),
        attendees: z.array(z.object({
          email: z.string().email(),
          optional: z.boolean().optional(),
        })).optional(),
        recurrence: z.array(z.string()).optional().describe("RRULE strings"),
        reminders: z.object({
          useDefault: z.boolean().optional(),
          overrides: z.array(z.object({
            method: z.enum(["email", "popup"]),
            minutes: z.number(),
          })).optional(),
        }).optional(),
      }),
      async ({ calendarId, summary, description, start, end, location, attendees, recurrence, reminders }) => {
        try {
          logger.info(`[CALENDAR] Creating event: ${summary}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            return await calendar.events.insert({
              calendarId,
              requestBody: {
                summary,
                description,
                start,
                end,
                location,
                attendees,
                recurrence,
                reminders,
              },
            });
          });

          logger.info(`[CALENDAR] Event created: ${result.data.id}`);

          return {
            success: true,
            message: `Event "${summary}" created successfully`,
            data: {
              eventId: result.data.id,
              htmlLink: result.data.htmlLink,
              hangoutLink: result.data.hangoutLink,
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

  // Update event
  createUpdateEventTool() {
    return this.createTool(
      "gcal_update_event",
      "Update any field of an existing event",
      z.object({
        calendarId: z.string().default("primary"),
        eventId: z.string().min(1, "Event ID is required"),
        summary: z.string().optional(),
        description: z.string().optional(),
        start: z.object({
          dateTime: z.string().optional(),
          date: z.string().optional(),
          timeZone: z.string().optional(),
        }).optional(),
        end: z.object({
          dateTime: z.string().optional(),
          date: z.string().optional(),
          timeZone: z.string().optional(),
        }).optional(),
        location: z.string().optional(),
        attendees: z.array(z.object({
          email: z.string().email(),
          optional: z.boolean().optional(),
        })).optional(),
      }),
      async ({ calendarId, eventId, ...updates }) => {
        try {
          logger.info(`[CALENDAR] Updating event: ${eventId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            // Get existing event first
            const existing = await calendar.events.get({ calendarId, eventId });

            return await calendar.events.update({
              calendarId,
              eventId,
              requestBody: {
                ...existing.data,
                ...updates,
              },
            });
          });

          logger.info(`[CALENDAR] Event updated successfully`);

          return {
            success: true,
            message: "Event updated successfully",
            data: {
              eventId: result.data.id,
              htmlLink: result.data.htmlLink,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] Update event failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update event",
          };
        }
      }
    );
  }

  // Delete event
  createDeleteEventTool() {
    return this.createTool(
      "gcal_delete_event",
      "Delete an event",
      z.object({
        calendarId: z.string().default("primary"),
        eventId: z.string().min(1, "Event ID is required"),
      }),
      async ({ calendarId, eventId }) => {
        try {
          logger.info(`[CALENDAR] Deleting event: ${eventId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
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
            message: "Event deleted successfully",
          };
        } catch (error: any) {
          logger.error("[CALENDAR] Delete event failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete event",
          };
        }
      }
    );
  }

  // Quick add
  createQuickAddTool() {
    return this.createTool(
      "gcal_quick_add",
      "Create event from natural language string",
      z.object({
        calendarId: z.string().default("primary"),
        text: z.string().min(1, "Event text is required (e.g., 'Lunch with John tomorrow at noon')"),
      }),
      async ({ calendarId, text }) => {
        try {
          logger.info(`[CALENDAR] Quick adding event: ${text}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            return await calendar.events.quickAdd({
              calendarId,
              text,
            });
          });

          logger.info(`[CALENDAR] Event quick added: ${result.data.id}`);

          return {
            success: true,
            message: "Event created successfully",
            data: {
              eventId: result.data.id,
              summary: result.data.summary,
              start: result.data.start,
              end: result.data.end,
              htmlLink: result.data.htmlLink,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] Quick add failed:", error);
          return {
            success: false,
            error: error.message || "Failed to quick add event",
          };
        }
      }
    );
  }

  // List today's events
  createListTodayTool() {
    return this.createTool(
      "gcal_list_today",
      "Get today's events",
      z.object({
        calendarId: z.string().default("primary"),
      }),
      async ({ calendarId }) => {
        try {
          logger.info(`[CALENDAR] Getting today's events`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

            return await calendar.events.list({
              calendarId,
              timeMin: startOfDay.toISOString(),
              timeMax: endOfDay.toISOString(),
              singleEvents: true,
              orderBy: "startTime",
            });
          });

          const events = result.data.items || [];
          logger.info(`[CALENDAR] Found ${events.length} events today`);

          return {
            success: true,
            data: {
              events,
              totalCount: events.length,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] List today failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list today's events",
          };
        }
      }
    );
  }

  // List upcoming events
  createListUpcomingTool() {
    return this.createTool(
      "gcal_list_upcoming",
      "Get next N events from now",
      z.object({
        calendarId: z.string().default("primary"),
        maxResults: z.number().min(1).max(250).default(10),
      }),
      async ({ calendarId, maxResults }) => {
        try {
          logger.info(`[CALENDAR] Getting upcoming events`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            return await calendar.events.list({
              calendarId,
              timeMin: new Date().toISOString(),
              maxResults,
              singleEvents: true,
              orderBy: "startTime",
            });
          });

          const events = result.data.items || [];
          logger.info(`[CALENDAR] Found ${events.length} upcoming events`);

          return {
            success: true,
            data: {
              events,
              totalCount: events.length,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] List upcoming failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list upcoming events",
          };
        }
      }
    );
  }

  // Check availability (freebusy)
  createCheckAvailabilityTool() {
    return this.createTool(
      "gcal_check_availability",
      "Check if a time slot is free across calendars",
      z.object({
        timeMin: z.string().describe("Start time (ISO 8601)"),
        timeMax: z.string().describe("End time (ISO 8601)"),
        calendarIds: z.array(z.string()).default(["primary"]),
      }),
      async ({ timeMin, timeMax, calendarIds }) => {
        try {
          logger.info(`[CALENDAR] Checking availability`);

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

          logger.info(`[CALENDAR] Availability checked`);

          return {
            success: true,
            data: {
              calendars: result.data.calendars,
              timeMin,
              timeMax,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] Check availability failed:", error);
          return {
            success: false,
            error: error.message || "Failed to check availability",
          };
        }
      }
    );
  }

  // RSVP Accept
  createAcceptEventTool() {
    return this.createTool(
      "gcal_accept_event",
      "RSVP accept to an event invitation",
      z.object({
        calendarId: z.string().default("primary"),
        eventId: z.string().min(1, "Event ID is required"),
      }),
      async ({ calendarId, eventId }) => {
        try {
          logger.info(`[CALENDAR] Accepting event: ${eventId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            const event = await calendar.events.get({ calendarId, eventId });
            const attendees = event.data.attendees || [];
            
            // Find current user and update response
            const updatedAttendees = attendees.map((att: any) => {
              if (att.self) {
                return { ...att, responseStatus: "accepted" };
              }
              return att;
            });

            return await calendar.events.patch({
              calendarId,
              eventId,
              requestBody: {
                attendees: updatedAttendees,
              },
            });
          });

          logger.info(`[CALENDAR] Event accepted`);

          return {
            success: true,
            message: "Event accepted successfully",
          };
        } catch (error: any) {
          logger.error("[CALENDAR] Accept event failed:", error);
          return {
            success: false,
            error: error.message || "Failed to accept event",
          };
        }
      }
    );
  }

  // Create calendar
  createCreateCalendarTool() {
    return this.createTool(
      "gcal_create_calendar",
      "Create a new calendar",
      z.object({
        summary: z.string().min(1, "Calendar name is required"),
        description: z.string().optional(),
        timeZone: z.string().optional(),
      }),
      async ({ summary, description, timeZone }) => {
        try {
          logger.info(`[CALENDAR] Creating calendar: ${summary}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            return await calendar.calendars.insert({
              requestBody: {
                summary,
                description,
                timeZone,
              },
            });
          });

          logger.info(`[CALENDAR] Calendar created: ${result.data.id}`);

          return {
            success: true,
            message: `Calendar "${summary}" created successfully`,
            data: {
              calendarId: result.data.id,
              summary: result.data.summary,
            },
          };
        } catch (error: any) {
          logger.error("[CALENDAR] Create calendar failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create calendar",
          };
        }
      }
    );
  }
}

// Factory functions
export const createListCalendarsTool = (userId: string) =>
  new CalendarToolSuite(userId).createListCalendarsTool();

export const createGetEventsTool = (userId: string) =>
  new CalendarToolSuite(userId).createGetEventsTool();

export const createGetEventTool = (userId: string) =>
  new CalendarToolSuite(userId).createGetEventTool();

export const createSearchEventsTool = (userId: string) =>
  new CalendarToolSuite(userId).createSearchEventsTool();

export const createCreateEventTool = (userId: string) =>
  new CalendarToolSuite(userId).createCreateEventTool();

export const createUpdateEventTool = (userId: string) =>
  new CalendarToolSuite(userId).createUpdateEventTool();

export const createDeleteEventTool = (userId: string) =>
  new CalendarToolSuite(userId).createDeleteEventTool();

export const createQuickAddTool = (userId: string) =>
  new CalendarToolSuite(userId).createQuickAddTool();

export const createListTodayTool = (userId: string) =>
  new CalendarToolSuite(userId).createListTodayTool();

export const createListUpcomingTool = (userId: string) =>
  new CalendarToolSuite(userId).createListUpcomingTool();

export const createCheckAvailabilityTool = (userId: string) =>
  new CalendarToolSuite(userId).createCheckAvailabilityTool();

export const createAcceptEventTool = (userId: string) =>
  new CalendarToolSuite(userId).createAcceptEventTool();

export const createCreateCalendarTool = (userId: string) =>
  new CalendarToolSuite(userId).createCreateCalendarTool();

export const createCalendarTools = (userId: string) => {
  const suite = new CalendarToolSuite(userId);
  return [
    suite.createListCalendarsTool(),
    suite.createGetEventsTool(),
    suite.createGetEventTool(),
    suite.createSearchEventsTool(),
    suite.createCreateEventTool(),
    suite.createUpdateEventTool(),
    suite.createDeleteEventTool(),
    suite.createQuickAddTool(),
    suite.createListTodayTool(),
    suite.createListUpcomingTool(),
    suite.createCheckAvailabilityTool(),
    suite.createAcceptEventTool(),
    suite.createCreateCalendarTool(),
  ];
};
