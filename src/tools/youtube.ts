import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// YOUTUBE TOOL SUITE - COMPREHENSIVE
// ============================================

export class YouTubeToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Search
  createSearchTool() {
    return this.createTool(
      "youtube_search",
      "Search YouTube for videos, channels, playlists with query, maxResults, type filter",
      z.object({
        query: z.string().min(1, "Search query is required"),
        maxResults: z.number().min(1).max(50).default(10).optional(),
        type: z.enum(["video", "channel", "playlist"]).optional(),
        order: z.enum(["date", "rating", "relevance", "title", "videoCount", "viewCount"]).default("relevance").optional(),
      }),
      async ({ query, maxResults, type, order }) => {
        try {
          logger.info(`[YOUTUBE] Searching: ${query}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            return await youtube.search.list({
              part: ["snippet"],
              q: query,
              maxResults,
              type: type ? [type] : undefined,
              order,
            });
          });

          const items = result.data.items || [];
          logger.info(`[YOUTUBE] Found ${items.length} results`);

          return {
            success: true,
            data: {
              items: items.map((item: any) => ({
                kind: item.id?.kind,
                id: item.id?.videoId || item.id?.channelId || item.id?.playlistId,
                title: item.snippet?.title,
                description: item.snippet?.description,
                channelTitle: item.snippet?.channelTitle,
                publishedAt: item.snippet?.publishedAt,
                thumbnails: item.snippet?.thumbnails,
              })),
              totalCount: items.length,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] Search failed:", error);
          return {
            success: false,
            error: error.message || "Failed to search YouTube",
          };
        }
      }
    );
  }

  // Get video
  createGetVideoTool() {
    return this.createTool(
      "youtube_get_video",
      "Get video details (title, description, stats, duration, tags)",
      z.object({
        videoId: z.string().min(1, "Video ID is required"),
      }),
      async ({ videoId }) => {
        try {
          logger.info(`[YOUTUBE] Getting video: ${videoId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            return await youtube.videos.list({
              part: ["snippet", "contentDetails", "statistics"],
              id: [videoId],
            });
          });

          const video = result.data.items?.[0];
          if (!video) {
            throw new Error("Video not found");
          }

          logger.info(`[YOUTUBE] Retrieved video`);

          return {
            success: true,
            data: {
              id: video.id,
              title: video.snippet?.title,
              description: video.snippet?.description,
              channelId: video.snippet?.channelId,
              channelTitle: video.snippet?.channelTitle,
              publishedAt: video.snippet?.publishedAt,
              duration: video.contentDetails?.duration,
              tags: video.snippet?.tags,
              categoryId: video.snippet?.categoryId,
              statistics: {
                viewCount: video.statistics?.viewCount,
                likeCount: video.statistics?.likeCount,
                commentCount: video.statistics?.commentCount,
              },
              thumbnails: video.snippet?.thumbnails,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] Get video failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get video",
          };
        }
      }
    );
  }

  // Get channel
  createGetChannelTool() {
    return this.createTool(
      "youtube_get_channel",
      "Get channel details by ID or username",
      z.object({
        channelId: z.string().optional(),
        username: z.string().optional(),
      }),
      async ({ channelId, username }) => {
        try {
          if (!channelId && !username) {
            throw new Error("Either channelId or username is required");
          }

          logger.info(`[YOUTUBE] Getting channel`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            return await youtube.channels.list({
              part: ["snippet", "statistics", "contentDetails"],
              id: channelId ? [channelId] : undefined,
              forUsername: username,
            });
          });

          const channel = result.data.items?.[0];
          if (!channel) {
            throw new Error("Channel not found");
          }

          logger.info(`[YOUTUBE] Retrieved channel`);

          return {
            success: true,
            data: {
              id: channel.id,
              title: channel.snippet?.title,
              description: channel.snippet?.description,
              customUrl: channel.snippet?.customUrl,
              publishedAt: channel.snippet?.publishedAt,
              statistics: {
                viewCount: channel.statistics?.viewCount,
                subscriberCount: channel.statistics?.subscriberCount,
                videoCount: channel.statistics?.videoCount,
              },
              uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads,
              thumbnails: channel.snippet?.thumbnails,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] Get channel failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get channel",
          };
        }
      }
    );
  }

  // List channel videos
  createListChannelVideosTool() {
    return this.createTool(
      "youtube_list_channel_videos",
      "List videos from a channel",
      z.object({
        channelId: z.string().min(1, "Channel ID is required"),
        maxResults: z.number().min(1).max(50).default(10).optional(),
        order: z.enum(["date", "rating", "relevance", "title", "viewCount"]).default("date").optional(),
      }),
      async ({ channelId, maxResults, order }) => {
        try {
          logger.info(`[YOUTUBE] Listing videos from channel: ${channelId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            return await youtube.search.list({
              part: ["snippet"],
              channelId,
              maxResults,
              order,
              type: ["video"],
            });
          });

          const videos = result.data.items || [];
          logger.info(`[YOUTUBE] Found ${videos.length} videos`);

          return {
            success: true,
            data: {
              videos: videos.map((video: any) => ({
                videoId: video.id?.videoId,
                title: video.snippet?.title,
                description: video.snippet?.description,
                publishedAt: video.snippet?.publishedAt,
                thumbnails: video.snippet?.thumbnails,
              })),
              totalCount: videos.length,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] List channel videos failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list channel videos",
          };
        }
      }
    );
  }

  // Get playlist
  createGetPlaylistTool() {
    return this.createTool(
      "youtube_get_playlist",
      "Get playlist metadata",
      z.object({
        playlistId: z.string().min(1, "Playlist ID is required"),
      }),
      async ({ playlistId }) => {
        try {
          logger.info(`[YOUTUBE] Getting playlist: ${playlistId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            return await youtube.playlists.list({
              part: ["snippet", "contentDetails"],
              id: [playlistId],
            });
          });

          const playlist = result.data.items?.[0];
          if (!playlist) {
            throw new Error("Playlist not found");
          }

          logger.info(`[YOUTUBE] Retrieved playlist`);

          return {
            success: true,
            data: {
              id: playlist.id,
              title: playlist.snippet?.title,
              description: playlist.snippet?.description,
              channelId: playlist.snippet?.channelId,
              channelTitle: playlist.snippet?.channelTitle,
              publishedAt: playlist.snippet?.publishedAt,
              itemCount: playlist.contentDetails?.itemCount,
              thumbnails: playlist.snippet?.thumbnails,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] Get playlist failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get playlist",
          };
        }
      }
    );
  }

  // List playlist videos
  createListPlaylistVideosTool() {
    return this.createTool(
      "youtube_list_playlist_videos",
      "List all videos in a playlist",
      z.object({
        playlistId: z.string().min(1, "Playlist ID is required"),
        maxResults: z.number().min(1).max(50).default(25).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ playlistId, maxResults, pageToken }) => {
        try {
          logger.info(`[YOUTUBE] Listing playlist videos: ${playlistId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            return await youtube.playlistItems.list({
              part: ["snippet", "contentDetails"],
              playlistId,
              maxResults,
              pageToken,
            });
          });

          const items = result.data.items || [];
          logger.info(`[YOUTUBE] Found ${items.length} videos`);

          return {
            success: true,
            data: {
              videos: items.map((item: any) => ({
                videoId: item.contentDetails?.videoId,
                title: item.snippet?.title,
                description: item.snippet?.description,
                channelTitle: item.snippet?.channelTitle,
                publishedAt: item.snippet?.publishedAt,
                position: item.snippet?.position,
                thumbnails: item.snippet?.thumbnails,
              })),
              totalCount: items.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] List playlist videos failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list playlist videos",
          };
        }
      }
    );
  }

  // Get video stats
  createGetVideoStatsTool() {
    return this.createTool(
      "youtube_get_video_stats",
      "Get view count, likes, comments for a video",
      z.object({
        videoId: z.string().min(1, "Video ID is required"),
      }),
      async ({ videoId }) => {
        try {
          logger.info(`[YOUTUBE] Getting video stats: ${videoId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            return await youtube.videos.list({
              part: ["statistics"],
              id: [videoId],
            });
          });

          const video = result.data.items?.[0];
          if (!video) {
            throw new Error("Video not found");
          }

          logger.info(`[YOUTUBE] Retrieved video stats`);

          return {
            success: true,
            data: {
              videoId,
              viewCount: video.statistics?.viewCount,
              likeCount: video.statistics?.likeCount,
              dislikeCount: video.statistics?.dislikeCount,
              favoriteCount: video.statistics?.favoriteCount,
              commentCount: video.statistics?.commentCount,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] Get video stats failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get video stats",
          };
        }
      }
    );
  }

  // List subscriptions
  createListSubscriptionsTool() {
    return this.createTool(
      "youtube_list_subscriptions",
      "List channels the user is subscribed to",
      z.object({
        maxResults: z.number().min(1).max(50).default(25).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ maxResults, pageToken }) => {
        try {
          logger.info(`[YOUTUBE] Listing subscriptions`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            return await youtube.subscriptions.list({
              part: ["snippet"],
              mine: true,
              maxResults,
              pageToken,
            });
          });

          const subscriptions = result.data.items || [];
          logger.info(`[YOUTUBE] Found ${subscriptions.length} subscriptions`);

          return {
            success: true,
            data: {
              subscriptions: subscriptions.map((sub: any) => ({
                channelId: sub.snippet?.resourceId?.channelId,
                title: sub.snippet?.title,
                description: sub.snippet?.description,
                publishedAt: sub.snippet?.publishedAt,
                thumbnails: sub.snippet?.thumbnails,
              })),
              totalCount: subscriptions.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] List subscriptions failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list subscriptions",
          };
        }
      }
    );
  }

  // List my videos
  createListMyVideosTool() {
    return this.createTool(
      "youtube_list_my_videos",
      "List videos uploaded by the authenticated user",
      z.object({
        maxResults: z.number().min(1).max(50).default(25).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ maxResults, pageToken }) => {
        try {
          logger.info(`[YOUTUBE] Listing my videos`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            // First get the user's channel to find uploads playlist
            const channelResult = await youtube.channels.list({
              part: ["contentDetails"],
              mine: true,
            });

            const uploadsPlaylistId = channelResult.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsPlaylistId) {
              throw new Error("Could not find uploads playlist");
            }

            return await youtube.playlistItems.list({
              part: ["snippet", "contentDetails"],
              playlistId: uploadsPlaylistId,
              maxResults,
              pageToken,
            });
          });

          const videos = result.data.items || [];
          logger.info(`[YOUTUBE] Found ${videos.length} videos`);

          return {
            success: true,
            data: {
              videos: videos.map((item: any) => ({
                videoId: item.contentDetails?.videoId,
                title: item.snippet?.title,
                description: item.snippet?.description,
                publishedAt: item.snippet?.publishedAt,
                thumbnails: item.snippet?.thumbnails,
              })),
              totalCount: videos.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] List my videos failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list my videos",
          };
        }
      }
    );
  }

  // Update video
  createUpdateVideoTool() {
    return this.createTool(
      "youtube_update_video",
      "Update title, description, tags, category of own video",
      z.object({
        videoId: z.string().min(1, "Video ID is required"),
        title: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        categoryId: z.string().optional(),
      }),
      async ({ videoId, title, description, tags, categoryId }) => {
        try {
          logger.info(`[YOUTUBE] Updating video: ${videoId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            // Get existing video
            const existing = await youtube.videos.list({
              part: ["snippet"],
              id: [videoId],
            });

            const video = existing.data.items?.[0];
            if (!video) {
              throw new Error("Video not found");
            }

            return await youtube.videos.update({
              part: ["snippet"],
              requestBody: {
                id: videoId,
                snippet: {
                  ...video.snippet,
                  title: title || video.snippet?.title,
                  description: description || video.snippet?.description,
                  tags: tags || video.snippet?.tags,
                  categoryId: categoryId || video.snippet?.categoryId,
                },
              },
            });
          });

          logger.info(`[YOUTUBE] Video updated successfully`);

          return {
            success: true,
            message: "Video updated successfully",
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] Update video failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update video",
          };
        }
      }
    );
  }

  // Get comments
  createGetCommentsTool() {
    return this.createTool(
      "youtube_get_comments",
      "Get top-level comments on a video",
      z.object({
        videoId: z.string().min(1, "Video ID is required"),
        maxResults: z.number().min(1).max(100).default(20).optional(),
        order: z.enum(["time", "relevance"]).default("relevance").optional(),
      }),
      async ({ videoId, maxResults, order }) => {
        try {
          logger.info(`[YOUTUBE] Getting comments for video: ${videoId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            return await youtube.commentThreads.list({
              part: ["snippet"],
              videoId,
              maxResults,
              order,
            });
          });

          const comments = result.data.items || [];
          logger.info(`[YOUTUBE] Found ${comments.length} comments`);

          return {
            success: true,
            data: {
              comments: comments.map((thread: any) => ({
                commentId: thread.id,
                text: thread.snippet?.topLevelComment?.snippet?.textDisplay,
                authorDisplayName: thread.snippet?.topLevelComment?.snippet?.authorDisplayName,
                likeCount: thread.snippet?.topLevelComment?.snippet?.likeCount,
                publishedAt: thread.snippet?.topLevelComment?.snippet?.publishedAt,
                totalReplyCount: thread.snippet?.totalReplyCount,
              })),
              totalCount: comments.length,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] Get comments failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get comments",
          };
        }
      }
    );
  }

  // Reply to comment
  createReplyToCommentTool() {
    return this.createTool(
      "youtube_reply_to_comment",
      "Reply to a comment on own video",
      z.object({
        commentId: z.string().min(1, "Comment ID is required"),
        text: z.string().min(1, "Reply text is required"),
      }),
      async ({ commentId, text }) => {
        try {
          logger.info(`[YOUTUBE] Replying to comment: ${commentId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            return await youtube.comments.insert({
              part: ["snippet"],
              requestBody: {
                snippet: {
                  parentId: commentId,
                  textOriginal: text,
                },
              },
            });
          });

          logger.info(`[YOUTUBE] Reply posted successfully`);

          return {
            success: true,
            message: "Reply posted successfully",
            data: {
              commentId: result.data.id,
            },
          };
        } catch (error: any) {
          logger.error("[YOUTUBE] Reply to comment failed:", error);
          return {
            success: false,
            error: error.message || "Failed to reply to comment",
          };
        }
      }
    );
  }
}


// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

export const createSearchTool = (userId: string) =>
  new YouTubeToolSuite(userId).createSearchTool();

export const createGetVideoTool = (userId: string) =>
  new YouTubeToolSuite(userId).createGetVideoTool();

export const createGetChannelTool = (userId: string) =>
  new YouTubeToolSuite(userId).createGetChannelTool();

export const createListChannelVideosTool = (userId: string) =>
  new YouTubeToolSuite(userId).createListChannelVideosTool();

export const createGetPlaylistTool = (userId: string) =>
  new YouTubeToolSuite(userId).createGetPlaylistTool();

export const createListPlaylistVideosTool = (userId: string) =>
  new YouTubeToolSuite(userId).createListPlaylistVideosTool();

export const createGetVideoStatsTool = (userId: string) =>
  new YouTubeToolSuite(userId).createGetVideoStatsTool();

export const createListSubscriptionsTool = (userId: string) =>
  new YouTubeToolSuite(userId).createListSubscriptionsTool();

export const createListMyVideosTool = (userId: string) =>
  new YouTubeToolSuite(userId).createListMyVideosTool();

export const createUpdateVideoTool = (userId: string) =>
  new YouTubeToolSuite(userId).createUpdateVideoTool();

export const createGetCommentsTool = (userId: string) =>
  new YouTubeToolSuite(userId).createGetCommentsTool();

export const createReplyToCommentTool = (userId: string) =>
  new YouTubeToolSuite(userId).createReplyToCommentTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createYouTubeTools = (userId: string) => {
  const suite = new YouTubeToolSuite(userId);
  return [
    suite.createSearchTool(),
    suite.createGetVideoTool(),
    suite.createGetChannelTool(),
    suite.createListChannelVideosTool(),
    suite.createGetPlaylistTool(),
    suite.createListPlaylistVideosTool(),
    suite.createGetVideoStatsTool(),
    suite.createListSubscriptionsTool(),
    suite.createListMyVideosTool(),
    suite.createUpdateVideoTool(),
    suite.createGetCommentsTool(),
    suite.createReplyToCommentTool(),
  ];
};
