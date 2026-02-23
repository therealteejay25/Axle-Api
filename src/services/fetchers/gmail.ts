import { google } from "googleapis";
import { logger } from "../logger";

interface GmailResult {
  unread: number;
  emails: Array<{
    id: string;
    subject: string;
    from: string;
    date: string;
    snippet: string;
    link: string;
  }>;
}

export async function gmailFetcher(
  userId: string,
  integrations: any[]
): Promise<GmailResult | null> {
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

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Calculate timestamp for last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const afterTimestamp = Math.floor(yesterday.getTime() / 1000);

    // List unread messages from last 24h
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: `is:unread after:${afterTimestamp}`,
      maxResults: 20,
    });

    const messages = listResponse.data.messages || [];
    const unreadCount = messages.length;

    if (messages.length === 0) {
      return { unread: 0, emails: [] };
    }

    // Fetch metadata for top 10 messages in parallel
    const top10 = messages.slice(0, 10);
    const emailPromises = top10.map(async (msg) => {
      try {
        const msgData = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });

        const headers = msgData.data.payload?.headers || [];
        const subject =
          headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
        const from = headers.find((h) => h.name === "From")?.value || "Unknown";
        const date = headers.find((h) => h.name === "Date")?.value || "";

        return {
          id: msg.id!,
          subject,
          from,
          date,
          snippet: msgData.data.snippet || "",
          link: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
        };
      } catch (error: any) {
        logger.error(`Failed to fetch email ${msg.id}:`, error);
        return null;
      }
    });

    const emails = (await Promise.all(emailPromises)).filter(
      (e) => e !== null
    ) as GmailResult["emails"];

    return {
      unread: unreadCount,
      emails,
    };
  } catch (error: any) {
    logger.error(`Gmail fetcher error for user ${userId}:`, error);
    return null;
  }
}
