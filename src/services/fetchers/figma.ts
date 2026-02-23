import axios from "axios";
import { logger } from "../logger";

interface FigmaResult {
  notifications: Array<{
    id: string;
    type: string;
    message: string;
    fileKey: string;
    fileName: string;
    createdAt: string;
    link: string;
  }>;
  recentFiles: Array<{
    key: string;
    name: string;
    lastModified: string;
    thumbnailUrl: string;
    link: string;
  }>;
}

export async function figmaFetcher(
  userId: string,
  integrations: any[]
): Promise<FigmaResult | null> {
  try {
    // Find Figma integration
    const figmaIntegration = integrations.find(
      (i) => i.provider === "figma" && i.userId.toString() === userId
    );

    if (!figmaIntegration || !figmaIntegration.accessToken) {
      logger.debug(`No Figma integration found for user ${userId}`);
      return null;
    }

    const token = figmaIntegration.accessToken;

    // Fetch recent files
    const filesResponse = await axios.get(
      "https://api.figma.com/v1/me/files",
      {
        headers: {
          "X-Figma-Token": token,
        },
      }
    );

    const files = filesResponse.data.files || [];
    const recentFiles = files.slice(0, 10).map((file: any) => ({
      key: file.key,
      name: file.name,
      lastModified: file.last_modified,
      thumbnailUrl: file.thumbnail_url,
      link: `https://www.figma.com/file/${file.key}`,
    }));

    // Fetch notifications (comments, mentions, etc.)
    let notifications: FigmaResult["notifications"] = [];
    try {
      const notificationsResponse = await axios.get(
        "https://api.figma.com/v1/me/notifications",
        {
          headers: {
            "X-Figma-Token": token,
          },
        }
      );

      notifications = (notificationsResponse.data.notifications || [])
        .slice(0, 20)
        .map((notif: any) => ({
          id: notif.id,
          type: notif.type,
          message: notif.message || notif.comment?.message || "",
          fileKey: notif.file_key,
          fileName: notif.file_name,
          createdAt: notif.created_at,
          link: `https://www.figma.com/file/${notif.file_key}`,
        }));
    } catch (error: any) {
      // Notifications endpoint might not be available for all tokens
      logger.debug(`Figma notifications not available: ${error.message}`);
    }

    return {
      notifications,
      recentFiles,
    };
  } catch (error: any) {
    logger.error(`Figma fetcher error for user ${userId}:`, error);
    return null;
  }
}
