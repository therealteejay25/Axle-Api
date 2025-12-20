"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshGoogleToken = exports.getGoogleDetails = exports.listCalendarEventsForToken = exports.exchangeGoogleCode = exports.getGoogleOAuthUrl = void 0;
const googleapis_1 = require("googleapis");
const env_1 = require("../config/env");
const axios_1 = __importDefault(require("axios"));
const OAUTH2 = googleapis_1.google.auth.OAuth2;
const getGoogleOAuthUrl = () => {
    const oauth2Client = new OAUTH2(env_1.env.GOOGLE_CLIENT_ID, env_1.env.GOOGLE_CLIENT_SECRET, env_1.env.GOOGLE_REDIRECT_URI);
    // Comprehensive Google scopes for all tools
    const scopes = [
        "https://www.googleapis.com/auth/calendar", // Full calendar access (read/write events, list calendars)
        "https://www.googleapis.com/auth/calendar.events", // Manage calendar events (create_calendar_event)
        "https://www.googleapis.com/auth/gmail.send", // Send emails via Gmail (send_gmail tool)
        "https://www.googleapis.com/auth/gmail.readonly", // Read Gmail messages (for future email reading tools)
        "https://www.googleapis.com/auth/userinfo.email", // View user's email address
        "https://www.googleapis.com/auth/userinfo.profile", // View user's basic profile info
    ];
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
    });
    return url;
};
exports.getGoogleOAuthUrl = getGoogleOAuthUrl;
const exchangeGoogleCode = async (code) => {
    try {
        const oauth2Client = new OAUTH2(env_1.env.GOOGLE_CLIENT_ID, env_1.env.GOOGLE_CLIENT_SECRET, env_1.env.GOOGLE_REDIRECT_URI);
        const { tokens } = await oauth2Client.getToken(code);
        if (!tokens) {
            throw new Error("No tokens received from Google OAuth");
        }
        return tokens; // contains access_token, refresh_token, expiry_date
    }
    catch (error) {
        // Re-throw with more context
        if (error.message?.includes("invalid_grant") || error.message?.includes("TokenExpiredError")) {
            throw new Error(`TokenExpiredError: ${error.message}`);
        }
        throw error;
    }
};
exports.exchangeGoogleCode = exchangeGoogleCode;
const listCalendarEventsForToken = async (accessToken, calendarId = "primary", maxResults = 10, options) => {
    const oauth2Client = new OAUTH2(env_1.env.GOOGLE_CLIENT_ID, env_1.env.GOOGLE_CLIENT_SECRET, env_1.env.GOOGLE_REDIRECT_URI);
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = googleapis_1.google.calendar({ version: "v3", auth: oauth2Client });
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
exports.listCalendarEventsForToken = listCalendarEventsForToken;
const getGoogleDetails = async (access_token) => {
    const response = await axios_1.default.get("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
    });
    return response.data;
};
exports.getGoogleDetails = getGoogleDetails;
/**
 * Refresh Google OAuth access token using refresh token
 */
const refreshGoogleToken = async (refreshToken) => {
    const oauth2Client = new OAUTH2(env_1.env.GOOGLE_CLIENT_ID, env_1.env.GOOGLE_CLIENT_SECRET, env_1.env.GOOGLE_REDIRECT_URI);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials; // contains access_token, expiry_date
};
exports.refreshGoogleToken = refreshGoogleToken;
