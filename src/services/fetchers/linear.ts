import axios from "axios";
import { logger } from "../logger";

interface LinearResult {
  assignedIssues: Array<{
    id: string;
    title: string;
    identifier: string;
    priority: number;
    state: string;
    dueDate?: string;
    url: string;
    team: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    issue: string;
    createdAt: string;
  }>;
}

export async function linearFetcher(
  userId: string,
  integrations: any[]
): Promise<LinearResult | null> {
  try {
    // Find Linear integration
    const linearIntegration = integrations.find(
      (i) => i.provider === "linear" && i.userId.toString() === userId
    );

    if (!linearIntegration || !linearIntegration.accessToken) {
      logger.debug(`No Linear integration found for user ${userId}`);
      return null;
    }

    const token = linearIntegration.accessToken;

    // GraphQL query for assigned issues
    const issuesQuery = `
      query {
        viewer {
          assignedIssues(first: 20, filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
            nodes {
              id
              title
              identifier
              priority
              state {
                name
              }
              dueDate
              url
              team {
                name
              }
            }
          }
        }
      }
    `;

    const issuesResponse = await axios.post(
      "https://api.linear.app/graphql",
      { query: issuesQuery },
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );

    const issues = issuesResponse.data.data?.viewer?.assignedIssues?.nodes || [];
    const assignedIssues = issues.map((issue: any) => ({
      id: issue.id,
      title: issue.title,
      identifier: issue.identifier,
      priority: issue.priority,
      state: issue.state.name,
      dueDate: issue.dueDate,
      url: issue.url,
      team: issue.team.name,
    }));

    // Fetch recent notifications
    const notificationsQuery = `
      query {
        notifications(first: 20) {
          nodes {
            id
            type
            createdAt
            issue {
              identifier
              title
            }
          }
        }
      }
    `;

    let recentActivity: LinearResult["recentActivity"] = [];
    try {
      const notificationsResponse = await axios.post(
        "https://api.linear.app/graphql",
        { query: notificationsQuery },
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      const notifications =
        notificationsResponse.data.data?.notifications?.nodes || [];
      recentActivity = notifications.map((notif: any) => ({
        id: notif.id,
        type: notif.type,
        issue: notif.issue?.identifier || "",
        createdAt: notif.createdAt,
      }));
    } catch (error: any) {
      logger.debug(`Linear notifications not available: ${error.message}`);
    }

    return {
      assignedIssues,
      recentActivity,
    };
  } catch (error: any) {
    logger.error(`Linear fetcher error for user ${userId}:`, error);
    return null;
  }
}
