import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE MEET TOOL SUITE (via Calendar API)
// ============================================

export class MeetToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Create meeting with Meet link
  createCreateMeetingTool() {
    return this.createTool(
      "gmeet_create_meeting",
      "Create a Calendar event with Google Meet link auto-generated",
      z.object({
        summary: z.string().min(1, "Meeting title is required"),
        description: z.string().optional(),
        start: z.object({
          dateTime: z.string(),
          timeZone: z.string().optional(),
        }),
        end: z.object({
          dateTime: z.string(),
          timeZone: z.string().optional(),
        }),
        attendees: z.array(z.object({
          email: z.string().email(),
        })).optional(),
      }),
      async ({ summary, description, start, end, attendees }) => {
        try {
          logger.info(`[MEET] Creating meeting: ${summary}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            return await calendar.events.insert({
              calendarId: "primary",
              conferenceDataVersion: 1,
              requestBody: {
                summary,
                description,
                start,
                end,
                attendees,
                conferenceData: {
                  createRequest: {
                    requestId: `meet-${Date.now()}`,
                    conferenceSolutionKey: { type: "hangoutsMeet" },
                  },
                },
              },
            });
          });

          const meetLink = result.data.hangoutLink || result.data.conferenceData?.entryPoints?.[0]?.uri;

          logger.info(`[MEET] Meeting created with link: ${meetLink}`);

          return {
            success: true,
            message: "Meeting created successfully",
            data: {
              eventId: result.data.id,
              meetLink,
              htmlLink: result.data.htmlLink,
            },
          };
        } catch (error: any) {
          logger.error("[MEET] Create meeting failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create meeting",
          };
        }
      }
    );
  }

  // Get Meet link from event
  createGetMeetingLinkTool() {
    return this.createTool(
      "gmeet_get_meeting_link",
      "Get the Meet link for an existing calendar event",
      z.object({
        eventId: z.string().min(1, "Event ID is required"),
        calendarId: z.string().default("primary"),
      }),
      async ({ eventId, calendarId }) => {
        try {
          logger.info(`[MEET] Getting Meet link for event: ${eventId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            return await calendar.events.get({
              calendarId,
              eventId,
            });
          });

          const meetLink = result.data.hangoutLink || result.data.conferenceData?.entryPoints?.[0]?.uri;

          return {
            success: true,
            data: {
              meetLink,
              eventId: result.data.id,
              summary: result.data.summary,
            },
          };
        } catch (error: any) {
          logger.error("[MEET] Get meeting link failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get meeting link",
          };
        }
      }
    );
  }

  // Schedule instant meeting
  createScheduleInstantTool() {
    return this.createTool(
      "gmeet_schedule_instant",
      "Create an instant meeting (starts now) with Meet link",
      z.object({
        summary: z.string().min(1, "Meeting title is required"),
        durationMinutes: z.number().min(15).max(480).default(60),
      }),
      async ({ summary, durationMinutes }) => {
        try {
          logger.info(`[MEET] Creating instant meeting: ${summary}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const calendar = google.calendar({ version: "v3", auth: oauth2Client });

            const now = new Date();
            const end = new Date(now.getTime() + durationMinutes * 60000);

            return await calendar.events.insert({
              calendarId: "primary",
              conferenceDataVersion: 1,
              requestBody: {
                summary,
                start: { dateTime: now.toISOString() },
                end: { dateTime: end.toISOString() },
                conferenceData: {
                  createRequest: {
                    requestId: `instant-${Date.now()}`,
                    conferenceSolutionKey: { type: "hangoutsMeet" },
                  },
                },
              },
            });
          });

          const meetLink = result.data.hangoutLink || result.data.conferenceData?.entryPoints?.[0]?.uri;

          return {
            success: true,
            message: "Instant meeting created",
            data: {
              eventId: result.data.id,
              meetLink,
              htmlLink: result.data.htmlLink,
            },
          };
        } catch (error: any) {
          logger.error("[MEET] Schedule instant failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create instant meeting",
          };
        }
      }
    );
  }
}

// Factory functions
export const createCreateMeetingTool = (userId: string) =>
  new MeetToolSuite(userId).createCreateMeetingTool();

export const createGetMeetingLinkTool = (userId: string) =>
  new MeetToolSuite(userId).createGetMeetingLinkTool();

export const createScheduleInstantTool = (userId: string) =>
  new MeetToolSuite(userId).createScheduleInstantTool();

export const createMeetTools = (userId: string) => {
  const suite = new MeetToolSuite(userId);
  return [
    suite.createCreateMeetingTool(),
    suite.createGetMeetingLinkTool(),
    suite.createScheduleInstantTool(),
  ];
};
