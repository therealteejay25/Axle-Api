import axios from "axios";
import { logger } from "../logger";

interface GitHubResult {
  notifications: Array<{
    id: string;
    title: string;
    repo: string;
    type: string;
    url: string;
    updatedAt: string;
  }>;
}

export async function githubFetcher(
  userId: string,
  integrations: any[]
): Promise<GitHubResult | null> {
  try {
    // Find GitHub integration
    const githubIntegration = integrations.find(
      (i) => i.provider === "github" && i.userId.toString() === userId
    );

    if (!githubIntegration || !githubIntegration.accessToken) {
      logger.debug(`No GitHub integration found for user ${userId}`);
      return null;
    }

    // Calculate timestamp for last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Fetch notifications from GitHub API
    const response = await axios.get("https://api.github.com/notifications", {
      headers: {
        Authorization: `Bearer ${githubIntegration.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
      params: {
        since: yesterday.toISOString(),
        per_page: 50,
      },
    });

    const notifications = response.data.map((notif: any) => ({
      id: notif.id,
      title: notif.subject.title,
      repo: notif.repository.full_name,
      type: notif.subject.type,
      url: notif.subject.url || notif.repository.html_url,
      updatedAt: notif.updated_at,
    }));

    return { notifications };
  } catch (error: any) {
    logger.error(`GitHub fetcher error for user ${userId}:`, error);
    return null;
  }
}
