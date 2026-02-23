import { google } from "googleapis";
import { logger } from "../logger";

interface DocsResult {
  recentDocs: Array<{
    id: string;
    name: string;
    modifiedTime: string;
    webViewLink: string;
    lastModifiedBy: string;
  }>;
}

export async function docsFetcher(
  userId: string,
  integrations: any[]
): Promise<DocsResult | null> {
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

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Fetch recent Google Docs
    const response = await drive.files.list({
      pageSize: 15,
      orderBy: "modifiedTime desc",
      fields:
        "files(id, name, modifiedTime, webViewLink, lastModifyingUser)",
      q: "mimeType='application/vnd.google-apps.document' and trashed = false",
    });

    const recentDocs = (response.data.files || []).slice(0, 10).map((file) => ({
      id: file.id || "",
      name: file.name || "Untitled Document",
      modifiedTime: file.modifiedTime || "",
      webViewLink: file.webViewLink || "",
      lastModifiedBy:
        file.lastModifyingUser?.displayName ||
        file.lastModifyingUser?.emailAddress ||
        "Unknown",
    }));

    return {
      recentDocs,
    };
  } catch (error: any) {
    logger.error(`Docs fetcher error for user ${userId}:`, error);
    return null;
  }
}
