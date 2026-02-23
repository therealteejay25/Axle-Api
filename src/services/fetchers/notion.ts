import { Client } from "@notionhq/client";
import { logger } from "../logger";

interface NotionResult {
  recentPages: Array<{
    id: string;
    title: string;
    url: string;
    lastEditedTime: string;
    icon?: string;
  }>;
  databases: Array<{
    id: string;
    title: string;
    url: string;
    lastEditedTime: string;
  }>;
}

export async function notionFetcher(
  userId: string,
  integrations: any[]
): Promise<NotionResult | null> {
  try {
    // Find Notion integration
    const notionIntegration = integrations.find(
      (i) => i.provider === "notion" && i.userId.toString() === userId
    );

    if (!notionIntegration || !notionIntegration.accessToken) {
      logger.debug(`No Notion integration found for user ${userId}`);
      return null;
    }

    const notion = new Client({
      auth: notionIntegration.accessToken,
    });

    // Search for recently edited pages
    const searchResponse = await notion.search({
      filter: {
        property: "object",
        value: "page",
      },
      sort: {
        direction: "descending",
        timestamp: "last_edited_time",
      },
      page_size: 20,
    });

    const recentPages = searchResponse.results
      .filter((page: any) => page.object === "page")
      .slice(0, 10)
      .map((page: any) => {
        const title =
          page.properties?.title?.title?.[0]?.plain_text ||
          page.properties?.Name?.title?.[0]?.plain_text ||
          "Untitled";

        return {
          id: page.id,
          title,
          url: page.url,
          lastEditedTime: page.last_edited_time,
          icon: page.icon?.emoji || page.icon?.external?.url,
        };
      });

    // Search for databases
    const databasesResponse = await notion.search({
      filter: {
        property: "object",
        value: "database",
      },
      sort: {
        direction: "descending",
        timestamp: "last_edited_time",
      },
      page_size: 10,
    });

    const databases = databasesResponse.results
      .filter((db: any) => db.object === "database")
      .map((db: any) => {
        const title =
          db.title?.[0]?.plain_text || "Untitled Database";

        return {
          id: db.id,
          title,
          url: db.url,
          lastEditedTime: db.last_edited_time,
        };
      });

    return {
      recentPages,
      databases,
    };
  } catch (error: any) {
    logger.error(`Notion fetcher error for user ${userId}:`, error);
    return null;
  }
}
