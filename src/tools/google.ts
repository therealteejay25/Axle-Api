import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import {
  getGoogleDetails,
  listCalendarEventsForToken,
} from "../lib/googleapis";
import { env } from "../config/env";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY!);

export const listCalendarEvents = tool({
  name: "list_calendar_events",
  description: "List upcoming Google Calendar events for the connected account",
  parameters: z.object({
    calendarId: z.string().nullable().default(null),
    maxResults: z.number().default(10),
    timeMin: z.string().nullable().optional(),
    timeMax: z.string().nullable().optional(),
    singleEvents: z.boolean().nullable().optional(),
    orderBy: z.enum(["startTime", "updated"]).nullable().optional(),
  }),
  execute: async ({ calendarId, maxResults, timeMin, timeMax, singleEvents, orderBy }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

    const data = await listCalendarEventsForToken(
      accessToken,
      calendarId || "primary",
      maxResults,
      {
        ...(timeMin && { timeMin }),
        ...(timeMax && { timeMax }),
        ...(singleEvents !== null && singleEvents !== undefined && { singleEvents }),
        ...(orderBy && { orderBy }),
      }
    );
    return data;
  },
});

export const send_email = tool({
  name: "send_email",
  description: "Send an email using the server Resend account",
  parameters: z.object({
    to: z.string(),
    subject: z.string(),
    html: z.string(),
  }),
  execute: async ({ to, subject, html }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

    const user = await getGoogleDetails(accessToken); // just to verify token is valid
    const r = await resend.emails.send({
      from: "Axle <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    return { ok: true, status: r };
  },
});

export const list_calendars = tool({
  name: "list_calendars",
  description: "List calendars available to the connected Google account",
  parameters: z.object({ maxResults: z.number().default(50) }),
  execute: async ({ maxResults }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

    // reuse googleapis helper
    const oauth2Client = undefined as any; // we will call existing helper for events; for calendars we can call endpoint via fetch
    // Simple fetch for calendars using Google REST
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=${maxResults}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok)
      throw new Error(`Google calendar list error: ${res.statusText}`);
    const data = await res.json();
    return data.items || [];
  },
});

export const create_calendar_event = tool({
  name: "create_calendar_event",
  description: "Create an event on the given calendar",
  parameters: z.object({
    calendarId: z.string().default("primary"),
    summary: z.string(),
    start: z.string(),
    end: z.string(),
    description: z.string().nullable().default(null),
  }),
  execute: async (
    { calendarId, summary, start, end, description },
    ctx?: RunContext<any>
  ) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events`,
      {
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
      }
    );
    if (!res.ok)
      throw new Error(`Google create event error: ${res.statusText}`);
    return res.json();
  },
});

// --- GMAIL --- //

export const list_gmail_messages = tool({
  name: "list_gmail_messages",
  description: "List Gmail messages",
  parameters: z.object({
    query: z.string().nullable().optional(),
    maxResults: z.number().default(10),
    labelIds: z.array(z.string()).nullable().optional(),
  }),
  execute: async ({ query, maxResults, labelIds }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

    let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    if (labelIds) url += `&labelIds=${labelIds.join(",")}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Gmail API error: ${res.statusText}`);
    return res.json();
  },
});

export const get_gmail_message = tool({
  name: "get_gmail_message",
  description: "Get a specific Gmail message",
  parameters: z.object({
    messageId: z.string(),
    format: z.enum(["full", "metadata", "minimal", "raw"]).default("full"),
  }),
  execute: async ({ messageId, format }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Gmail API error: ${res.statusText}`);
    return res.json();
  },
});

export const send_gmail = tool({
  name: "send_gmail",
  description: "Send an email via Gmail",
  parameters: z.object({
    to: z.string().or(z.array(z.string())),
    subject: z.string(),
    body: z.string(),
    html: z.string().nullable().optional(),
    cc: z.string().or(z.array(z.string())).nullable().optional(),
    bcc: z.string().or(z.array(z.string())).nullable().optional(),
  }),
  execute: async (
    { to, subject, body, html, cc, bcc },
    ctx?: RunContext<any>
  ) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

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

    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodedEmail }),
      }
    );
    if (!res.ok) throw new Error(`Gmail API error: ${res.statusText}`);
    return res.json();
  },
});

// --- GOOGLE DRIVE --- //

export const list_drive_files = tool({
  name: "list_drive_files",
  description: "List files in Google Drive",
  parameters: z.object({
    query: z.string().nullable().optional(),
    pageSize: z.number().default(10),
    folderId: z.string().nullable().optional(),
  }),
  execute: async ({ query, pageSize, folderId }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

    let url = `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    if (folderId) url += `&q='${folderId}'+in+parents`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Drive API error: ${res.statusText}`);
    return res.json();
  },
});

export const get_drive_file = tool({
  name: "get_drive_file",
  description: "Get file metadata or content from Google Drive",
  parameters: z.object({
    fileId: z.string(),
    download: z.boolean().default(false),
  }),
  execute: async ({ fileId, download }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

    const url = download
      ? `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
      : `https://www.googleapis.com/drive/v3/files/${fileId}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Drive API error: ${res.statusText}`);
    return download ? { content: await res.text() } : res.json();
  },
});

export const create_drive_folder = tool({
  name: "create_drive_folder",
  description: "Create a folder in Google Drive",
  parameters: z.object({
    name: z.string(),
    parentId: z.string().nullable().optional(),
  }),
  execute: async ({ name, parentId }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

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
    if (!res.ok) throw new Error(`Drive API error: ${res.statusText}`);
    return res.json();
  },
});

// --- GOOGLE SHEETS --- //

export const read_sheet = tool({
  name: "read_sheet",
  description: "Read data from a Google Sheet",
  parameters: z.object({
    spreadsheetId: z.string(),
    range: z.string(), // e.g., "Sheet1!A1:C10"
  }),
  execute: async ({ spreadsheetId, range }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        range
      )}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Sheets API error: ${res.statusText}`);
    return res.json();
  },
});

export const write_to_sheet = tool({
  name: "write_to_sheet",
  description: "Write data to a Google Sheet",
  parameters: z.object({
    spreadsheetId: z.string(),
    range: z.string(),
    values: z.array(z.array(z.any())),
  }),
  execute: async ({ spreadsheetId, range, values }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["google"]?.accessToken;
    if (!accessToken) throw new Error("No Google integration found for user");

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        range
      )}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      }
    );
    if (!res.ok) throw new Error(`Sheets API error: ${res.statusText}`);
    return res.json();
  },
});

export default {};
