import { google } from "googleapis";
import { logger } from "../logger";

interface DriveResult {
  recentFiles: Array<{
    id: string;
    name: string;
    mimeType: string;
    modifiedTime: string;
    webViewLink: string;
    iconLink: string;
    owners: string[];
  }>;
  sharedWithMe: Array<{
    id: string;
    name: string;
    mimeType: string;
    sharedTime: string;
    webViewLink: string;
    sharedBy: string;
  }>;
}

export async function driveFetcher(
  userId: string,
  integrations: any[]
): Promise<DriveResult | null> {
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

    // Fetch recent files
    const recentResponse = await drive.files.list({
      pageSize: 20,
      orderBy: "modifiedTime desc",
      fields:
        "files(id, name, mimeType, modifiedTime, webViewLink, iconLink, owners)",
      q: "trashed = false",
    });

    const recentFiles = (recentResponse.data.files || []).slice(0, 10).map((file) => ({
      id: file.id || "",
      name: file.name || "Untitled",
      mimeType: file.mimeType || "",
      modifiedTime: file.modifiedTime || "",
      webViewLink: file.webViewLink || "",
      iconLink: file.iconLink || "",
      owners: (file.owners || []).map((owner) => owner.displayName || owner.emailAddress || ""),
    }));

    // Fetch files shared with me
    const sharedResponse = await drive.files.list({
      pageSize: 10,
      orderBy: "sharedWithMeTime desc",
      fields:
        "files(id, name, mimeType, sharedWithMeTime, webViewLink, sharingUser)",
      q: "sharedWithMe = true and trashed = false",
    });

    const sharedWithMe = (sharedResponse.data.files || []).map((file) => ({
      id: file.id || "",
      name: file.name || "Untitled",
      mimeType: file.mimeType || "",
      sharedTime: file.sharedWithMeTime || "",
      webViewLink: file.webViewLink || "",
      sharedBy: file.sharingUser?.displayName || file.sharingUser?.emailAddress || "Unknown",
    }));

    return {
      recentFiles,
      sharedWithMe,
    };
  } catch (error: any) {
    logger.error(`Drive fetcher error for user ${userId}:`, error);
    return null;
  }
}
