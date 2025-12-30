"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_user_profile = exports.follow_user = exports.get_mentions = exports.search_tweets = exports.get_tweet = exports.retweet = exports.like_tweet = exports.reply_to_tweet = exports.get_x_timeline = exports.send_x_dm = exports.list_x_posts = exports.postXTweet = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
exports.postXTweet = (0, agents_1.tool)({
    name: "post_x_tweet",
    description: "Post a tweet/status to X for the connected account",
    parameters: zod_1.z.object({ text: zod_1.z.string() }),
    execute: async ({ text }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        // Replace with X/Twitter API calls in production.
        return { message: "Simulated X post created", text };
    },
});
exports.default = {};
exports.list_x_posts = (0, agents_1.tool)({
    name: "list_x_posts",
    description: "List recent posts from the connected X account (simulated)",
    parameters: zod_1.z.object({ limit: zod_1.z.number().default(10) }),
    execute: async ({ limit }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        const posts = Array.from({
            length: Math.max(0, Math.min(10, limit)),
        }).map((_, i) => ({ id: `x_${i}`, text: `Sample X post ${i + 1}` }));
        return posts;
    },
});
exports.send_x_dm = (0, agents_1.tool)({
    name: "send_x_dm",
    description: "Send a DM on X (simulated for MVP)",
    parameters: zod_1.z.object({ recipient: zod_1.z.string(), text: zod_1.z.string() }),
    execute: async ({ recipient, text }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        return { ok: true, message: `Simulated DM sent to ${recipient}`, text };
    },
});
exports.get_x_timeline = (0, agents_1.tool)({
    name: "get_x_timeline",
    description: "Get timeline/home feed from X",
    parameters: zod_1.z.object({ limit: zod_1.z.number().default(20) }),
    execute: async ({ limit }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        // Simulated - replace with actual X API v2 calls
        return { tweets: Array.from({ length: limit }).map((_, i) => ({ id: `tweet_${i}`, text: `Sample tweet ${i + 1}` })) };
    },
});
exports.reply_to_tweet = (0, agents_1.tool)({
    name: "reply_to_tweet",
    description: "Reply to a tweet",
    parameters: zod_1.z.object({ tweet_id: zod_1.z.string(), text: zod_1.z.string() }),
    execute: async ({ tweet_id, text }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        return { ok: true, message: `Simulated reply to tweet ${tweet_id}`, text };
    },
});
exports.like_tweet = (0, agents_1.tool)({
    name: "like_tweet",
    description: "Like a tweet",
    parameters: zod_1.z.object({ tweet_id: zod_1.z.string() }),
    execute: async ({ tweet_id }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        return { ok: true, message: `Simulated like on tweet ${tweet_id}` };
    },
});
exports.retweet = (0, agents_1.tool)({
    name: "retweet",
    description: "Retweet a tweet",
    parameters: zod_1.z.object({ tweet_id: zod_1.z.string() }),
    execute: async ({ tweet_id }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        return { ok: true, message: `Simulated retweet of tweet ${tweet_id}` };
    },
});
exports.get_tweet = (0, agents_1.tool)({
    name: "get_tweet",
    description: "Get details for a specific tweet",
    parameters: zod_1.z.object({ tweet_id: zod_1.z.string() }),
    execute: async ({ tweet_id }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        return { id: tweet_id, text: "Sample tweet content", author: "sample_user" };
    },
});
exports.search_tweets = (0, agents_1.tool)({
    name: "search_tweets",
    description: "Search for tweets",
    parameters: zod_1.z.object({ query: zod_1.z.string(), limit: zod_1.z.number().default(20) }),
    execute: async ({ query, limit }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        return { tweets: Array.from({ length: limit }).map((_, i) => ({ id: `tweet_${i}`, text: `Result for "${query}" ${i + 1}` })) };
    },
});
exports.get_mentions = (0, agents_1.tool)({
    name: "get_x_mentions",
    description: "Get mentions of the authenticated user",
    parameters: zod_1.z.object({ limit: zod_1.z.number().default(20) }),
    execute: async ({ limit }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        return { mentions: Array.from({ length: limit }).map((_, i) => ({ id: `mention_${i}`, text: `Mention ${i + 1}` })) };
    },
});
exports.follow_user = (0, agents_1.tool)({
    name: "follow_x_user",
    description: "Follow a user on X",
    parameters: zod_1.z.object({ username: zod_1.z.string() }),
    execute: async ({ username }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        return { ok: true, message: `Simulated follow of ${username}` };
    },
});
exports.get_user_profile = (0, agents_1.tool)({
    name: "get_x_user_profile",
    description: "Get user profile information",
    parameters: zod_1.z.object({ username: zod_1.z.string() }),
    execute: async ({ username }, ctx) => {
        const accessToken = ctx?.context?.["x"]?.accessToken;
        if (!accessToken)
            throw new Error("No X integration found for user");
        return { username, followers: 0, following: 0, tweets: 0 };
    },
});
