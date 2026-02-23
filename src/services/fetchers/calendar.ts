import { google } from "googleapis";
import { logger } from "../logger";

interface CalendarResult {
  events: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    meetLink?: string;
    attendeeCount: number;
  }>;
}

export async function calendarFetcher(
  userId: string,
  integrations: any[]
): Promise<CalendarResult | null> {
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

    // Get start and end of today
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59
    );

    // Fetch today's events
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = response.data.items || [];

    const events = items.map((event) => ({
      id: event.id || "",
      title: event.summary || "(No Title)",
      start: event.start?.dateTime || event.start?.date || "",
      end: event.end?.dateTime || event.end?.date || "",
      location: event.location,
      meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
      attendeeCount: event.attendees?.length || 0,
    }));

    return { events };
  } catch (error: any) {
    logger.error(`Calendar fetcher error for user ${userId}:`, error);
    return null;
  }
}
