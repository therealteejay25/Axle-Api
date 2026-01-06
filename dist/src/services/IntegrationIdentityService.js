"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationIdentityService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./logger");
const X_API = "https://api.twitter.com/2";
const GITHUB_API = "https://api.github.com";
const SLACK_API = "https://slack.com/api";
const IG_GRAPH_API = "https://graph.facebook.com/v18.0";
class IntegrationIdentityService {
    static async hydrateIfNeeded(integrationDoc, decrypted) {
        try {
            if (integrationDoc.provider === "twitter") {
                const hasUserId = !!decrypted.metadata?.xUserId;
                if (!hasUserId) {
                    const res = await axios_1.default.get(`${X_API}/users/me`, {
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
                    const res = await axios_1.default.get(`${GITHUB_API}/user`, {
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
                    const res = await axios_1.default.post(`${SLACK_API}/auth.test`, {}, { headers: { Authorization: `Bearer ${decrypted.accessToken}` } });
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
                    const res = await axios_1.default.get(`${IG_GRAPH_API}/me`, {
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
        }
        catch (err) {
            logger_1.logger.warn("Integration identity hydration failed", {
                provider: integrationDoc.provider,
                error: err?.message
            });
            return decrypted;
        }
    }
}
exports.IntegrationIdentityService = IntegrationIdentityService;
