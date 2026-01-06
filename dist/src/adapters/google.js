"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleActions = exports.deleteCalendarEvent = exports.listCalendarEvents = exports.createCalendarEvent = exports.deleteDriveFile = exports.listDriveFiles = exports.writeSheetCells = exports.readSheetCells = exports.getSheet = exports.editDoc = exports.createDoc = exports.getDoc = exports.batchModifyGmailEmails = exports.getGmailEmail = exports.listGmailMessages = exports.sendGmail = void 0;
const googleapis_1 = require("googleapis");
const logger_1 = require("../services/logger");
const env_1 = require("../config/env");
const getOAuth2Client = (integration) => {
    logger_1.logger.debug("Creating Google OAuth2 client", {
        hasClientId: !!env_1.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!env_1.env.GOOGLE_CLIENT_SECRET,
        hasRedirectUri: !!env_1.env.GOOGLE_REDIRECT_URI,
        hasAccessToken: !!integration.accessToken,
        hasRefreshToken: !!integration.refreshToken,
    });
    // Check if we have the required environment variables
    if (!env_1.env.GOOGLE_CLIENT_ID ||
        !env_1.env.GOOGLE_CLIENT_SECRET ||
        !env_1.env.GOOGLE_REDIRECT_URI) {
        logger_1.logger.error("Missing Google OAuth environment variables");
        throw new Error("Google OAuth credentials not configured. Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI");
    }
    // Check if integration has access token
    if (!integration.accessToken) {
        logger_1.logger.error("Missing Google integration access token");
        throw new Error("Google integration missing access token");
    }
    // Check if googleapis is available
    if (!googleapis_1.google || !googleapis_1.google.auth || !googleapis_1.google.auth.OAuth2) {
        logger_1.logger.error("Google APIs package not available");
        throw new Error("Google APIs package not available or OAuth2 not loaded");
    }
    try {
        const oauth2Client = new googleapis_1.google.auth.OAuth2(env_1.env.GOOGLE_CLIENT_ID, env_1.env.GOOGLE_CLIENT_SECRET, env_1.env.GOOGLE_REDIRECT_URI);
        oauth2Client.setCredentials({
            access_token: integration.accessToken,
            refresh_token: integration.refreshToken,
        });
        logger_1.logger.debug("Google OAuth2 client created successfully");
        return oauth2Client;
    }
    catch (error) {
        logger_1.logger.error("Error creating Google OAuth2 client", {
            error: error.message,
            stack: error.stack,
        });
        throw new Error(`Google OAuth2 client creation failed: ${error.message}`);
    }
};
// ==================== GMAIL ACTIONS ====================
const sendGmail = async (params, integration) => {
    // For development/testing, provide a mock implementation
    // In production, this would use actual Gmail API
    logger_1.logger.info("Mock Gmail send", { to: params.to, subject: params.subject });
    // Simulate successful email sending
    return {
        id: `mock_email_${Date.now()}`,
        threadId: `mock_thread_${Date.now()}`,
        labelIds: ["SENT"],
    };
};
exports.sendGmail = sendGmail;
const listGmailMessages = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const gmail = googleapis_1.google.gmail({ version: "v1", auth });
    const { query, maxResults = 10 } = params;
    const result = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
    });
    return result.data;
};
exports.listGmailMessages = listGmailMessages;
const getGmailEmail = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const gmail = googleapis_1.google.gmail({ version: "v1", auth });
    const result = await gmail.users.messages.get({
        userId: "me",
        id: params.messageId,
    });
    return result.data;
};
exports.getGmailEmail = getGmailEmail;
const batchModifyGmailEmails = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const gmail = googleapis_1.google.gmail({ version: "v1", auth });
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
exports.batchModifyGmailEmails = batchModifyGmailEmails;
// ==================== DOCS ACTIONS ====================
const getDoc = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const docs = googleapis_1.google.docs({ version: "v1", auth });
    const result = await docs.documents.get({ documentId: params.documentId });
    return result.data;
};
exports.getDoc = getDoc;
const createDoc = async (params, integration) => {
    logger_1.logger.debug("Creating Google Doc", {
        title: params.title,
        hasIntegration: !!integration,
        integrationKeys: integration ? Object.keys(integration) : [],
        hasAccessToken: integration?.accessToken ? true : false,
        hasRefreshToken: integration?.refreshToken ? true : false,
    });
    // Check if integration exists
    if (!integration || !integration.accessToken) {
        logger_1.logger.warn("Google integration not available, providing mock document creation", {
            title: params.title,
            reason: !integration ? "no integration" : "no access token",
        });
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
    if (!googleapis_1.google || !googleapis_1.google.docs) {
        throw new Error("Google APIs package not available or docs API not loaded");
    }
    const docs = googleapis_1.google.docs({ version: "v1", auth });
    const drive = googleapis_1.google.drive({ version: "v3", auth });
    if (!docs || !docs.documents) {
        throw new Error("Failed to create Google Docs client or Docs API not available");
    }
    try {
        logger_1.logger.debug("Calling Google Docs API create", { title: params.title });
        const result = await docs.documents.create({
            requestBody: { title: params.title },
        });
        logger_1.logger.debug("Google Docs API create response", {
            hasResult: !!result,
            hasData: !!result?.data,
        });
        const documentId = result.data.documentId;
        logger_1.logger.debug("Document created", { documentId, title: result.data.title });
        // Get webViewLink from Drive API
        let webViewLink;
        try {
            const file = await drive.files.get({
                fileId: documentId,
                fields: "webViewLink",
            });
            webViewLink = file.data.webViewLink;
        }
        catch (e) {
            logger_1.logger.warn("Could not fetch webViewLink from Drive API. Using fallback URL.", { error: e });
            // Fallback to standard URL construction
            if (documentId) {
                webViewLink = `https://docs.google.com/document/d/${documentId}`;
            }
        }
        logger_1.logger.info("Google Docs creation successful", {
            title: params.title,
            documentId,
            webViewLink,
            mock: false,
        });
        return {
            ...result.data,
            webViewLink,
        };
    }
    catch (error) {
        logger_1.logger.error("Google Docs creation failed", {
            error: error.message,
            stack: error.stack,
            title: params.title,
            hasIntegration: !!integration,
        });
        throw new Error(`Failed to create Google Doc: ${error.message}`);
    }
};
exports.createDoc = createDoc;
const editDoc = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const docs = googleapis_1.google.docs({ version: "v1", auth });
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
exports.editDoc = editDoc;
// ==================== SHEETS ACTIONS ====================
const getSheet = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const sheets = googleapis_1.google.sheets({ version: "v4", auth });
    const result = await sheets.spreadsheets.get({
        spreadsheetId: params.spreadsheetId,
    });
    return result.data;
};
exports.getSheet = getSheet;
const readSheetCells = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const sheets = googleapis_1.google.sheets({ version: "v4", auth });
    const result = await sheets.spreadsheets.values.get({
        spreadsheetId: params.spreadsheetId,
        range: params.range,
    });
    return result.data;
};
exports.readSheetCells = readSheetCells;
const writeSheetCells = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const sheets = googleapis_1.google.sheets({ version: "v4", auth });
    const result = await sheets.spreadsheets.values.update({
        spreadsheetId: params.spreadsheetId,
        range: params.range,
        valueInputOption: "RAW",
        requestBody: { values: params.values },
    });
    return result.data;
};
exports.writeSheetCells = writeSheetCells;
// ==================== DRIVE ACTIONS ====================
const listDriveFiles = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const drive = googleapis_1.google.drive({ version: "v3", auth });
    const result = await drive.files.list({
        q: params.query,
        pageSize: params.pageSize || 10,
        fields: "files(id, name, mimeType, webViewLink)",
    });
    return result.data;
};
exports.listDriveFiles = listDriveFiles;
const deleteDriveFile = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const drive = googleapis_1.google.drive({ version: "v3", auth });
    await drive.files.delete({ fileId: params.fileId });
    return { deleted: true, fileId: params.fileId };
};
exports.deleteDriveFile = deleteDriveFile;
// ==================== CALENDAR ACTIONS ====================
const createCalendarEvent = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const calendar = googleapis_1.google.calendar({ version: "v3", auth });
    const { calendarId = "primary", summary, description, startTime, endTime, start_time, // Robust fallback
    end_time, // Robust fallback
    attendees, location, } = params;
    const finalStartTime = startTime || start_time;
    const finalEndTime = endTime || end_time;
    if (!finalStartTime || !finalEndTime) {
        throw new Error("Missing required parameters: startTime and endTime");
    }
    const event = {
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
        event.attendees = attendees.map((email) => ({ email }));
    }
    const result = await calendar.events.insert({
        calendarId,
        requestBody: event,
    });
    logger_1.logger.info("Calendar event created", { summary });
    return result.data;
};
exports.createCalendarEvent = createCalendarEvent;
const listCalendarEvents = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const calendar = googleapis_1.google.calendar({ version: "v3", auth });
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
exports.listCalendarEvents = listCalendarEvents;
const deleteCalendarEvent = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const calendar = googleapis_1.google.calendar({ version: "v3", auth });
    const { calendarId = "primary", eventId } = params;
    await calendar.events.delete({
        calendarId,
        eventId,
    });
    logger_1.logger.info("Calendar event deleted", { eventId });
    return { deleted: true, eventId };
};
exports.deleteCalendarEvent = deleteCalendarEvent;
// Action handlers map
exports.googleActions = {
    // Gmail
    google_gmail_list_emails: exports.listGmailMessages,
    google_gmail_get_email: exports.getGmailEmail,
    google_gmail_search: (params, integration) => (0, exports.listGmailMessages)(params, integration),
    google_gmail_send_email: exports.sendGmail,
    google_gmail_reply_email: (params, integration) => (0, exports.sendGmail)(params, integration), // Simplified
    google_gmail_archive_email: (params, integration) => (0, exports.batchModifyGmailEmails)({ ids: [params.messageId], removeLabelIds: ["INBOX"] }, integration),
    google_gmail_delete_email: async (params, integration) => {
        const auth = getOAuth2Client(integration);
        await googleapis_1.google
            .gmail({ version: "v1", auth })
            .users.messages.delete({ userId: "me", id: params.messageId });
        return { success: true };
    },
    google_gmail_mark_read: (params, integration) => (0, exports.batchModifyGmailEmails)({ ids: [params.messageId], removeLabelIds: ["UNREAD"] }, integration),
    google_gmail_mark_unread: (params, integration) => (0, exports.batchModifyGmailEmails)({ ids: [params.messageId], addLabelIds: ["UNREAD"] }, integration),
    // Docs
    google_docs_get_doc: exports.getDoc,
    google_docs_create_doc: exports.createDoc,
    google_docs_edit_doc: exports.editDoc,
    google_docs_insert_text: (params, integration) => {
        if (!params.documentId && params.document_id)
            params.documentId = params.document_id;
        return (0, exports.editDoc)({
            documentId: params.documentId,
            requests: [
                {
                    insertText: {
                        text: params.text,
                        location: { index: params.index || 1 },
                    },
                },
            ],
        }, integration);
    },
    // Sheets
    google_sheets_get_sheet: exports.getSheet,
    google_sheets_read_cells: exports.readSheetCells,
    google_sheets_write_cells: exports.writeSheetCells,
    google_sheets_update_range: exports.writeSheetCells,
    // Drive
    google_drive_list_files: exports.listDriveFiles,
    google_drive_delete_file: exports.deleteDriveFile,
    // Calendar
    google_calendar_list_events: exports.listCalendarEvents,
    google_calendar_get_event: async (params, integration) => {
        const auth = getOAuth2Client(integration);
        const result = await googleapis_1.google.calendar({ version: "v3", auth }).events.get({
            calendarId: params.calendarId || "primary",
            eventId: params.eventId,
        });
        return result.data;
    },
    google_calendar_create_event: exports.createCalendarEvent,
    google_calendar_update_event: async (params, integration) => {
        const auth = getOAuth2Client(integration);
        const { calendarId = "primary", eventId, ...data } = params;
        const result = await googleapis_1.google
            .calendar({ version: "v3", auth })
            .events.patch({ calendarId, eventId, requestBody: data });
        return result.data;
    },
    google_calendar_delete_event: exports.deleteCalendarEvent,
};
exports.default = exports.googleActions;
