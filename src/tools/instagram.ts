import { tool, RunContext } from "@openai/agents";
import { z } from "zod";

export const postInstagramMedia = tool({
  name: "post_instagram_media",
  description:
    "Post a photo or video to Instagram (via connected Meta account)",
  parameters: z.object({ caption: z.string(), mediaUrl: z.string() }),
  execute: async ({ caption, mediaUrl }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["instagram"]?.accessToken;
    if (!accessToken)
      throw new Error("No Instagram integration found for user");

    // For MVP return a simulated response. Replace with Meta Graph API calls.
    return { message: "Simulated Instagram post created", caption, mediaUrl };
  },
});

export default {};

export const list_posts = tool({
  name: "list_instagram_posts",
  description:
    "List recent Instagram posts for the connected account (simulated for MVP)",
  parameters: z.object({ limit: z.number().default(10) }),
  execute: async ({ limit }, ctx?: RunContext<any>) => {
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

export const send_instagram_dm = tool({
  name: "send_instagram_dm",
  description: "Send a DM on Instagram (simulated for MVP)",
  parameters: z.object({ recipient_username: z.string(), message: z.string() }),
  execute: async ({ recipient_username, message }, ctx?: RunContext<any>) => {
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

export const get_instagram_profile = tool({
  name: "get_instagram_profile",
  description: "Get Instagram profile information",
  parameters: z.object({
    username: z.string().nullable().optional(), // If not provided, gets own profile
  }),
  execute: async ({ username }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["instagram"]?.accessToken;
    if (!accessToken) throw new Error("No Instagram integration found for user");
    return {
      username: username || "current_user",
      followers: 0,
      following: 0,
      posts: 0,
    };
  },
});

export const get_instagram_stories = tool({
  name: "get_instagram_stories",
  description: "Get Instagram stories",
  parameters: z.object({
    userId: z.string().nullable().optional(),
  }),
  execute: async ({ userId }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["instagram"]?.accessToken;
    if (!accessToken) throw new Error("No Instagram integration found for user");
    return { stories: [] };
  },
});

export const comment_on_post = tool({
  name: "comment_on_instagram_post",
  description: "Comment on an Instagram post",
  parameters: z.object({
    mediaId: z.string(),
    text: z.string(),
  }),
  execute: async ({ mediaId, text }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["instagram"]?.accessToken;
    if (!accessToken) throw new Error("No Instagram integration found for user");
    return { ok: true, message: `Simulated comment on post ${mediaId}`, text };
  },
});

export const like_post = tool({
  name: "like_instagram_post",
  description: "Like an Instagram post",
  parameters: z.object({
    mediaId: z.string(),
  }),
  execute: async ({ mediaId }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["instagram"]?.accessToken;
    if (!accessToken) throw new Error("No Instagram integration found for user");
    return { ok: true, message: `Simulated like on post ${mediaId}` };
  },
});

export const get_post_comments = tool({
  name: "get_instagram_post_comments",
  description: "Get comments on an Instagram post",
  parameters: z.object({
    mediaId: z.string(),
    limit: z.number().default(20),
  }),
  execute: async ({ mediaId, limit }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["instagram"]?.accessToken;
    if (!accessToken) throw new Error("No Instagram integration found for user");
    return {
      comments: Array.from({ length: limit }).map((_, i) => ({
        id: `comment_${i}`,
        text: `Comment ${i + 1}`,
        username: `user${i}`,
      })),
    };
  },
});

export const follow_user_instagram = tool({
  name: "follow_instagram_user",
  description: "Follow an Instagram user",
  parameters: z.object({
    userId: z.string(),
  }),
  execute: async ({ userId }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["instagram"]?.accessToken;
    if (!accessToken) throw new Error("No Instagram integration found for user");
    return { ok: true, message: `Simulated follow of user ${userId}` };
  },
});

export const get_followers = tool({
  name: "get_instagram_followers",
  description: "Get followers list",
  parameters: z.object({
    userId: z.string().nullable().optional(),
    limit: z.number().default(50),
  }),
  execute: async ({ userId, limit }, ctx?: RunContext<any>) => {
    const accessToken = ctx?.context?.["instagram"]?.accessToken;
    if (!accessToken) throw new Error("No Instagram integration found for user");
    return {
      followers: Array.from({ length: limit }).map((_, i) => ({
        id: `user_${i}`,
        username: `follower${i}`,
      })),
    };
  },
});
