import { google } from "googleapis";
import { logger } from "../services/logger";

// ============================================
// GOOGLE ADAPTER
// ============================================
// Pure executor for Google actions.
// Supports Gmail and Calendar.
// ============================================

interface IntegrationData {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
}

const getOAuth2Client = (integration: IntegrationData) => {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken
  });
  return oauth2Client;
};

// ==================== GMAIL ACTIONS ====================

export const sendGmail = async (
  params: {
    to: string;
    subject: string;
    body: string;
    html?: boolean;
  },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const gmail = google.gmail({ version: "v1", auth });
  
  const { to, subject, body, html = false } = params;
  
  // Build the email
  const contentType = html ? "text/html" : "text/plain";
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: ${contentType}; charset=utf-8`,
    "",
    body
  ].join("\n");
  
  const encodedEmail = Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  
  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedEmail
    }
  });
  
  logger.info("Gmail sent", { to, subject });
  return result.data;
};

export const listGmailMessages = async (
  params: { query?: string; maxResults?: number },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const gmail = google.gmail({ version: "v1", auth });
  
  const { query, maxResults = 10 } = params;
  
  const result = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults
  });
  
  return result.data;
};

// ==================== CALENDAR ACTIONS ====================

export const createCalendarEvent = async (
  params: {
    calendarId?: string;
    summary: string;
    description?: string;
    startTime: string;
    endTime: string;
    attendees?: string[];
    location?: string;
  },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const calendar = google.calendar({ version: "v3", auth });
  
  const { calendarId = "primary", summary, description, startTime, endTime, attendees, location } = params;
  
  const event: any = {
    summary,
    description,
    location,
    start: {
      dateTime: startTime,
      timeZone: "UTC"
    },
    end: {
      dateTime: endTime,
      timeZone: "UTC"
    }
  };
  
  if (attendees?.length) {
    event.attendees = attendees.map(email => ({ email }));
  }
  
  const result = await calendar.events.insert({
    calendarId,
    requestBody: event
  });
  
  logger.info("Calendar event created", { summary });
  return result.data;
};

export const listCalendarEvents = async (
  params: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const calendar = google.calendar({ version: "v3", auth });
  
  const { calendarId = "primary", timeMin, timeMax, maxResults = 10 } = params;
  
  const result = await calendar.events.list({
    calendarId,
    timeMin: timeMin || new Date().toISOString(),
    timeMax,
    maxResults,
    singleEvents: true,
    orderBy: "startTime"
  });
  
  return result.data;
};

export const deleteCalendarEvent = async (
  params: { calendarId?: string; eventId: string },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const calendar = google.calendar({ version: "v3", auth });
  
  const { calendarId = "primary", eventId } = params;
  
  await calendar.events.delete({
    calendarId,
    eventId
  });
  
  logger.info("Calendar event deleted", { eventId });
  return { deleted: true, eventId };
};

// Action handlers map
export const googleActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  google_send_gmail: sendGmail,
  google_list_gmail: listGmailMessages,
  google_create_event: createCalendarEvent,
  google_list_events: listCalendarEvents,
  google_delete_event: deleteCalendarEvent
};

export default googleActions;
