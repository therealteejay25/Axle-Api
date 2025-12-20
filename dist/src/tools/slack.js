"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.search_messages = exports.list_files = exports.upload_file = exports.get_user_info = exports.list_users = exports.remove_reaction = exports.add_reaction = exports.get_thread_replies = exports.reply_to_message = exports.get_channel_history = exports.open_dm = exports.list_channels = exports.sendSlackMessage = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
exports.sendSlackMessage = (0, agents_1.tool)({
    name: "send_slack_message",
    description: "Send a message to a Slack channel as the connected user",
    parameters: zod_1.z.object({
        channel: zod_1.z.string(),
        text: zod_1.z.string(),
        asUser: zod_1.z.boolean().nullable().default(null),
    }),
    execute: async ({ channel, text }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        // Call Slack Web API chat.postMessage
        const res = await axios_1.default.post("https://slack.com/api/chat.postMessage", { channel, text }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });
        if (!res.data || res.data.ok === false) {
            throw new Error(`Slack API error: ${res.data.error || JSON.stringify(res.data)}`);
        }
        return res.data;
    },
});
exports.list_channels = (0, agents_1.tool)({
    name: "list_channels",
    description: "List slack channels available to the connected user",
    parameters: zod_1.z.object({ limit: zod_1.z.number().default(100) }),
    execute: async ({ limit }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        const res = await axios_1.default.get(`https://slack.com/api/conversations.list?limit=${limit}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data.channels || [];
    },
});
exports.open_dm = (0, agents_1.tool)({
    name: "open_dm",
    description: "Open (or find) a DM channel with a user by Slack user ID or email",
    parameters: zod_1.z.object({ user: zod_1.z.string() }),
    execute: async ({ user }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        // conversations.open supports users by ID; for email we'd need users.lookupByEmail (not implemented here)
        const res = await axios_1.default.post(`https://slack.com/api/conversations.open`, { users: user }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data.channel;
    },
});
// --- MESSAGES & THREADS --- //
exports.get_channel_history = (0, agents_1.tool)({
    name: "get_channel_history",
    description: "Get message history for a Slack channel",
    parameters: zod_1.z.object({
        channel: zod_1.z.string(),
        limit: zod_1.z.number().default(100),
        oldest: zod_1.z.string().nullable().optional(),
        latest: zod_1.z.string().nullable().optional(),
    }),
    execute: async ({ channel, limit, oldest, latest }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        const params = new URLSearchParams({ channel, limit: limit.toString() });
        if (oldest)
            params.append("oldest", oldest);
        if (latest)
            params.append("latest", latest);
        const res = await axios_1.default.get(`https://slack.com/api/conversations.history?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data;
    },
});
exports.reply_to_message = (0, agents_1.tool)({
    name: "reply_to_message",
    description: "Reply to a message in a thread",
    parameters: zod_1.z.object({
        channel: zod_1.z.string(),
        text: zod_1.z.string(),
        thread_ts: zod_1.z.string(),
    }),
    execute: async ({ channel, text, thread_ts }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        const res = await axios_1.default.post("https://slack.com/api/chat.postMessage", { channel, text, thread_ts }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data;
    },
});
exports.get_thread_replies = (0, agents_1.tool)({
    name: "get_thread_replies",
    description: "Get replies in a thread",
    parameters: zod_1.z.object({
        channel: zod_1.z.string(),
        ts: zod_1.z.string(), // timestamp of parent message
    }),
    execute: async ({ channel, ts }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        const res = await axios_1.default.get(`https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data;
    },
});
// --- REACTIONS --- //
exports.add_reaction = (0, agents_1.tool)({
    name: "add_reaction",
    description: "Add a reaction emoji to a message",
    parameters: zod_1.z.object({
        channel: zod_1.z.string(),
        timestamp: zod_1.z.string(),
        name: zod_1.z.string(), // emoji name without colons
    }),
    execute: async ({ channel, timestamp, name }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        const res = await axios_1.default.post("https://slack.com/api/reactions.add", { channel, timestamp, name }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data;
    },
});
exports.remove_reaction = (0, agents_1.tool)({
    name: "remove_reaction",
    description: "Remove a reaction emoji from a message",
    parameters: zod_1.z.object({
        channel: zod_1.z.string(),
        timestamp: zod_1.z.string(),
        name: zod_1.z.string(),
    }),
    execute: async ({ channel, timestamp, name }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        const res = await axios_1.default.post("https://slack.com/api/reactions.remove", { channel, timestamp, name }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data;
    },
});
// --- USERS --- //
exports.list_users = (0, agents_1.tool)({
    name: "list_slack_users",
    description: "List users in the Slack workspace",
    parameters: zod_1.z.object({
        limit: zod_1.z.number().default(100),
    }),
    execute: async ({ limit }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        const res = await axios_1.default.get(`https://slack.com/api/users.list?limit=${limit}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data.members || [];
    },
});
exports.get_user_info = (0, agents_1.tool)({
    name: "get_slack_user_info",
    description: "Get information about a Slack user",
    parameters: zod_1.z.object({
        user: zod_1.z.string(), // user ID
    }),
    execute: async ({ user }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        const res = await axios_1.default.get(`https://slack.com/api/users.info?user=${user}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data.user;
    },
});
// --- FILES --- //
exports.upload_file = (0, agents_1.tool)({
    name: "upload_slack_file",
    description: "Upload a file to a Slack channel",
    parameters: zod_1.z.object({
        channel: zod_1.z.string(),
        file: zod_1.z.string(), // base64 encoded file or URL
        filename: zod_1.z.string(),
        title: zod_1.z.string().nullable().optional(),
        initial_comment: zod_1.z.string().nullable().optional(),
    }),
    execute: async ({ channel, file, filename, title, initial_comment }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        // This is simplified - actual implementation would need FormData
        const res = await axios_1.default.post("https://slack.com/api/files.upload", { channels: channel, file, filename, title, initial_comment }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data;
    },
});
exports.list_files = (0, agents_1.tool)({
    name: "list_slack_files",
    description: "List files shared in the workspace",
    parameters: zod_1.z.object({
        channel: zod_1.z.string().nullable().optional(),
        user: zod_1.z.string().nullable().optional(),
        types: zod_1.z.string().nullable().optional(), // comma-separated: images, pdfs, etc.
    }),
    execute: async ({ channel, user, types }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        const params = new URLSearchParams();
        if (channel)
            params.append("channel", channel);
        if (user)
            params.append("user", user);
        if (types)
            params.append("types", types);
        const res = await axios_1.default.get(`https://slack.com/api/files.list?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data.files || [];
    },
});
// --- SEARCH --- //
exports.search_messages = (0, agents_1.tool)({
    name: "search_slack_messages",
    description: "Search for messages in Slack",
    parameters: zod_1.z.object({
        query: zod_1.z.string(),
        sort: zod_1.z.enum(["score", "timestamp"]).default("score"),
        count: zod_1.z.number().default(20),
    }),
    execute: async ({ query, sort, count }, ctx) => {
        const accessToken = ctx?.context?.["slack"]?.accessToken;
        if (!accessToken)
            throw new Error("No Slack integration found for user");
        const res = await axios_1.default.get(`https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&sort=${sort}&count=${count}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.data || res.data.ok === false)
            throw new Error(`Slack API error: ${res.data.error}`);
        return res.data;
    },
});
exports.default = {};
