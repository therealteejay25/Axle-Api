"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.write_to_sheet = exports.read_sheet = exports.create_drive_folder = exports.get_drive_file = exports.list_drive_files = exports.send_gmail = exports.get_gmail_message = exports.list_gmail_messages = exports.create_calendar_event = exports.list_calendars = exports.send_email = exports.listCalendarEvents = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const googleapis_1 = require("../lib/googleapis");
const env_1 = require("../config/env");
const resend_1 = require("resend");
const resend = new resend_1.Resend(env_1.env.RESEND_API_KEY);
exports.listCalendarEvents = (0, agents_1.tool)({
    name: "list_calendar_events",
    description: "List upcoming Google Calendar events for the connected account",
    parameters: zod_1.z.object({
        calendarId: zod_1.z.string().nullable().default(null),
        maxResults: zod_1.z.number().default(10),
        timeMin: zod_1.z.string().nullable().optional(),
        timeMax: zod_1.z.string().nullable().optional(),
        singleEvents: zod_1.z.boolean().nullable().optional(),
        orderBy: zod_1.z.enum(["startTime", "updated"]).nullable().optional(),
    }),
    execute: async ({ calendarId, maxResults, timeMin, timeMax, singleEvents, orderBy }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        const data = await (0, googleapis_1.listCalendarEventsForToken)(accessToken, calendarId || "primary", maxResults, {
            ...(timeMin && { timeMin }),
            ...(timeMax && { timeMax }),
            ...(singleEvents !== null && singleEvents !== undefined && { singleEvents }),
            ...(orderBy && { orderBy }),
        });
        return data;
    },
});
exports.send_email = (0, agents_1.tool)({
    name: "send_email",
    description: "Send an email using the server Resend account",
    parameters: zod_1.z.object({
        to: zod_1.z.string(),
        subject: zod_1.z.string(),
        html: zod_1.z.string(),
    }),
    execute: async ({ to, subject, html }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        const user = await (0, googleapis_1.getGoogleDetails)(accessToken); // just to verify token is valid
        const r = await resend.emails.send({
            from: "Axle <onboarding@resend.dev>",
            to,
            subject,
            html,
        });
        return { ok: true, status: r };
    },
});
exports.list_calendars = (0, agents_1.tool)({
    name: "list_calendars",
    description: "List calendars available to the connected Google account",
    parameters: zod_1.z.object({ maxResults: zod_1.z.number().default(50) }),
    execute: async ({ maxResults }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        // reuse googleapis helper
        const oauth2Client = undefined; // we will call existing helper for events; for calendars we can call endpoint via fetch
        // Simple fetch for calendars using Google REST
        const res = await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=${maxResults}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok)
            throw new Error(`Google calendar list error: ${res.statusText}`);
        const data = await res.json();
        return data.items || [];
    },
});
exports.create_calendar_event = (0, agents_1.tool)({
    name: "create_calendar_event",
    description: "Create an event on the given calendar",
    parameters: zod_1.z.object({
        calendarId: zod_1.z.string().default("primary"),
        summary: zod_1.z.string(),
        start: zod_1.z.string(),
        end: zod_1.z.string(),
        description: zod_1.z.string().nullable().default(null),
    }),
    execute: async ({ calendarId, summary, start, end, description }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                summary,
                start: { dateTime: start },
                end: { dateTime: end },
                description,
            }),
        });
        if (!res.ok)
            throw new Error(`Google create event error: ${res.statusText}`);
        return res.json();
    },
});
// --- GMAIL --- //
exports.list_gmail_messages = (0, agents_1.tool)({
    name: "list_gmail_messages",
    description: "List Gmail messages",
    parameters: zod_1.z.object({
        query: zod_1.z.string().nullable().optional(),
        maxResults: zod_1.z.number().default(10),
        labelIds: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    }),
    execute: async ({ query, maxResults, labelIds }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
        if (query)
            url += `&q=${encodeURIComponent(query)}`;
        if (labelIds)
            url += `&labelIds=${labelIds.join(",")}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok)
            throw new Error(`Gmail API error: ${res.statusText}`);
        return res.json();
    },
});
exports.get_gmail_message = (0, agents_1.tool)({
    name: "get_gmail_message",
    description: "Get a specific Gmail message",
    parameters: zod_1.z.object({
        messageId: zod_1.z.string(),
        format: zod_1.z.enum(["full", "metadata", "minimal", "raw"]).default("full"),
    }),
    execute: async ({ messageId, format }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok)
            throw new Error(`Gmail API error: ${res.statusText}`);
        return res.json();
    },
});
exports.send_gmail = (0, agents_1.tool)({
    name: "send_gmail",
    description: "Send an email via Gmail",
    parameters: zod_1.z.object({
        to: zod_1.z.string().or(zod_1.z.array(zod_1.z.string())),
        subject: zod_1.z.string(),
        body: zod_1.z.string(),
        html: zod_1.z.string().nullable().optional(),
        cc: zod_1.z.string().or(zod_1.z.array(zod_1.z.string())).nullable().optional(),
        bcc: zod_1.z.string().or(zod_1.z.array(zod_1.z.string())).nullable().optional(),
    }),
    execute: async ({ to, subject, body, html, cc, bcc }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        const toList = Array.isArray(to) ? to.join(", ") : to;
        const ccList = cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : "";
        const bccList = bcc ? (Array.isArray(bcc) ? bcc.join(", ") : bcc) : "";
        const email = [
            `To: ${toList}`,
            ccList ? `Cc: ${ccList}` : "",
            bccList ? `Bcc: ${bccList}` : "",
            `Subject: ${subject}`,
            "",
            html || body,
        ]
            .filter(Boolean)
            .join("\n");
        const encodedEmail = Buffer.from(email).toString("base64url");
        const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw: encodedEmail }),
        });
        if (!res.ok)
            throw new Error(`Gmail API error: ${res.statusText}`);
        return res.json();
    },
});
// --- GOOGLE DRIVE --- //
exports.list_drive_files = (0, agents_1.tool)({
    name: "list_drive_files",
    description: "List files in Google Drive",
    parameters: zod_1.z.object({
        query: zod_1.z.string().nullable().optional(),
        pageSize: zod_1.z.number().default(10),
        folderId: zod_1.z.string().nullable().optional(),
    }),
    execute: async ({ query, pageSize, folderId }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        let url = `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}`;
        if (query)
            url += `&q=${encodeURIComponent(query)}`;
        if (folderId)
            url += `&q='${folderId}'+in+parents`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok)
            throw new Error(`Drive API error: ${res.statusText}`);
        return res.json();
    },
});
exports.get_drive_file = (0, agents_1.tool)({
    name: "get_drive_file",
    description: "Get file metadata or content from Google Drive",
    parameters: zod_1.z.object({
        fileId: zod_1.z.string(),
        download: zod_1.z.boolean().default(false),
    }),
    execute: async ({ fileId, download }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        const url = download
            ? `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
            : `https://www.googleapis.com/drive/v3/files/${fileId}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok)
            throw new Error(`Drive API error: ${res.statusText}`);
        return download ? { content: await res.text() } : res.json();
    },
});
exports.create_drive_folder = (0, agents_1.tool)({
    name: "create_drive_folder",
    description: "Create a folder in Google Drive",
    parameters: zod_1.z.object({
        name: zod_1.z.string(),
        parentId: zod_1.z.string().nullable().optional(),
    }),
    execute: async ({ name, parentId }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        const res = await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name,
                mimeType: "application/vnd.google-apps.folder",
                parents: parentId ? [parentId] : [],
            }),
        });
        if (!res.ok)
            throw new Error(`Drive API error: ${res.statusText}`);
        return res.json();
    },
});
// --- GOOGLE SHEETS --- //
exports.read_sheet = (0, agents_1.tool)({
    name: "read_sheet",
    description: "Read data from a Google Sheet",
    parameters: zod_1.z.object({
        spreadsheetId: zod_1.z.string(),
        range: zod_1.z.string(), // e.g., "Sheet1!A1:C10"
    }),
    execute: async ({ spreadsheetId, range }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok)
            throw new Error(`Sheets API error: ${res.statusText}`);
        return res.json();
    },
});
exports.write_to_sheet = (0, agents_1.tool)({
    name: "write_to_sheet",
    description: "Write data to a Google Sheet",
    parameters: zod_1.z.object({
        spreadsheetId: zod_1.z.string(),
        range: zod_1.z.string(),
        values: zod_1.z.array(zod_1.z.array(zod_1.z.any())),
    }),
    execute: async ({ spreadsheetId, range, values }, ctx) => {
        const accessToken = ctx?.context?.["google"]?.accessToken;
        if (!accessToken)
            throw new Error("No Google integration found for user");
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ values }),
        });
        if (!res.ok)
            throw new Error(`Sheets API error: ${res.statusText}`);
        return res.json();
    },
});
exports.default = {};
