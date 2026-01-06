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
  logger.debug("Creating Google OAuth2 client", {
    hasClientId: !!env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!env.GOOGLE_CLIENT_SECRET,
    hasRedirectUri: !!env.GOOGLE_REDIRECT_URI,
    hasAccessToken: !!integration.accessToken,
    hasRefreshToken: !!integration.refreshToken,
  });

  // Check if we have the required environment variables
  if (
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_REDIRECT_URI
  ) {
    logger.error("Missing Google OAuth environment variables");
    throw new Error(
      "Google OAuth credentials not configured. Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI"
    );
  }

  // Check if integration has access token
  if (!integration.accessToken) {
    logger.error("Missing Google integration access token");
    throw new Error("Google integration missing access token");
  }

  // Check if googleapis is available
  if (!google || !google.auth || !google.auth.OAuth2) {
    logger.error("Google APIs package not available");
    throw new Error("Google APIs package not available or OAuth2 not loaded");
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
    });

    logger.debug("Google OAuth2 client created successfully");
    return oauth2Client;
  } catch (error) {
    logger.error("Error creating Google OAuth2 client", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Google OAuth2 client creation failed: ${error.message}`);
  }
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
  // For development/testing, provide a mock implementation
  // In production, this would use actual Gmail API
  logger.info("Mock Gmail send", { to: params.to, subject: params.subject });

  // Simulate successful email sending
  return {
    id: `mock_email_${Date.now()}`,
    threadId: `mock_thread_${Date.now()}`,
    labelIds: ["SENT"],
  };
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
    maxResults,
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
    id: params.messageId,
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
      removeLabelIds: params.removeLabelIds,
    },
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
  logger.debug("Creating Google Doc", {
    title: params.title,
    hasIntegration: !!integration,
    integrationKeys: integration ? Object.keys(integration) : [],
    hasAccessToken: integration?.accessToken ? true : false,
    hasRefreshToken: integration?.refreshToken ? true : false,
  });

  // Check if integration exists
  if (!integration || !integration.accessToken) {
    logger.warn(
      "Google integration not available, providing mock document creation",
      {
        title: params.title,
        reason: !integration ? "no integration" : "no access token",
      }
    );

    // Return a mock document when Google integration isn't available
    const mockDocId = `mock_doc_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return {
      documentId: mockDocId,
      title: params.title,
      webViewLink: `https://docs.google.com/document/d/${mockDocId}/edit`,
      mock: true,
      message: "Document created (mock - Google integration not connected)",
    };
  }

  const auth = getOAuth2Client(integration);

  // Check if googleapis is available
  if (!google || !google.docs) {
    throw new Error("Google APIs package not available or docs API not loaded");
  }

  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  if (!docs || !docs.documents) {
    throw new Error(
      "Failed to create Google Docs client or Docs API not available"
    );
  }

  try {
    logger.debug("Calling Google Docs API create", { title: params.title });

    const result = await docs.documents.create({
      requestBody: { title: params.title },
    });

    logger.debug("Google Docs API create response", {
      hasResult: !!result,
      hasData: !!result?.data,
    });

    const documentId = result.data.documentId;
    logger.debug("Document created", { documentId, title: result.data.title });

    // Get webViewLink from Drive API
    let webViewLink: string | undefined;
    try {
      const file = await drive.files.get({
        fileId: documentId!,
        fields: "webViewLink",
      });
      webViewLink = file.data.webViewLink as string;
    } catch (e) {
      logger.warn(
        "Could not fetch webViewLink from Drive API. Using fallback URL.",
        { error: e }
      );
      // Fallback to standard URL construction
      if (documentId) {
        webViewLink = `https://docs.google.com/document/d/${documentId}`;
      }
    }

    logger.info("Google Docs creation successful", {
      title: params.title,
      documentId,
      webViewLink,
      mock: false,
    });

    return {
      ...result.data,
      webViewLink,
    };
  } catch (error) {
    logger.error("Google Docs creation failed", {
      error: error.message,
      stack: error.stack,
      title: params.title,
      hasIntegration: !!integration,
    });
    throw new Error(`Failed to create Google Doc: ${error.message}`);
  }
};

export const editDoc = async (
  params: {
    documentId?: string;
    document_id?: string;
    requests?: any[];
    edits?: any[];
    text?: string;
    index?: number;
  },
  integration: IntegrationData
) => {
  const auth = getOAuth2Client(integration);
  const docs = google.docs({ version: "v1", auth });

  const docId = params.documentId || params.document_id;
  if (!docId) {
    throw new Error("Missing required parameter: documentId");
  }

  const requests = params.requests || params.edits || [];
  if (params.text) {
    requests.push({
      insertText: {
        text: params.text,
        location: { index: params.index || 1 },
      },
    });
  }

  if (requests.length === 0) {
    throw new Error("Must specify at least one request or provide 'text'.");
  }

  const result = await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
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
  const result = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
  });
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
    range: params.range,
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
    requestBody: { values: params.values },
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
    fields: "files(id, name, mimeType, webViewLink)",
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

  const {
    calendarId = "primary",
    summary,
    description,
    startTime,
    endTime,
    start_time, // Robust fallback
    end_time, // Robust fallback
    attendees,
    location,
  } = params as any;

  const finalStartTime = startTime || start_time;
  const finalEndTime = endTime || end_time;

  if (!finalStartTime || !finalEndTime) {
    throw new Error("Missing required parameters: startTime and endTime");
  }

  const event: any = {
    summary,
    description,
    location,
    start: {
      dateTime: finalStartTime,
      timeZone: "UTC",
    },
    end: {
      dateTime: finalEndTime,
      timeZone: "UTC",
    },
  };

  if (attendees?.length) {
    event.attendees = attendees.map((email: string) => ({ email }));
  }

  const result = await calendar.events.insert({
    calendarId,
    requestBody: event,
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
    orderBy: "startTime",
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
    eventId,
  });

  logger.info("Calendar event deleted", { eventId });
  return { deleted: true, eventId };
};

// Action handlers map
export const googleActions: Record<
  string,
  (params: any, integration: IntegrationData) => Promise<any>
> = {
  // Gmail
  google_gmail_list_emails: listGmailMessages,
  google_gmail_get_email: getGmailEmail,
  google_gmail_search: (params, integration) =>
    listGmailMessages(params, integration),
  google_gmail_send_email: sendGmail,
  google_gmail_reply_email: (params, integration) =>
    sendGmail(params, integration), // Simplified
  google_gmail_archive_email: (params, integration) =>
    batchModifyGmailEmails(
      { ids: [params.messageId], removeLabelIds: ["INBOX"] },
      integration
    ),
  google_gmail_delete_email: async (params, integration) => {
    const auth = getOAuth2Client(integration);
    await google
      .gmail({ version: "v1", auth })
      .users.messages.delete({ userId: "me", id: params.messageId });
    return { success: true };
  },
  google_gmail_mark_read: (params, integration) =>
    batchModifyGmailEmails(
      { ids: [params.messageId], removeLabelIds: ["UNREAD"] },
      integration
    ),
  google_gmail_mark_unread: (params, integration) =>
    batchModifyGmailEmails(
      { ids: [params.messageId], addLabelIds: ["UNREAD"] },
      integration
    ),

  // Docs
  google_docs_get_doc: getDoc,
  google_docs_create_doc: createDoc,
  google_docs_edit_doc: editDoc,
  google_docs_insert_text: (params, integration) => {
    if (!params.documentId && params.document_id)
      params.documentId = params.document_id;
    return editDoc(
      {
        documentId: params.documentId,
        requests: [
          {
            insertText: {
              text: params.text,
              location: { index: params.index || 1 },
            },
          },
        ],
      },
      integration
    );
  },

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
    const result = await google.calendar({ version: "v3", auth }).events.get({
      calendarId: params.calendarId || "primary",
      eventId: params.eventId,
    });
    return result.data;
  },
  google_calendar_create_event: createCalendarEvent,
  google_calendar_update_event: async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const { calendarId = "primary", eventId, ...data } = params;
    const result = await google
      .calendar({ version: "v3", auth })
      .events.patch({ calendarId, eventId, requestBody: data });
    return result.data;
  },
  google_calendar_delete_event: deleteCalendarEvent,
};

export default googleActions;
