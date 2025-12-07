import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import axios from "axios";

export const sendSlackMessage = tool({
  name: "send_slack_message",
  description: "Send a message to a Slack channel as the connected user",
  parameters: z.object({
    channel: z.string(),
    text: z.string(),
    asUser: z.boolean().nullable().default(null),
  }),
  execute: async ({ channel, text }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    // Call Slack Web API chat.postMessage
    const res = await axios.post(
      "https://slack.com/api/chat.postMessage",
      { channel, text },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.data || res.data.ok === false) {
      throw new Error(
        `Slack API error: ${res.data.error || JSON.stringify(res.data)}`
      );
    }

    return res.data;
  },
});

export const list_channels = tool({
  name: "list_channels",
  description: "List slack channels available to the connected user",
  parameters: z.object({ limit: z.number().default(100) }),
  execute: async ({ limit }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    const res = await axios.get(
      `https://slack.com/api/conversations.list?limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data.channels || [];
  },
});

export const open_dm = tool({
  name: "open_dm",
  description:
    "Open (or find) a DM channel with a user by Slack user ID or email",
  parameters: z.object({ user: z.string() }),
  execute: async ({ user }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    // conversations.open supports users by ID; for email we'd need users.lookupByEmail (not implemented here)
    const res = await axios.post(
      `https://slack.com/api/conversations.open`,
      { users: user },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data.channel;
  },
});

// --- MESSAGES & THREADS --- //

export const get_channel_history = tool({
  name: "get_channel_history",
  description: "Get message history for a Slack channel",
  parameters: z.object({
    channel: z.string(),
    limit: z.number().default(100),
    oldest: z.string().nullable().optional(),
    latest: z.string().nullable().optional(),
  }),
  execute: async ({ channel, limit, oldest, latest }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    const params = new URLSearchParams({ channel, limit: limit.toString() });
    if (oldest) params.append("oldest", oldest);
    if (latest) params.append("latest", latest);

    const res = await axios.get(
      `https://slack.com/api/conversations.history?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data;
  },
});

export const reply_to_message = tool({
  name: "reply_to_message",
  description: "Reply to a message in a thread",
  parameters: z.object({
    channel: z.string(),
    text: z.string(),
    thread_ts: z.string(),
  }),
  execute: async ({ channel, text, thread_ts }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    const res = await axios.post(
      "https://slack.com/api/chat.postMessage",
      { channel, text, thread_ts },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data;
  },
});

export const get_thread_replies = tool({
  name: "get_thread_replies",
  description: "Get replies in a thread",
  parameters: z.object({
    channel: z.string(),
    ts: z.string(), // timestamp of parent message
  }),
  execute: async ({ channel, ts }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    const res = await axios.get(
      `https://slack.com/api/conversations.replies?channel=${channel}&ts=${ts}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data;
  },
});

// --- REACTIONS --- //

export const add_reaction = tool({
  name: "add_reaction",
  description: "Add a reaction emoji to a message",
  parameters: z.object({
    channel: z.string(),
    timestamp: z.string(),
    name: z.string(), // emoji name without colons
  }),
  execute: async ({ channel, timestamp, name }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    const res = await axios.post(
      "https://slack.com/api/reactions.add",
      { channel, timestamp, name },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data;
  },
});

export const remove_reaction = tool({
  name: "remove_reaction",
  description: "Remove a reaction emoji from a message",
  parameters: z.object({
    channel: z.string(),
    timestamp: z.string(),
    name: z.string(),
  }),
  execute: async ({ channel, timestamp, name }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    const res = await axios.post(
      "https://slack.com/api/reactions.remove",
      { channel, timestamp, name },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data;
  },
});

// --- USERS --- //

export const list_users = tool({
  name: "list_slack_users",
  description: "List users in the Slack workspace",
  parameters: z.object({
    limit: z.number().default(100),
  }),
  execute: async ({ limit }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    const res = await axios.get(
      `https://slack.com/api/users.list?limit=${limit}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data.members || [];
  },
});

export const get_user_info = tool({
  name: "get_slack_user_info",
  description: "Get information about a Slack user",
  parameters: z.object({
    user: z.string(), // user ID
  }),
  execute: async ({ user }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    const res = await axios.get(
      `https://slack.com/api/users.info?user=${user}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data.user;
  },
});

// --- FILES --- //

export const upload_file = tool({
  name: "upload_slack_file",
  description: "Upload a file to a Slack channel",
  parameters: z.object({
    channel: z.string(),
    file: z.string(), // base64 encoded file or URL
    filename: z.string(),
    title: z.string().nullable().optional(),
    initial_comment: z.string().nullable().optional(),
  }),
  execute: async ({ channel, file, filename, title, initial_comment }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    // This is simplified - actual implementation would need FormData
    const res = await axios.post(
      "https://slack.com/api/files.upload",
      { channels: channel, file, filename, title, initial_comment },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data;
  },
});

export const list_files = tool({
  name: "list_slack_files",
  description: "List files shared in the workspace",
  parameters: z.object({
    channel: z.string().nullable().optional(),
    user: z.string().nullable().optional(),
    types: z.string().nullable().optional(), // comma-separated: images, pdfs, etc.
  }),
  execute: async ({ channel, user, types }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    const params = new URLSearchParams();
    if (channel) params.append("channel", channel);
    if (user) params.append("user", user);
    if (types) params.append("types", types);

    const res = await axios.get(
      `https://slack.com/api/files.list?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data.files || [];
  },
});

// --- SEARCH --- //

export const search_messages = tool({
  name: "search_slack_messages",
  description: "Search for messages in Slack",
  parameters: z.object({
    query: z.string(),
    sort: z.enum(["score", "timestamp"]).default("score"),
    count: z.number().default(20),
  }),
  execute: async ({ query, sort, count }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["slack"]?.accessToken;
    if (!accessToken) throw new Error("No Slack integration found for user");

    const res = await axios.get(
      `https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&sort=${sort}&count=${count}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.data || res.data.ok === false)
      throw new Error(`Slack API error: ${res.data.error}`);
    return res.data;
  },
});

export default {};
