import { tool, RunContext } from "@openai/agents";
import { z } from "zod";

export const postXTweet = tool({
  name: "post_x_tweet",
  description: "Post a tweet/status to X for the connected account",
  parameters: z.object({ text: z.string() }),
  execute: async ({ text }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");

    // Replace with X/Twitter API calls in production.
    return { message: "Simulated X post created", text };
  },
});

export default {};

export const list_x_posts = tool({
  name: "list_x_posts",
  description: "List recent posts from the connected X account (simulated)",
  parameters: z.object({ limit: z.number().default(10) }),
  execute: async ({ limit }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    const posts = Array.from({
      length: Math.max(0, Math.min(10, limit)),
    }).map((_, i) => ({ id: `x_${i}`, text: `Sample X post ${i + 1}` }));
    return posts;
  },
});

export const send_x_dm = tool({
  name: "send_x_dm",
  description: "Send a DM on X (simulated for MVP)",
  parameters: z.object({ recipient: z.string(), text: z.string() }),
  execute: async ({ recipient, text }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    return { ok: true, message: `Simulated DM sent to ${recipient}`, text };
  },
});

export const get_x_timeline = tool({
  name: "get_x_timeline",
  description: "Get timeline/home feed from X",
  parameters: z.object({ limit: z.number().default(20) }),
  execute: async ({ limit }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    // Simulated - replace with actual X API v2 calls
    return { tweets: Array.from({ length: limit }).map((_, i) => ({ id: `tweet_${i}`, text: `Sample tweet ${i + 1}` })) };
  },
});

export const reply_to_tweet = tool({
  name: "reply_to_tweet",
  description: "Reply to a tweet",
  parameters: z.object({ tweet_id: z.string(), text: z.string() }),
  execute: async ({ tweet_id, text }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    return { ok: true, message: `Simulated reply to tweet ${tweet_id}`, text };
  },
});

export const like_tweet = tool({
  name: "like_tweet",
  description: "Like a tweet",
  parameters: z.object({ tweet_id: z.string() }),
  execute: async ({ tweet_id }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    return { ok: true, message: `Simulated like on tweet ${tweet_id}` };
  },
});

export const retweet = tool({
  name: "retweet",
  description: "Retweet a tweet",
  parameters: z.object({ tweet_id: z.string() }),
  execute: async ({ tweet_id }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    return { ok: true, message: `Simulated retweet of tweet ${tweet_id}` };
  },
});

export const get_tweet = tool({
  name: "get_tweet",
  description: "Get details for a specific tweet",
  parameters: z.object({ tweet_id: z.string() }),
  execute: async ({ tweet_id }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    return { id: tweet_id, text: "Sample tweet content", author: "sample_user" };
  },
});

export const search_tweets = tool({
  name: "search_tweets",
  description: "Search for tweets",
  parameters: z.object({ query: z.string(), limit: z.number().default(20) }),
  execute: async ({ query, limit }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    return { tweets: Array.from({ length: limit }).map((_, i) => ({ id: `tweet_${i}`, text: `Result for "${query}" ${i + 1}` })) };
  },
});

export const get_mentions = tool({
  name: "get_x_mentions",
  description: "Get mentions of the authenticated user",
  parameters: z.object({ limit: z.number().default(20) }),
  execute: async ({ limit }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    return { mentions: Array.from({ length: limit }).map((_, i) => ({ id: `mention_${i}`, text: `Mention ${i + 1}` })) };
  },
});

export const follow_user = tool({
  name: "follow_x_user",
  description: "Follow a user on X",
  parameters: z.object({ username: z.string() }),
  execute: async ({ username }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    return { ok: true, message: `Simulated follow of ${username}` };
  },
});

export const get_user_profile = tool({
  name: "get_x_user_profile",
  description: "Get user profile information",
  parameters: z.object({ username: z.string() }),
  execute: async ({ username }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["x"]?.accessToken;
    if (!accessToken) throw new Error("No X integration found for user");
    return { username, followers: 0, following: 0, tweets: 0 };
  },
});