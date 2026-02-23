import { google } from "googleapis";
import { logger } from "../logger";

interface MeetResult {
  upcomingMeetings: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    meetLink: string;
    attendees: number;
    organizer: string;
  }>;
}

export async function meetFetcher(
  userId: string,
  integrations: any[]
): Promise<MeetResult | null> {
  try {
    // Find Google integration
    const googleIntegration = integrations.find(
      (i) => i.provider === "google" && i.userId.toString() === userId
    );

    if (!googleIntegration || !googleIntegration.accessToken) {
      logger.debug(`No Google integration found for user ${userId}`);
      return null;
    }

    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: googleIntegration.accessToken,
      refresh_token: googleIntegration.refreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Get upcoming meetings (next 7 days with Meet links)
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: nextWeek.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 20,
    });

    const events = response.data.items || [];

    // Filter events with Google Meet links
    const upcomingMeetings = events
      .filter(
        (event) =>
          event.hangoutLink ||
          event.conferenceData?.entryPoints?.some(
            (ep) => ep.entryPointType === "video"
          )
      )
      .slice(0, 10)
      .map((event) => ({
        id: event.id || "",
        title: event.summary || "(No Title)",
        start: event.start?.dateTime || event.start?.date || "",
        end: event.end?.dateTime || event.end?.date || "",
        meetLink:
          event.hangoutLink ||
          event.conferenceData?.entryPoints?.find(
            (ep) => ep.entryPointType === "video"
          )?.uri ||
          "",
        attendees: event.attendees?.length || 0,
        organizer:
          event.organizer?.displayName ||
          event.organizer?.email ||
          "Unknown",
      }));

    return {
      upcomingMeetings,
    };
  } catch (error: any) {
    logger.error(`Meet fetcher error for user ${userId}:`, error);
    return null;
  }
}
