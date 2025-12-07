import { google } from "googleapis";
import { env } from "../config/env";
import axios from "axios";

const OAUTH2 = google.auth.OAuth2;

export const getGoogleOAuthUrl = () => {
  const oauth2Client = new OAUTH2(
    env.GOOGLE_CLIENT_ID!,
    env.GOOGLE_CLIENT_SECRET!,
    env.GOOGLE_REDIRECT_URI!
  );
  // Comprehensive Google scopes for all tools
  const scopes = [
    "https://www.googleapis.com/auth/calendar",           // Full calendar access (read/write events, list calendars)
    "https://www.googleapis.com/auth/calendar.events",   // Manage calendar events (create_calendar_event)
    "https://www.googleapis.com/auth/gmail.send",         // Send emails via Gmail (send_gmail tool)
    "https://www.googleapis.com/auth/gmail.readonly",     // Read Gmail messages (for future email reading tools)
    "https://www.googleapis.com/auth/userinfo.email",    // View user's email address
    "https://www.googleapis.com/auth/userinfo.profile",   // View user's basic profile info
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
  return url;
};

export const exchangeGoogleCode = async (code: string) => {
  try {
    const oauth2Client = new OAUTH2(
      env.GOOGLE_CLIENT_ID!,
      env.GOOGLE_CLIENT_SECRET!,
      env.GOOGLE_REDIRECT_URI!
    );
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens) {
      throw new Error("No tokens received from Google OAuth");
    }
    
    return tokens; // contains access_token, refresh_token, expiry_date
  } catch (error: any) {
    // Re-throw with more context
    if (error.message?.includes("invalid_grant") || error.message?.includes("TokenExpiredError")) {
      throw new Error(`TokenExpiredError: ${error.message}`);
    }
    throw error;
  }
};

export const listCalendarEventsForToken = async (
  accessToken: string,
  calendarId = "primary",
  maxResults = 10,
  options?: {
    timeMin?: string;
    timeMax?: string;
    singleEvents?: boolean;
    orderBy?: "startTime" | "updated";
  }
) => {
  const oauth2Client = new OAUTH2(
    env.GOOGLE_CLIENT_ID!,
    env.GOOGLE_CLIENT_SECRET!,
    env.GOOGLE_REDIRECT_URI!
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const res = await calendar.events.list({
    calendarId,
    maxResults,
    singleEvents: options?.singleEvents ?? true,
    orderBy: options?.orderBy ?? "startTime",
    timeMin: options?.timeMin ?? new Date().toISOString(),
    ...(options?.timeMax && { timeMax: options.timeMax }),
  });
  return res.data;
};

export const getGoogleDetails = async (access_token: string) => {
  const response = await axios.get(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  );
  return response.data;
};

/**
 * Refresh Google OAuth access token using refresh token
 */
export const refreshGoogleToken = async (refreshToken: string) => {
  const oauth2Client = new OAUTH2(
    env.GOOGLE_CLIENT_ID!,
    env.GOOGLE_CLIENT_SECRET!,
    env.GOOGLE_REDIRECT_URI!
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials; // contains access_token, expiry_date
};