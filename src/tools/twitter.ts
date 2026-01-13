import { z } from "zod";
import { logger } from "../services/logger";
import { BaseXTool } from "./base";

// ============================================
// X (TWITTER) TOOL SUITE
// ============================================

export class XToolSuite extends BaseXTool {
  constructor(userId: string) {
    super(userId);
  }

  // Post tweet tool
  createPostTweetTool() {
    return this.createTool(
      "twitter_post_tweet",
      "Send a standard 280-character post",
      z.object({
        text: z.string().min(1).max(280, "Tweet cannot exceed 280 characters"),
      }),
      async ({ text }) => {
        try {
          logger.info(`[TWITTER] Posting tweet: ${text.substring(0, 50)}...`);

          const result = await this.executeTwitterRequest("/tweets", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
          });

          if (!result || !result.data) {
            throw new Error("Invalid response from Twitter API");
          }

          logger.info(
            `[TWITTER] Tweet posted successfully. ID: ${result.data.id}`
          );

          return {
            success: true,
            data: {
              id: result.data.id,
              text: result.data.text,
              createdAt: result.data.created_at,
              authorId: result.data.author_id,
            },
          };
        } catch (error) {
          logger.error("[TWITTER] Post tweet failed:", error);
          const errorMessage = error?.message || "Failed to post tweet";

          // Convert technical errors to user-friendly messages
          if (
            errorMessage.includes("404") ||
            errorMessage.includes("Not Found")
          ) {
            return {
              success: false,
              error:
                "Twitter API endpoint not found. Please check your Twitter integration settings or reconnect your account.",
            };
          }
          if (
            errorMessage.includes("401") ||
            errorMessage.includes("Unauthorized")
          ) {
            return {
              success: false,
              error:
                "Twitter authentication failed. Please reconnect your Twitter account.",
            };
          }
          if (
            errorMessage.includes("403") ||
            errorMessage.includes("Forbidden")
          ) {
            return {
              success: false,
              error:
                "Twitter API access denied. Please check your Twitter app permissions.",
            };
          }

          return {
            success: false,
            error: errorMessage.includes("Twitter API error")
              ? errorMessage
              : `Failed to post tweet: ${errorMessage}`,
          };
        }
      }
    );
  }

  // Post thread tool
  createPostThreadTool() {
    return this.createTool(
      "post_thread",
      "Post a thread (multiple connected tweets) on X (Twitter)",
      z.object({
        tweets: z
          .array(z.string().min(1).max(280))
          .min(2)
          .max(25, "Thread cannot exceed 25 tweets"),
      }),
      async ({ tweets }) => {
        try {
          logger.info(`[TWITTER] Posting thread with ${tweets.length} tweets`);

          const postedTweets = [];

          for (let i = 0; i < tweets.length; i++) {
            const tweet = tweets[i];
            const isReply = i > 0;

            const result = await this.executeTwitterRequest("/2/tweets", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: tweet,
                ...(isReply &&
                  postedTweets.length > 0 && {
                    reply: {
                      in_reply_to_tweet_id:
                        postedTweets[postedTweets.length - 1].id,
                    },
                  }),
              }),
            });

            postedTweets.push({
              id: result.data.id,
              text: result.data.text,
              position: i + 1,
            });
          }

          logger.info(
            `[TWITTER] Thread posted successfully with ${postedTweets.length} tweets`
          );

          return {
            success: true,
            data: {
              thread: postedTweets,
              totalTweets: postedTweets.length,
            },
          };
        } catch (error) {
          logger.error("[TWITTER] Post thread failed:", error);
          return {
            success: false,
            error: error.message || "Failed to post thread",
          };
        }
      }
    );
  }

  // Like tweet tool
  createLikeTweetTool() {
    return this.createTool(
      "twitter_like_tweet",
      "Engage with content",
      z.object({
        tweetId: z.string().min(1, "Tweet ID is required"),
      }),
      async ({ tweetId }) => {
        try {
          logger.info(`[TWITTER] Liking tweet: ${tweetId}`);

          const result = await this.executeTwitterRequest(
            `/2/users/{userId}/likes`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ tweet_id: tweetId }),
            }
          );

          logger.info(`[TWITTER] Tweet liked successfully`);

          return {
            success: true,
            data: {
              tweetId,
              liked: true,
            },
          };
        } catch (error) {
          logger.error("[TWITTER] Like tweet failed:", error);
          return {
            success: false,
            error: error.message || "Failed to like tweet",
          };
        }
      }
    );
  }

  // Search recent tweets tool
  createSearchRecentTweetsTool() {
    return this.createTool(
      "search_recent_tweets",
      "Search for recent tweets on X (Twitter)",
      z.object({
        query: z.string().min(1, "Search query cannot be empty"),
        maxResults: z
          .number()
          .min(10)
          .max(100)
          .default(20)
          .describe("Maximum number of tweets to return"),
        startTime: z
          .string()
          .optional()
          .describe("Start time in ISO 8601 format"),
        endTime: z.string().optional().describe("End time in ISO 8601 format"),
      }),
      async ({ query, maxResults, startTime, endTime }) => {
        try {
          logger.info(`[TWITTER] Searching recent tweets: ${query}`);

          const params = new URLSearchParams({
            query,
            max_results: maxResults.toString(),
            "tweet.fields": "created_at,author_id,text,public_metrics",
            "user.fields": "username,name",
            expansions: "author_id",
            ...(startTime && { start_time: startTime }),
            ...(endTime && { end_time: endTime }),
          });

          const result = await this.executeTwitterRequest(
            `/2/tweets/search/recent?${params}`
          );

          const tweets = result.data || [];
          logger.info(`[TWITTER] Found ${tweets.length} tweets`);

          return {
            success: true,
            data: {
              tweets: tweets.map((tweet: any) => ({
                id: tweet.id,
                text: tweet.text,
                createdAt: tweet.created_at,
                authorId: tweet.author_id,
                metrics: tweet.public_metrics,
                author: result.includes?.users?.find(
                  (user: any) => user.id === tweet.author_id
                ),
              })),
              totalCount: tweets.length,
              query,
            },
          };
        } catch (error) {
          logger.error("[TWITTER] Search recent tweets failed:", error);
          return {
            success: false,
            error: error.message || "Failed to search tweets",
          };
        }
      }
    );
  }

  // Delete tweet tool
  createDeleteTweetTool() {
    return this.createTool(
      "twitter_delete_tweet",
      "Remove a post",
      z.object({
        tweetId: z.string().min(1, "Tweet ID is required"),
      }),
      async ({ tweetId }) => {
        try {
          logger.info(`[TWITTER] Deleting tweet: ${tweetId}`);

          const result = await this.executeTwitterRequest(
            `/2/tweets/${tweetId}`,
            {
              method: "DELETE",
            }
          );

          logger.info(`[TWITTER] Tweet deleted successfully`);

          return {
            success: true,
            data: {
              tweetId,
              deleted: result.data.deleted,
            },
          };
        } catch (error) {
          logger.error("[TWITTER] Delete tweet failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete tweet",
          };
        }
      }
    );
  }

  // Get user info tool
  createGetUserInfoTool() {
    return this.createTool(
      "twitter_get_user_info",
      "Get profile data and follower counts",
      z.object({
        username: z
          .string()
          .optional()
          .describe("Username without @ (e.g., 'elonmusk')"),
        userId: z.string().optional().describe("User ID"),
      }),
      async ({ username, userId }) => {
        try {
          if (!username && !userId) {
            return {
              success: false,
              error: "Either username or userId must be provided",
            };
          }

          const endpoint = username
            ? `/2/users/by/username/${username}`
            : `/2/users/${userId}`;

          logger.info(`[TWITTER] Getting user info for ${username || userId}`);

          const result = await this.executeTwitterRequest(
            `${endpoint}?user.fields=created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,public_metrics,url,username,verified,verified_type`
          );

          logger.info(`[TWITTER] Retrieved user info successfully`);

          return {
            success: true,
            data: {
              id: result.data.id,
              name: result.data.name,
              username: result.data.username,
              description: result.data.description,
              profileImageUrl: result.data.profile_image_url,
              location: result.data.location,
              url: result.data.url,
              protected: result.data.protected,
              verified: result.data.verified,
              verifiedType: result.data.verified_type,
              createdAt: result.data.created_at,
              publicMetrics: result.data.public_metrics,
            },
          };
        } catch (error) {
          logger.error("[TWITTER] Get user info failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get user info",
          };
        }
      }
    );
  }

  // Retweet tool
  createRetweetTool() {
    return this.createTool(
      "twitter_retweet",
      "Reshare content",
      z.object({
        tweetId: z.string().min(1, "Tweet ID is required"),
      }),
      async ({ tweetId }) => {
        try {
          logger.info(`[TWITTER] Retweeting tweet: ${tweetId}`);

          const result = await this.executeTwitterRequest(
            `/2/users/{userId}/retweets`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ tweet_id: tweetId }),
            }
          );

          logger.info(`[TWITTER] Tweet retweeted successfully`);

          return {
            success: true,
            data: {
              retweetedTweet: tweetId,
              retweet: result.data,
            },
          };
        } catch (error) {
          logger.error("[TWITTER] Retweet failed:", error);
          return {
            success: false,
            error: error.message || "Failed to retweet",
          };
        }
      }
    );
  }

  // Follow user tool
  createFollowUserTool() {
    return this.createTool(
      "twitter_follow_user",
      "Growth automation",
      z.object({
        targetUserId: z.string().min(1, "Target user ID is required"),
      }),
      async ({ targetUserId }) => {
        try {
          logger.info(`[TWITTER] Following user: ${targetUserId}`);

          const result = await this.executeTwitterRequest(
            `/2/users/{userId}/following`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ target_user_id: targetUserId }),
            }
          );

          logger.info(`[TWITTER] User followed successfully`);

          return {
            success: true,
            data: {
              followedUserId: targetUserId,
              following: result.data.following,
            },
          };
        } catch (error) {
          logger.error("[TWITTER] Follow user failed:", error);
          return {
            success: false,
            error: error.message || "Failed to follow user",
          };
        }
      }
    );
  }

  // Get mentions tool
  createGetMentionsTool() {
    return this.createTool(
      "twitter_get_mentions",
      "Read recent interactions for the agent to reply to",
      z.object({
        maxResults: z
          .number()
          .min(10)
          .max(100)
          .default(20)
          .describe("Maximum number of mentions to return"),
        startTime: z
          .string()
          .optional()
          .describe("Start time in ISO 8601 format"),
        endTime: z.string().optional().describe("End time in ISO 8601 format"),
      }),
      async ({ maxResults, startTime, endTime }) => {
        try {
          logger.info(`[TWITTER] Getting mentions`);

          const params = new URLSearchParams({
            max_results: maxResults.toString(),
            "tweet.fields": "created_at,author_id,text,public_metrics",
            "user.fields": "username,name",
            expansions: "author_id",
            ...(startTime && { start_time: startTime }),
            ...(endTime && { end_time: endTime }),
          });

          const result = await this.executeTwitterRequest(
            `/2/users/{userId}/mentions?${params}`
          );

          const mentions = result.data || [];
          logger.info(`[TWITTER] Found ${mentions.length} mentions`);

          return {
            success: true,
            data: {
              mentions: mentions.map((mention: any) => ({
                id: mention.id,
                text: mention.text,
                createdAt: mention.created_at,
                authorId: mention.author_id,
                metrics: mention.public_metrics,
                author: result.includes?.users?.find(
                  (user: any) => user.id === mention.author_id
                ),
              })),
              totalCount: mentions.length,
            },
          };
        } catch (error) {
          logger.error("[TWITTER] Get mentions failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get mentions",
          };
        }
      }
    );
  }

  // Get trending tool
  createGetTrendingTool() {
    return this.createTool(
      "twitter_get_trending",
      "Get trending topics by location (WOEID)",
      z.object({
        woeid: z
          .string()
          .default("1")
          .describe("Where On Earth ID (1 = worldwide)"),
      }),
      async ({ woeid }) => {
        try {
          logger.info(`[TWITTER] Getting trending topics for WOEID: ${woeid}`);

          const result = await this.executeTwitterRequest(
            `/1.1/trends/place.json?id=${woeid}`
          );

          const trends = result[0]?.trends || [];
          logger.info(`[TWITTER] Found ${trends.length} trending topics`);

          return {
            success: true,
            data: {
              woeid,
              trends: trends.map((trend: any) => ({
                name: trend.name,
                url: trend.url,
                promotedContent: trend.promoted_content,
                query: trend.query,
                tweetVolume: trend.tweet_volume,
              })),
              totalCount: trends.length,
            },
          };
        } catch (error) {
          logger.error("[TWITTER] Get trending failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get trending topics",
          };
        }
      }
    );
  }

  // Get user info tool
  createGetUserInfoTool() {
    return this.createTool(
      "twitter_get_user_info",
      "Get profile data and follower counts for a user",
      z.object({
        username: z
          .string()
          .optional()
          .describe("Twitter username (without @)"),
        userId: z.string().optional().describe("Twitter user ID"),
      }),
      async ({ username, userId }) => {
        if (!username && !userId) {
          throw new Error("Either username or userId must be provided");
        }

        const identifier = username || userId;
        logger.info(`[TWITTER] Getting user info for: ${identifier}`);

        // Note: This is a placeholder implementation
        const params = new URLSearchParams({
          "user.fields":
            "created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,public_metrics,url,username,verified,verified_type,withheld",
        });

        if (username) {
          params.append("usernames", username);
        } else if (userId) {
          params.append("ids", userId);
        }

        const result = await this.executeTwitterRequest(`/2/users?${params}`);

        const user = result.data?.[0];
        logger.info(
          `[TWITTER] Retrieved user info for ${user?.username || user?.id}`
        );

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            description: user.description,
            profileImageUrl: user.profile_image_url,
            location: user.location,
            url: user.url,
            protected: user.protected,
            verified: user.verified,
            followersCount: user.public_metrics?.followers_count,
            followingCount: user.public_metrics?.following_count,
            tweetCount: user.public_metrics?.tweet_count,
            createdAt: user.created_at,
          },
        };
      }
    );
  }

  // Retweet tool
  createRetweetTool() {
    return this.createTool(
      "twitter_retweet",
      "Reshare content on X (Twitter)",
      z.object({
        tweetId: z.string().min(1, "Tweet ID is required"),
      }),
      async ({ tweetId }) => {
        logger.info(`[TWITTER] Retweeting tweet: ${tweetId}`);

        // Note: This is a placeholder implementation
        const result = await this.executeTwitterRequest(
          `/2/users/{userId}/retweets`,
          {
            method: "POST",
            body: JSON.stringify({ tweet_id: tweetId }),
          }
        );

        logger.info(`[TWITTER] Tweet retweeted successfully`);

        return {
          success: true,
          message: "Tweet retweeted successfully",
          tweetId,
          retweeted: true,
        };
      }
    );
  }

  // Follow user tool
  createFollowUserTool() {
    return this.createTool(
      "twitter_follow_user",
      "Follow a user on X (Twitter) for growth automation",
      z.object({
        targetUserId: z.string().min(1, "Target user ID is required"),
      }),
      async ({ targetUserId }) => {
        logger.info(`[TWITTER] Following user: ${targetUserId}`);

        // Note: This is a placeholder implementation
        const result = await this.executeTwitterRequest(
          `/2/users/{userId}/following`,
          {
            method: "POST",
            body: JSON.stringify({ target_user_id: targetUserId }),
          }
        );

        logger.info(`[TWITTER] User followed successfully`);

        return {
          success: true,
          message: "User followed successfully",
          targetUserId,
          following: true,
        };
      }
    );
  }

  // Get mentions tool
  createGetMentionsTool() {
    return this.createTool(
      "twitter_get_mentions",
      "Read recent interactions for the agent to reply to",
      z.object({
        maxResults: z
          .number()
          .min(5)
          .max(100)
          .default(20)
          .describe("Maximum number of mentions to return"),
        sinceId: z
          .string()
          .optional()
          .describe("Only return mentions newer than this ID"),
      }),
      async ({ maxResults, sinceId }) => {
        logger.info(`[TWITTER] Getting recent mentions`);

        // Note: This is a placeholder implementation
        const params = new URLSearchParams({
          max_results: maxResults.toString(),
          "tweet.fields":
            "created_at,author_id,text,public_metrics,conversation_id",
          "user.fields": "username,name",
          expansions: "author_id",
        });

        if (sinceId) {
          params.append("since_id", sinceId);
        }

        const result = await this.executeTwitterRequest(
          `/2/users/{userId}/mentions?${params}`
        );

        const mentions = result.data || [];
        logger.info(`[TWITTER] Found ${mentions.length} mentions`);

        return {
          success: true,
          mentions: mentions.map((mention: any) => ({
            id: mention.id,
            text: mention.text,
            createdAt: mention.created_at,
            authorId: mention.author_id,
            conversationId: mention.conversation_id,
            metrics: mention.public_metrics,
            author: result.includes?.users?.find(
              (user: any) => user.id === mention.author_id
            ),
          })),
          totalCount: mentions.length,
        };
      }
    );
  }

  // Get trending tool
  createGetTrendingTool() {
    return this.createTool(
      "twitter_get_trending",
      "Get trending topics by location (WOEID)",
      z.object({
        woeid: z
          .string()
          .default("1")
          .describe("Where On Earth ID (1 = worldwide, 23424977 = USA, etc.)"),
      }),
      async ({ woeid }) => {
        logger.info(`[TWITTER] Getting trending topics for WOEID: ${woeid}`);

        // Note: This is a placeholder implementation
        const result = await this.executeTwitterRequest(
          `/1.1/trends/place.json?id=${woeid}`
        );

        const trends = result[0]?.trends || [];
        logger.info(`[TWITTER] Found ${trends.length} trending topics`);

        return {
          success: true,
          location: result[0]?.locations?.[0],
          trends: trends.map((trend: any) => ({
            name: trend.name,
            url: trend.url,
            promotedContent: trend.promoted_content,
            query: trend.query,
            tweetVolume: trend.tweet_volume,
          })),
          totalCount: trends.length,
        };
      }
    );
  }
}

// Factory functions for registry
export const createPostTweetTool = (userId: string) =>
  new XToolSuite(userId).createPostTweetTool();

export const createPostThreadTool = (userId: string) =>
  new XToolSuite(userId).createPostThreadTool();

export const createLikeTweetTool = (userId: string) =>
  new XToolSuite(userId).createLikeTweetTool();

export const createSearchRecentTweetsTool = (userId: string) =>
  new XToolSuite(userId).createSearchRecentTweetsTool();

export const createDeleteTweetTool = (userId: string) =>
  new XToolSuite(userId).createDeleteTweetTool();

export const createGetUserInfoTool = (userId: string) =>
  new XToolSuite(userId).createGetUserInfoTool();

export const createRetweetTool = (userId: string) =>
  new XToolSuite(userId).createRetweetTool();

export const createFollowUserTool = (userId: string) =>
  new XToolSuite(userId).createFollowUserTool();

export const createGetMentionsTool = (userId: string) =>
  new XToolSuite(userId).createGetMentionsTool();

export const createGetTrendingTool = (userId: string) =>
  new XToolSuite(userId).createGetTrendingTool();
