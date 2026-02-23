import { z } from "zod";
import { logger } from "../services/logger";
import { BaseXTool } from "./base";

// ============================================
// X (TWITTER) TOOL SUITE - COMPREHENSIVE (28 tools)
// ============================================

export class XToolSuite extends BaseXTool {
  constructor(userId: string) {
    super(userId);
  }

  // ============================================
  // READING (11 tools)
  // ============================================

  createGetTweetTool() {
    return this.createTool("twitter_get_tweet", "Get a specific tweet by ID", z.object({ tweetId: z.string().min(1) }), async ({ tweetId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/tweets/${tweetId}?tweet.fields=created_at,author_id,text,public_metrics`);
        return { success: true, data: result.data };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get tweet" };
      }
    });
  }

  createSearchTweetsTool() {
    return this.createTool("twitter_search_tweets", "Search recent tweets with query", z.object({ query: z.string().min(1), maxResults: z.number().min(10).max(100).default(20) }), async ({ query, maxResults }) => {
      try {
        const params = new URLSearchParams({ query, max_results: maxResults.toString(), "tweet.fields": "created_at,author_id,text,public_metrics" });
        const result = await this.executeTwitterRequest(`/2/tweets/search/recent?${params}`);
        return { success: true, data: { tweets: result.data || [], totalCount: result.data?.length || 0 } };
      } catch (error: any) {
        if (error.message?.includes("403") || error.message?.includes("404")) {
          return { success: false, error: "Twitter API Search restricted. Use web_search tool instead: web_search('site:twitter.com your query')" };
        }
        return { success: false, error: error.message || "Failed to search tweets" };
      }
    });
  }

  createGetUserTool() {
    return this.createTool("twitter_get_user", "Get user profile by username or ID", z.object({ username: z.string().optional(), userId: z.string().optional() }), async ({ username, userId }) => {
      try {
        if (!username && !userId) throw new Error("Either username or userId required");
        const endpoint = username ? `/2/users/by/username/${username}` : `/2/users/${userId}`;
        const result = await this.executeTwitterRequest(`${endpoint}?user.fields=created_at,description,id,location,name,profile_image_url,protected,public_metrics,url,username,verified`);
        return { success: true, data: result.data };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get user" };
      }
    });
  }

  createGetUserTweetsTool() {
    return this.createTool("twitter_get_user_tweets", "Get recent tweets from a user's timeline", z.object({ userId: z.string().min(1), maxResults: z.number().min(5).max(100).default(10) }), async ({ userId, maxResults }) => {
      try {
        const params = new URLSearchParams({ max_results: maxResults.toString(), "tweet.fields": "created_at,text,public_metrics" });
        const result = await this.executeTwitterRequest(`/2/users/${userId}/tweets?${params}`);
        return { success: true, data: { tweets: result.data || [] } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get user tweets" };
      }
    });
  }

  createGetMentionsTool() {
    return this.createTool("twitter_get_mentions", "Get tweets mentioning the authenticated user", z.object({ maxResults: z.number().min(10).max(100).default(20) }), async ({ maxResults }) => {
      try {
        const params = new URLSearchParams({ max_results: maxResults.toString(), "tweet.fields": "created_at,author_id,text,public_metrics", expansions: "author_id" });
        const result = await this.executeTwitterRequest(`/2/users/{userId}/mentions?${params}`);
        return { success: true, data: { mentions: result.data || [], totalCount: result.data?.length || 0 } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get mentions" };
      }
    });
  }

  createGetHomeTimelineTool() {
    return this.createTool("twitter_get_home_timeline", "Get the authenticated user's home timeline", z.object({ maxResults: z.number().min(5).max(100).default(10) }), async ({ maxResults }) => {
      try {
        const params = new URLSearchParams({ max_results: maxResults.toString(), "tweet.fields": "created_at,author_id,text,public_metrics" });
        const result = await this.executeTwitterRequest(`/2/users/{userId}/timelines/reverse_chronological?${params}`);
        return { success: true, data: { tweets: result.data || [] } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get home timeline" };
      }
    });
  }

  createGetLikesTool() {
    return this.createTool("twitter_get_likes", "Get tweets liked by a user", z.object({ userId: z.string().min(1), maxResults: z.number().min(5).max(100).default(10) }), async ({ userId, maxResults }) => {
      try {
        const params = new URLSearchParams({ max_results: maxResults.toString(), "tweet.fields": "created_at,text,public_metrics" });
        const result = await this.executeTwitterRequest(`/2/users/${userId}/liked_tweets?${params}`);
        return { success: true, data: { tweets: result.data || [] } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get likes" };
      }
    });
  }

  createGetFollowersTool() {
    return this.createTool("twitter_get_followers", "List followers of a user", z.object({ userId: z.string().min(1), maxResults: z.number().min(1).max(1000).default(100) }), async ({ userId, maxResults }) => {
      try {
        const params = new URLSearchParams({ max_results: maxResults.toString(), "user.fields": "username,name,profile_image_url" });
        const result = await this.executeTwitterRequest(`/2/users/${userId}/followers?${params}`);
        return { success: true, data: { followers: result.data || [], totalCount: result.meta?.result_count || 0 } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get followers" };
      }
    });
  }

  createGetFollowingTool() {
    return this.createTool("twitter_get_following", "List accounts a user follows", z.object({ userId: z.string().min(1), maxResults: z.number().min(1).max(1000).default(100) }), async ({ userId, maxResults }) => {
      try {
        const params = new URLSearchParams({ max_results: maxResults.toString(), "user.fields": "username,name,profile_image_url" });
        const result = await this.executeTwitterRequest(`/2/users/${userId}/following?${params}`);
        return { success: true, data: { following: result.data || [], totalCount: result.meta?.result_count || 0 } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get following" };
      }
    });
  }

  createLookupUsersTool() {
    return this.createTool("twitter_lookup_users", "Look up multiple users by IDs", z.object({ userIds: z.array(z.string()).min(1).max(100) }), async ({ userIds }) => {
      try {
        const params = new URLSearchParams({ ids: userIds.join(","), "user.fields": "username,name,profile_image_url,public_metrics" });
        const result = await this.executeTwitterRequest(`/2/users?${params}`);
        return { success: true, data: { users: result.data || [] } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to lookup users" };
      }
    });
  }

  createGetTrendsTool() {
    return this.createTool("twitter_get_trends", "Get trending topics for a location (WOEID)", z.object({ woeid: z.string().default("1").describe("Where On Earth ID (1 = worldwide)") }), async ({ woeid }) => {
      try {
        const result = await this.executeTwitterRequest(`/1.1/trends/place.json?id=${woeid}`);
        const trends = result[0]?.trends || [];
        return { success: true, data: { trends: trends.map((t: any) => ({ name: t.name, url: t.url, tweetVolume: t.tweet_volume })), totalCount: trends.length } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get trends" };
      }
    });
  }

  // ============================================
  // WRITING (13 tools)
  // ============================================

  createPostTweetTool() {
    return this.createTool("twitter_post_tweet", "Post a tweet with text, optional media, reply settings", z.object({ text: z.string().min(1).max(280), replySettings: z.enum(["everyone", "mentionedUsers", "following"]).optional() }), async ({ text, replySettings }) => {
      try {
        const body: any = { text };
        if (replySettings) body.reply_settings = replySettings;
        const result = await this.executeTwitterRequest("/2/tweets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        return { success: true, data: { id: result.data.id, text: result.data.text } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to post tweet" };
      }
    });
  }

  createDeleteTweetTool() {
    return this.createTool("twitter_delete_tweet", "Delete own tweet", z.object({ tweetId: z.string().min(1) }), async ({ tweetId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/tweets/${tweetId}`, { method: "DELETE" });
        return { success: true, data: { tweetId, deleted: result.data.deleted } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to delete tweet" };
      }
    });
  }

  createReplyToTweetTool() {
    return this.createTool("twitter_reply_to_tweet", "Reply to a specific tweet", z.object({ tweetId: z.string().min(1), text: z.string().min(1).max(280) }), async ({ tweetId, text }) => {
      try {
        const result = await this.executeTwitterRequest("/2/tweets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, reply: { in_reply_to_tweet_id: tweetId } }) });
        return { success: true, data: { id: result.data.id, text: result.data.text, replyTo: tweetId } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to reply to tweet" };
      }
    });
  }

  createQuoteTweetTool() {
    return this.createTool("twitter_quote_tweet", "Quote a tweet with additional text", z.object({ tweetId: z.string().min(1), text: z.string().min(1).max(280) }), async ({ tweetId, text }) => {
      try {
        const result = await this.executeTwitterRequest("/2/tweets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, quote_tweet_id: tweetId }) });
        return { success: true, data: { id: result.data.id, text: result.data.text, quotedTweet: tweetId } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to quote tweet" };
      }
    });
  }

  createRetweetTool() {
    return this.createTool("twitter_retweet", "Retweet a tweet", z.object({ tweetId: z.string().min(1) }), async ({ tweetId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/users/{userId}/retweets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tweet_id: tweetId }) });
        return { success: true, data: { retweetedTweet: tweetId, retweeted: true } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to retweet" };
      }
    });
  }

  createUnretweetTool() {
    return this.createTool("twitter_unretweet", "Remove a retweet", z.object({ tweetId: z.string().min(1) }), async ({ tweetId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/users/{userId}/retweets/${tweetId}`, { method: "DELETE" });
        return { success: true, data: { tweetId, unretweeted: true } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to unretweet" };
      }
    });
  }

  createLikeTweetTool() {
    return this.createTool("twitter_like_tweet", "Like a tweet", z.object({ tweetId: z.string().min(1) }), async ({ tweetId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/users/{userId}/likes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tweet_id: tweetId }) });
        return { success: true, data: { tweetId, liked: true } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to like tweet" };
      }
    });
  }

  createUnlikeTweetTool() {
    return this.createTool("twitter_unlike_tweet", "Remove a like", z.object({ tweetId: z.string().min(1) }), async ({ tweetId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/users/{userId}/likes/${tweetId}`, { method: "DELETE" });
        return { success: true, data: { tweetId, unliked: true } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to unlike tweet" };
      }
    });
  }

  createFollowUserTool() {
    return this.createTool("twitter_follow_user", "Follow a user", z.object({ targetUserId: z.string().min(1) }), async ({ targetUserId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/users/{userId}/following`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_user_id: targetUserId }) });
        return { success: true, data: { followedUserId: targetUserId, following: true } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to follow user" };
      }
    });
  }

  createUnfollowUserTool() {
    return this.createTool("twitter_unfollow_user", "Unfollow a user", z.object({ targetUserId: z.string().min(1) }), async ({ targetUserId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/users/{userId}/following/${targetUserId}`, { method: "DELETE" });
        return { success: true, data: { unfollowedUserId: targetUserId, unfollowed: true } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to unfollow user" };
      }
    });
  }

  createMuteUserTool() {
    return this.createTool("twitter_mute_user", "Mute a user", z.object({ targetUserId: z.string().min(1) }), async ({ targetUserId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/users/{userId}/muting`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_user_id: targetUserId }) });
        return { success: true, data: { mutedUserId: targetUserId, muted: true } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to mute user" };
      }
    });
  }

  createUnmuteUserTool() {
    return this.createTool("twitter_unmute_user", "Unmute a user", z.object({ targetUserId: z.string().min(1) }), async ({ targetUserId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/users/{userId}/muting/${targetUserId}`, { method: "DELETE" });
        return { success: true, data: { unmutedUserId: targetUserId, unmuted: true } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to unmute user" };
      }
    });
  }

  createBlockUserTool() {
    return this.createTool("twitter_block_user", "Block a user", z.object({ targetUserId: z.string().min(1) }), async ({ targetUserId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/users/{userId}/blocking`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_user_id: targetUserId }) });
        return { success: true, data: { blockedUserId: targetUserId, blocked: true } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to block user" };
      }
    });
  }

  // ============================================
  // LISTS (2 tools)
  // ============================================

  createGetListsTool() {
    return this.createTool("twitter_get_lists", "Get lists owned by a user", z.object({ userId: z.string().min(1) }), async ({ userId }) => {
      try {
        const result = await this.executeTwitterRequest(`/2/users/${userId}/owned_lists`);
        return { success: true, data: { lists: result.data || [] } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get lists" };
      }
    });
  }

  createGetListTweetsTool() {
    return this.createTool("twitter_get_list_tweets", "Get tweets from a list", z.object({ listId: z.string().min(1), maxResults: z.number().min(5).max(100).default(10) }), async ({ listId, maxResults }) => {
      try {
        const params = new URLSearchParams({ max_results: maxResults.toString(), "tweet.fields": "created_at,author_id,text,public_metrics" });
        const result = await this.executeTwitterRequest(`/2/lists/${listId}/tweets?${params}`);
        return { success: true, data: { tweets: result.data || [] } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get list tweets" };
      }
    });
  }

  // Legacy methods for backward compatibility
  createPostThreadTool() {
    return this.createTool("twitter_post_thread", "Post a thread (multiple connected tweets)", z.object({ tweets: z.array(z.string().min(1).max(280)).min(2).max(25) }), async ({ tweets }) => {
      try {
        const postedTweets = [];
        for (let i = 0; i < tweets.length; i++) {
          const body: any = { text: tweets[i] };
          if (i > 0 && postedTweets.length > 0) {
            body.reply = { in_reply_to_tweet_id: postedTweets[postedTweets.length - 1].id };
          }
          const result = await this.executeTwitterRequest("/2/tweets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          postedTweets.push({ id: result.data.id, text: result.data.text, position: i + 1 });
        }
        return { success: true, data: { thread: postedTweets, totalTweets: postedTweets.length } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to post thread" };
      }
    });
  }

  createSearchRecentTweetsTool() {
    return this.createTool("twitter_search_recent", "Search for recent tweets (alias)", z.object({ query: z.string().min(1), maxResults: z.number().min(10).max(100).default(20) }), async (params) => {
      return this.createSearchTweetsTool().execute(params);
    });
  }

  createGetUserInfoTool() {
    return this.createTool("twitter_get_user_info", "Get user profile (alias)", z.object({ username: z.string().optional(), userId: z.string().optional() }), async (params) => {
      return this.createGetUserTool().execute(params);
    });
  }

  createGetTrendingTool() {
    return this.createTool("twitter_get_trending", "Get trending topics (alias)", z.object({ woeid: z.string().default("1") }), async (params) => {
      return this.createGetTrendsTool().execute(params);
    });
  }
}

// ============================================
// FACTORY FUNCTIONS - Individual Tool Exports
// ============================================

// Reading (11 tools)
export const createTwitterGetTweetTool = (userId: string) => new XToolSuite(userId).createGetTweetTool();
export const createTwitterSearchTweetsTool = (userId: string) => new XToolSuite(userId).createSearchTweetsTool();
export const createTwitterGetUserTool = (userId: string) => new XToolSuite(userId).createGetUserTool();
export const createTwitterGetUserTweetsTool = (userId: string) => new XToolSuite(userId).createGetUserTweetsTool();
export const createTwitterGetMentionsTool = (userId: string) => new XToolSuite(userId).createGetMentionsTool();
export const createTwitterGetHomeTimelineTool = (userId: string) => new XToolSuite(userId).createGetHomeTimelineTool();
export const createTwitterGetLikesTool = (userId: string) => new XToolSuite(userId).createGetLikesTool();
export const createTwitterGetFollowersTool = (userId: string) => new XToolSuite(userId).createGetFollowersTool();
export const createTwitterGetFollowingTool = (userId: string) => new XToolSuite(userId).createGetFollowingTool();
export const createTwitterLookupUsersTool = (userId: string) => new XToolSuite(userId).createLookupUsersTool();
export const createTwitterGetTrendsTool = (userId: string) => new XToolSuite(userId).createGetTrendsTool();

// Writing (13 tools)
export const createTwitterPostTweetTool = (userId: string) => new XToolSuite(userId).createPostTweetTool();
export const createTwitterDeleteTweetTool = (userId: string) => new XToolSuite(userId).createDeleteTweetTool();
export const createTwitterReplyToTweetTool = (userId: string) => new XToolSuite(userId).createReplyToTweetTool();
export const createTwitterQuoteTweetTool = (userId: string) => new XToolSuite(userId).createQuoteTweetTool();
export const createTwitterRetweetTool = (userId: string) => new XToolSuite(userId).createRetweetTool();
export const createTwitterUnretweetTool = (userId: string) => new XToolSuite(userId).createUnretweetTool();
export const createTwitterLikeTweetTool = (userId: string) => new XToolSuite(userId).createLikeTweetTool();
export const createTwitterUnlikeTweetTool = (userId: string) => new XToolSuite(userId).createUnlikeTweetTool();
export const createTwitterFollowUserTool = (userId: string) => new XToolSuite(userId).createFollowUserTool();
export const createTwitterUnfollowUserTool = (userId: string) => new XToolSuite(userId).createUnfollowUserTool();
export const createTwitterMuteUserTool = (userId: string) => new XToolSuite(userId).createMuteUserTool();
export const createTwitterUnmuteUserTool = (userId: string) => new XToolSuite(userId).createUnmuteUserTool();
export const createTwitterBlockUserTool = (userId: string) => new XToolSuite(userId).createBlockUserTool();

// Lists (2 tools)
export const createTwitterGetListsTool = (userId: string) => new XToolSuite(userId).createGetListsTool();
export const createTwitterGetListTweetsTool = (userId: string) => new XToolSuite(userId).createGetListTweetsTool();

// Legacy aliases for backward compatibility
export const createPostTweetTool = (userId: string) => new XToolSuite(userId).createPostTweetTool();
export const createPostThreadTool = (userId: string) => new XToolSuite(userId).createPostThreadTool();
export const createLikeTweetTool = (userId: string) => new XToolSuite(userId).createLikeTweetTool();
export const createSearchRecentTweetsTool = (userId: string) => new XToolSuite(userId).createSearchRecentTweetsTool();
export const createDeleteTweetTool = (userId: string) => new XToolSuite(userId).createDeleteTweetTool();
export const createGetUserInfoTool = (userId: string) => new XToolSuite(userId).createGetUserInfoTool();
export const createRetweetTool = (userId: string) => new XToolSuite(userId).createRetweetTool();
export const createFollowUserTool = (userId: string) => new XToolSuite(userId).createFollowUserTool();
export const createGetMentionsTool = (userId: string) => new XToolSuite(userId).createGetMentionsTool();
export const createGetTrendingTool = (userId: string) => new XToolSuite(userId).createGetTrendingTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createTwitterTools = (userId: string) => {
  const suite = new XToolSuite(userId);
  return [
    suite.createGetTweetTool(), suite.createSearchTweetsTool(), suite.createGetUserTool(), suite.createGetUserTweetsTool(),
    suite.createGetMentionsTool(), suite.createGetHomeTimelineTool(), suite.createGetLikesTool(), suite.createGetFollowersTool(),
    suite.createGetFollowingTool(), suite.createLookupUsersTool(), suite.createGetTrendsTool(),
    suite.createPostTweetTool(), suite.createDeleteTweetTool(), suite.createReplyToTweetTool(), suite.createQuoteTweetTool(),
    suite.createRetweetTool(), suite.createUnretweetTool(), suite.createLikeTweetTool(), suite.createUnlikeTweetTool(),
    suite.createFollowUserTool(), suite.createUnfollowUserTool(), suite.createMuteUserTool(), suite.createUnmuteUserTool(), suite.createBlockUserTool(),
    suite.createGetListsTool(), suite.createGetListTweetsTool(),
    suite.createPostThreadTool(), suite.createSearchRecentTweetsTool(),
  ];
};
