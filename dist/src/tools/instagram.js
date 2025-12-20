"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_followers = exports.follow_user_instagram = exports.get_post_comments = exports.like_post = exports.comment_on_post = exports.get_instagram_stories = exports.get_instagram_profile = exports.send_instagram_dm = exports.list_posts = exports.postInstagramMedia = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
exports.postInstagramMedia = (0, agents_1.tool)({
    name: "post_instagram_media",
    description: "Post a photo or video to Instagram (via connected Meta account)",
    parameters: zod_1.z.object({ caption: zod_1.z.string(), mediaUrl: zod_1.z.string() }),
    execute: async ({ caption, mediaUrl }, ctx) => {
        const accessToken = ctx?.context?.["instagram"]?.accessToken;
        if (!accessToken)
            throw new Error("No Instagram integration found for user");
        // For MVP return a simulated response. Replace with Meta Graph API calls.
        return { message: "Simulated Instagram post created", caption, mediaUrl };
    },
});
exports.default = {};
exports.list_posts = (0, agents_1.tool)({
    name: "list_instagram_posts",
    description: "List recent Instagram posts for the connected account (simulated for MVP)",
    parameters: zod_1.z.object({ limit: zod_1.z.number().default(10) }),
    execute: async ({ limit }, ctx) => {
        const accessToken = ctx?.context?.["instagram"]?.accessToken;
        if (!accessToken)
            throw new Error("No Instagram integration found for user");
        // Simulate posts for MVP
        const posts = Array.from({
            length: Math.max(0, Math.min(limit, 10)),
        }).map((_, i) => ({
            id: `insta_${i}`,
            caption: `Sample post ${i + 1}`,
            mediaUrl: `https://example.com/media/${i}`,
        }));
        return posts;
    },
});
exports.send_instagram_dm = (0, agents_1.tool)({
    name: "send_instagram_dm",
    description: "Send a DM on Instagram (simulated for MVP)",
    parameters: zod_1.z.object({ recipient_username: zod_1.z.string(), message: zod_1.z.string() }),
    execute: async ({ recipient_username, message }, ctx) => {
        const accessToken = ctx?.context?.["instagram"]?.accessToken;
        if (!accessToken)
            throw new Error("No Instagram integration found for user");
        return {
            ok: true,
            message: `Simulated DM sent to ${recipient_username}`,
            body: message,
        };
    },
});
exports.get_instagram_profile = (0, agents_1.tool)({
    name: "get_instagram_profile",
    description: "Get Instagram profile information",
    parameters: zod_1.z.object({
        username: zod_1.z.string().nullable().optional(), // If not provided, gets own profile
    }),
    execute: async ({ username }, ctx) => {
        const accessToken = ctx?.context?.["instagram"]?.accessToken;
        if (!accessToken)
            throw new Error("No Instagram integration found for user");
        return {
            username: username || "current_user",
            followers: 0,
            following: 0,
            posts: 0,
        };
    },
});
exports.get_instagram_stories = (0, agents_1.tool)({
    name: "get_instagram_stories",
    description: "Get Instagram stories",
    parameters: zod_1.z.object({
        userId: zod_1.z.string().nullable().optional(),
    }),
    execute: async ({ userId }, ctx) => {
        const accessToken = ctx?.context?.["instagram"]?.accessToken;
        if (!accessToken)
            throw new Error("No Instagram integration found for user");
        return { stories: [] };
    },
});
exports.comment_on_post = (0, agents_1.tool)({
    name: "comment_on_instagram_post",
    description: "Comment on an Instagram post",
    parameters: zod_1.z.object({
        mediaId: zod_1.z.string(),
        text: zod_1.z.string(),
    }),
    execute: async ({ mediaId, text }, ctx) => {
        const accessToken = ctx?.context?.["instagram"]?.accessToken;
        if (!accessToken)
            throw new Error("No Instagram integration found for user");
        return { ok: true, message: `Simulated comment on post ${mediaId}`, text };
    },
});
exports.like_post = (0, agents_1.tool)({
    name: "like_instagram_post",
    description: "Like an Instagram post",
    parameters: zod_1.z.object({
        mediaId: zod_1.z.string(),
    }),
    execute: async ({ mediaId }, ctx) => {
        const accessToken = ctx?.context?.["instagram"]?.accessToken;
        if (!accessToken)
            throw new Error("No Instagram integration found for user");
        return { ok: true, message: `Simulated like on post ${mediaId}` };
    },
});
exports.get_post_comments = (0, agents_1.tool)({
    name: "get_instagram_post_comments",
    description: "Get comments on an Instagram post",
    parameters: zod_1.z.object({
        mediaId: zod_1.z.string(),
        limit: zod_1.z.number().default(20),
    }),
    execute: async ({ mediaId, limit }, ctx) => {
        const accessToken = ctx?.context?.["instagram"]?.accessToken;
        if (!accessToken)
            throw new Error("No Instagram integration found for user");
        return {
            comments: Array.from({ length: limit }).map((_, i) => ({
                id: `comment_${i}`,
                text: `Comment ${i + 1}`,
                username: `user${i}`,
            })),
        };
    },
});
exports.follow_user_instagram = (0, agents_1.tool)({
    name: "follow_instagram_user",
    description: "Follow an Instagram user",
    parameters: zod_1.z.object({
        userId: zod_1.z.string(),
    }),
    execute: async ({ userId }, ctx) => {
        const accessToken = ctx?.context?.["instagram"]?.accessToken;
        if (!accessToken)
            throw new Error("No Instagram integration found for user");
        return { ok: true, message: `Simulated follow of user ${userId}` };
    },
});
exports.get_followers = (0, agents_1.tool)({
    name: "get_instagram_followers",
    description: "Get followers list",
    parameters: zod_1.z.object({
        userId: zod_1.z.string().nullable().optional(),
        limit: zod_1.z.number().default(50),
    }),
    execute: async ({ userId, limit }, ctx) => {
        const accessToken = ctx?.context?.["instagram"]?.accessToken;
        if (!accessToken)
            throw new Error("No Instagram integration found for user");
        return {
            followers: Array.from({ length: limit }).map((_, i) => ({
                id: `user_${i}`,
                username: `follower${i}`,
            })),
        };
    },
});
