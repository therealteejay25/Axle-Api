"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleActions = exports.deleteCalendarEvent = exports.listCalendarEvents = exports.createCalendarEvent = exports.listGmailMessages = exports.sendGmail = void 0;
const googleapis_1 = require("googleapis");
const logger_1 = require("../services/logger");
const getOAuth2Client = (integration) => {
    const oauth2Client = new googleapis_1.google.auth.OAuth2();
    oauth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken
    });
    return oauth2Client;
};
// ==================== GMAIL ACTIONS ====================
const sendGmail = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const gmail = googleapis_1.google.gmail({ version: "v1", auth });
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
    logger_1.logger.info("Gmail sent", { to, subject });
    return result.data;
};
exports.sendGmail = sendGmail;
const listGmailMessages = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const gmail = googleapis_1.google.gmail({ version: "v1", auth });
    const { query, maxResults = 10 } = params;
    const result = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults
    });
    return result.data;
};
exports.listGmailMessages = listGmailMessages;
// ==================== CALENDAR ACTIONS ====================
const createCalendarEvent = async (params, integration) => {
    const auth = getOAuth2Client(integration);
    const calendar = googleapis_1.google.calendar({ version: "v3", auth });
    const { calendarId = "primary", summary, description, startTime, endTime, attendees, location } = params;
    const event = {
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
        orderBy: "startTime"
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
        eventId
    });
    logger_1.logger.info("Calendar event deleted", { eventId });
    return { deleted: true, eventId };
};
exports.deleteCalendarEvent = deleteCalendarEvent;
// Action handlers map
exports.googleActions = {
    google_send_gmail: exports.sendGmail,
    google_list_gmail: exports.listGmailMessages,
    google_create_event: exports.createCalendarEvent,
    google_list_events: exports.listCalendarEvents,
    google_delete_event: exports.deleteCalendarEvent
};
exports.default = exports.googleActions;
