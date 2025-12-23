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

import { env } from "../config/env";

const getOAuth2Client = (integration: IntegrationData) => {
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
  
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
  
  // Gmail requires RFC 2822 formatted email
  // Headers must be present
  const messageParts = [
    `To: ${to}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    body
  ];
  const email = messageParts.join("\r\n");
  
  // Must be URL-safe base64 encoding
  const encodedEmail = Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  
  try {
    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail
      }
    });

    logger.info("Gmail sent", { to, subject, messageId: result.data.id });
    return result.data;
  } catch (error: any) {
    logger.error("Gmail send failed", { error: error.message, body: error.response?.data });
    throw error;
  }
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

export const getGmailEmail = async (
  params: { messageId: string },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const gmail = google.gmail({ version: "v1", auth });
  const result = await gmail.users.messages.get({
    userId: "me",
    id: params.messageId
  });
  return result.data;
};

export const batchModifyGmailEmails = async (
  params: { ids: string[]; addLabelIds?: string[]; removeLabelIds?: string[] },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: {
      ids: params.ids,
      addLabelIds: params.addLabelIds,
      removeLabelIds: params.removeLabelIds
    }
  });
  return { success: true };
};

// ==================== DOCS ACTIONS ====================

export const getDoc = async (
  params: { documentId: string },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const docs = google.docs({ version: "v1", auth });
  const result = await docs.documents.get({ documentId: params.documentId });
  return result.data;
};

export const createDoc = async (
  params: { title: string },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const docs = google.docs({ version: "v1", auth });
  const result = await docs.documents.create({ requestBody: { title: params.title } });
  return result.data;
};

export const editDoc = async (
  params: { documentId: string; requests: any[] },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const docs = google.docs({ version: "v1", auth });
  const result = await docs.documents.batchUpdate({
    documentId: params.documentId,
    requestBody: { requests: params.requests }
  });
  return result.data;
};

// ==================== SHEETS ACTIONS ====================

export const getSheet = async (
  params: { spreadsheetId: string },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const sheets = google.sheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.get({ spreadsheetId: params.spreadsheetId });
  return result.data;
};

export const readSheetCells = async (
  params: { spreadsheetId: string; range: string },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const sheets = google.sheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: params.range
  });
  return result.data;
};

export const writeSheetCells = async (
  params: { spreadsheetId: string; range: string; values: any[][] },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const sheets = google.sheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
    valueInputOption: "RAW",
    requestBody: { values: params.values }
  });
  return result.data;
};

// ==================== DRIVE ACTIONS ====================

export const listDriveFiles = async (
  params: { query?: string; pageSize?: number },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const drive = google.drive({ version: "v3", auth });
  const result = await drive.files.list({
    q: params.query,
    pageSize: params.pageSize || 10,
    fields: "files(id, name, mimeType, webViewLink)"
  });
  return result.data;
};

export const deleteDriveFile = async (
  params: { fileId: string },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const drive = google.drive({ version: "v3", auth });
  await drive.files.delete({ fileId: params.fileId });
  return { deleted: true, fileId: params.fileId };
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
  // Gmail
  google_gmail_list_emails: listGmailMessages,
  google_gmail_get_email: getGmailEmail,
  google_gmail_search: (params, integration) => listGmailMessages(params, integration),
  google_gmail_send_email: sendGmail,
  google_gmail_reply_email: (params, integration) => sendGmail(params, integration), // Simplified
  google_gmail_archive_email: (params, integration) => batchModifyGmailEmails({ ids: [params.messageId], removeLabelIds: ["INBOX"] }, integration),
  google_gmail_delete_email: async (params, integration) => {
    const auth = getOAuth2Client(integration);
    await google.gmail({ version: "v1", auth }).users.messages.delete({ userId: "me", id: params.messageId });
    return { success: true };
  },
  google_gmail_mark_read: (params, integration) => batchModifyGmailEmails({ ids: [params.messageId], removeLabelIds: ["UNREAD"] }, integration),
  google_gmail_mark_unread: (params, integration) => batchModifyGmailEmails({ ids: [params.messageId], addLabelIds: ["UNREAD"] }, integration),

  // Docs
  google_docs_get_doc: getDoc,
  google_docs_create_doc: createDoc,
  google_docs_edit_doc: editDoc,
  google_docs_insert_text: (params, integration) => editDoc({
    documentId: params.documentId,
    requests: [{ insertText: { text: params.text, location: { index: params.index || 1 } } }]
  }, integration),

  // Sheets
  google_sheets_get_sheet: getSheet,
  google_sheets_read_cells: readSheetCells,
  google_sheets_write_cells: writeSheetCells,
  google_sheets_update_range: writeSheetCells,

  // Drive
  google_drive_list_files: listDriveFiles,
  google_drive_delete_file: deleteDriveFile,

  // Calendar
  google_calendar_list_events: listCalendarEvents,
  google_calendar_get_event: async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const result = await google.calendar({ version: "v3", auth }).events.get({ calendarId: params.calendarId || "primary", eventId: params.eventId });
    return result.data;
  },
  google_calendar_create_event: createCalendarEvent,
  google_calendar_update_event: async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const { calendarId = "primary", eventId, ...data } = params;
    const result = await google.calendar({ version: "v3", auth }).events.patch({ calendarId, eventId, requestBody: data });
    return result.data;
  },
  google_calendar_delete_event: deleteCalendarEvent,
};

export default googleActions;
