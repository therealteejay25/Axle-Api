import axios from "axios";
import { Integration, IIntegration } from "../models/Integration";
import { logger } from "./logger";

type DecryptedIntegration = {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
};

const X_API = "https://api.twitter.com/2";
const GITHUB_API = "https://api.github.com";
const SLACK_API = "https://slack.com/api";
const IG_GRAPH_API = "https://graph.facebook.com/v18.0";

export class IntegrationIdentityService {
  static async hydrateIfNeeded(integrationDoc: IIntegration, decrypted: DecryptedIntegration): Promise<DecryptedIntegration> {
    try {
      if (integrationDoc.provider === "twitter") {
        const hasUserId = !!decrypted.metadata?.xUserId;
        if (!hasUserId) {
          const res = await axios.get(`${X_API}/users/me`, {
            headers: { Authorization: `Bearer ${decrypted.accessToken}` }
          });
          const me = res.data?.data;
          if (me?.id) {
            decrypted.metadata = {
              ...(decrypted.metadata || {}),
              xUserId: me.id,
              xUsername: me.username,
              xName: me.name
            };
            integrationDoc.metadata = decrypted.metadata;
            await integrationDoc.save();
          }
        }
      }

      if (integrationDoc.provider === "github") {
        const hasLogin = !!decrypted.metadata?.githubLogin;
        if (!hasLogin) {
          const res = await axios.get(`${GITHUB_API}/user`, {
            headers: {
              Authorization: `Bearer ${decrypted.accessToken}`,
              Accept: "application/vnd.github.v3+json"
            }
          });
          const me = res.data;
          if (me?.login) {
            decrypted.metadata = {
              ...(decrypted.metadata || {}),
              githubLogin: me.login,
              githubUserId: me.id,
              githubName: me.name
            };
            integrationDoc.metadata = decrypted.metadata;
            await integrationDoc.save();
          }
        }
      }

      if (integrationDoc.provider === "slack") {
        const hasSlackUserId = !!decrypted.metadata?.slackUserId;
        if (!hasSlackUserId) {
          const res = await axios.post(
            `${SLACK_API}/auth.test`,
            {},
            { headers: { Authorization: `Bearer ${decrypted.accessToken}` } }
          );
          if (!res.data?.ok) {
            throw new Error(`Slack auth.test failed: ${res.data?.error || "unknown"}`);
          }
          decrypted.metadata = {
            ...(decrypted.metadata || {}),
            slackUserId: res.data.user_id,
            slackTeamId: res.data.team_id,
            slackTeam: res.data.team,
            slackUrl: res.data.url
          };
          integrationDoc.metadata = decrypted.metadata;
          await integrationDoc.save();
        }
      }

      if (integrationDoc.provider === "instagram") {
        const hasIgUserId = !!decrypted.metadata?.igUserId;
        if (!hasIgUserId) {
          // Best-effort: Graph API /me (works for many Instagram Graph tokens)
          const res = await axios.get(`${IG_GRAPH_API}/me`, {
            params: {
              fields: "id,username,name",
              access_token: decrypted.accessToken
            }
          });
          const me = res.data;
          if (me?.id) {
            decrypted.metadata = {
              ...(decrypted.metadata || {}),
              igUserId: me.id,
              igUsername: me.username,
              igName: me.name
            };
            integrationDoc.metadata = decrypted.metadata;
            await integrationDoc.save();
          }
        }
      }

      return decrypted;
    } catch (err: any) {
      logger.warn("Integration identity hydration failed", {
        provider: integrationDoc.provider,
        error: err?.message
      });
      return decrypted;
    }
  }
}
