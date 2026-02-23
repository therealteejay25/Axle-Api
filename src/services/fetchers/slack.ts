import axios from "axios";
import { logger } from "../logger";

interface SlackResult {
  unreads: Array<{
    channel: string;
    messageCount: number;
    lastMessage: string;
    ts: string;
  }>;
}

export async function slackFetcher(
  userId: string,
  integrations: any[]
): Promise<SlackResult | null> {
  try {
    // Find Slack integration
    const slackIntegration = integrations.find(
      (i) => i.provider === "slack" && i.userId.toString() === userId
    );

    if (!slackIntegration || !slackIntegration.accessToken) {
      logger.debug(`No Slack integration found for user ${userId}`);
      return null;
    }

    const token = slackIntegration.accessToken;

    // Get list of conversations
    const conversationsResponse = await axios.get(
      "https://slack.com/api/conversations.list",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          types: "public_channel,private_channel,im,mpim",
          exclude_archived: true,
        },
      }
    );

    if (!conversationsResponse.data.ok) {
      logger.error(
        `Slack conversations.list failed: ${conversationsResponse.data.error}`
      );
      return null;
    }

    const channels = conversationsResponse.data.channels || [];

    // Filter channels with unread messages
    const unreadChannels = channels.filter(
      (ch: any) => ch.unread_count && ch.unread_count > 0
    );

    // Fetch history for channels with unreads
    const unreadsPromises = unreadChannels.slice(0, 10).map(async (ch: any) => {
      try {
        const historyResponse = await axios.get(
          "https://slack.com/api/conversations.history",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              channel: ch.id,
              limit: 1,
            },
          }
        );

        if (!historyResponse.data.ok || !historyResponse.data.messages?.length) {
          return null;
        }

        const lastMsg = historyResponse.data.messages[0];

        return {
          channel: ch.name || ch.id,
          messageCount: ch.unread_count,
          lastMessage: lastMsg.text || "(No text)",
          ts: lastMsg.ts,
        };
      } catch (error: any) {
        logger.error(`Failed to fetch Slack history for ${ch.id}:`, error);
        return null;
      }
    });

    const unreads = (await Promise.all(unreadsPromises)).filter(
      (u) => u !== null
    ) as SlackResult["unreads"];

    return { unreads };
  } catch (error: any) {
    logger.error(`Slack fetcher error for user ${userId}:`, error);
    return null;
  }
}
