import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE PHOTOS TOOL SUITE - COMPREHENSIVE
// ============================================

export class PhotosToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // List albums
  createListAlbumsTool() {
    return this.createTool(
      "gphotos_list_albums",
      "List all albums",
      z.object({
        pageSize: z.number().min(1).max(50).default(20).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ pageSize, pageToken }) => {
        try {
          logger.info(`[PHOTOS] Listing albums`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const photoslibrary = google.photoslibrary({ version: "v1", auth: oauth2Client });

            return await photoslibrary.albums.list({
              pageSize,
              pageToken,
            });
          });

          const albums = result.data.albums || [];
          logger.info(`[PHOTOS] Found ${albums.length} albums`);

          return {
            success: true,
            data: {
              albums: albums.map((album: any) => ({
                id: album.id,
                title: album.title,
                productUrl: album.productUrl,
                mediaItemsCount: album.mediaItemsCount,
                coverPhotoBaseUrl: album.coverPhotoBaseUrl,
              })),
              totalCount: albums.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[PHOTOS] List albums failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list albums",
          };
        }
      }
    );
  }

  // Get album
  createGetAlbumTool() {
    return this.createTool(
      "gphotos_get_album",
      "Get album metadata and item count",
      z.object({
        albumId: z.string().min(1, "Album ID is required"),
      }),
      async ({ albumId }) => {
        try {
          logger.info(`[PHOTOS] Getting album: ${albumId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const photoslibrary = google.photoslibrary({ version: "v1", auth: oauth2Client });

            return await photoslibrary.albums.get({
              albumId,
            });
          });

          logger.info(`[PHOTOS] Retrieved album`);

          return {
            success: true,
            data: {
              id: result.data.id,
              title: result.data.title,
              productUrl: result.data.productUrl,
              mediaItemsCount: result.data.mediaItemsCount,
              coverPhotoBaseUrl: result.data.coverPhotoBaseUrl,
              isWriteable: result.data.isWriteable,
            },
          };
        } catch (error: any) {
          logger.error("[PHOTOS] Get album failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get album",
          };
        }
      }
    );
  }

  // List media
  createListMediaTool() {
    return this.createTool(
      "gphotos_list_media",
      "List media items, optionally from an album, with pageToken",
      z.object({
        albumId: z.string().optional().describe("Album ID to list media from (optional)"),
        pageSize: z.number().min(1).max(100).default(25).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ albumId, pageSize, pageToken }) => {
        try {
          logger.info(`[PHOTOS] Listing media items`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const photoslibrary = google.photoslibrary({ version: "v1", auth: oauth2Client });

            if (albumId) {
              return await photoslibrary.mediaItems.search({
                requestBody: {
                  albumId,
                  pageSize,
                  pageToken,
                },
              });
            } else {
              return await photoslibrary.mediaItems.list({
                pageSize,
                pageToken,
              });
            }
          });

          const mediaItems = result.data.mediaItems || [];
          logger.info(`[PHOTOS] Found ${mediaItems.length} media items`);

          return {
            success: true,
            data: {
              mediaItems: mediaItems.map((item: any) => ({
                id: item.id,
                productUrl: item.productUrl,
                baseUrl: item.baseUrl,
                mimeType: item.mimeType,
                filename: item.filename,
                mediaMetadata: item.mediaMetadata,
              })),
              totalCount: mediaItems.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[PHOTOS] List media failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list media",
          };
        }
      }
    );
  }

  // Get media item
  createGetMediaItemTool() {
    return this.createTool(
      "gphotos_get_media_item",
      "Get a specific media item with download URL",
      z.object({
        mediaItemId: z.string().min(1, "Media item ID is required"),
      }),
      async ({ mediaItemId }) => {
        try {
          logger.info(`[PHOTOS] Getting media item: ${mediaItemId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const photoslibrary = google.photoslibrary({ version: "v1", auth: oauth2Client });

            return await photoslibrary.mediaItems.get({
              mediaItemId,
            });
          });

          logger.info(`[PHOTOS] Retrieved media item`);

          return {
            success: true,
            data: {
              id: result.data.id,
              productUrl: result.data.productUrl,
              baseUrl: result.data.baseUrl,
              downloadUrl: `${result.data.baseUrl}=d`,
              mimeType: result.data.mimeType,
              filename: result.data.filename,
              mediaMetadata: result.data.mediaMetadata,
              description: result.data.description,
            },
          };
        } catch (error: any) {
          logger.error("[PHOTOS] Get media item failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get media item",
          };
        }
      }
    );
  }

  // Search media
  createSearchMediaTool() {
    return this.createTool(
      "gphotos_search_media",
      "Search media by date range, content categories (LANDSCAPES, SELFIES, ANIMALS etc)",
      z.object({
        dateRangeStart: z.object({
          year: z.number(),
          month: z.number().min(1).max(12),
          day: z.number().min(1).max(31),
        }).optional(),
        dateRangeEnd: z.object({
          year: z.number(),
          month: z.number().min(1).max(12),
          day: z.number().min(1).max(31),
        }).optional(),
        contentCategories: z.array(z.enum([
          "LANDSCAPES", "RECEIPTS", "CITYSCAPES", "LANDMARKS", "SELFIES",
          "PEOPLE", "PETS", "WEDDINGS", "BIRTHDAYS", "DOCUMENTS",
          "TRAVEL", "ANIMALS", "FOOD", "SPORT", "NIGHT", "PERFORMANCES",
          "WHITEBOARDS", "SCREENSHOTS", "UTILITY", "ARTS", "CRAFTS", "FASHION"
        ])).optional(),
        pageSize: z.number().min(1).max(100).default(25).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ dateRangeStart, dateRangeEnd, contentCategories, pageSize, pageToken }) => {
        try {
          logger.info(`[PHOTOS] Searching media`);

          const filters: any = {};
          
          if (dateRangeStart || dateRangeEnd) {
            filters.dateFilter = {
              ranges: [{
                startDate: dateRangeStart,
                endDate: dateRangeEnd,
              }],
            };
          }

          if (contentCategories && contentCategories.length > 0) {
            filters.contentFilter = {
              includedContentCategories: contentCategories,
            };
          }

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const photoslibrary = google.photoslibrary({ version: "v1", auth: oauth2Client });

            return await photoslibrary.mediaItems.search({
              requestBody: {
                filters: Object.keys(filters).length > 0 ? filters : undefined,
                pageSize,
                pageToken,
              },
            });
          });

          const mediaItems = result.data.mediaItems || [];
          logger.info(`[PHOTOS] Found ${mediaItems.length} media items`);

          return {
            success: true,
            data: {
              mediaItems: mediaItems.map((item: any) => ({
                id: item.id,
                productUrl: item.productUrl,
                baseUrl: item.baseUrl,
                filename: item.filename,
                mimeType: item.mimeType,
              })),
              totalCount: mediaItems.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[PHOTOS] Search media failed:", error);
          return {
            success: false,
            error: error.message || "Failed to search media",
          };
        }
      }
    );
  }

  // Create album
  createCreateAlbumTool() {
    return this.createTool(
      "gphotos_create_album",
      "Create a new album",
      z.object({
        title: z.string().min(1, "Album title is required"),
      }),
      async ({ title }) => {
        try {
          logger.info(`[PHOTOS] Creating album: ${title}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const photoslibrary = google.photoslibrary({ version: "v1", auth: oauth2Client });

            return await photoslibrary.albums.create({
              requestBody: {
                album: {
                  title,
                },
              },
            });
          });

          logger.info(`[PHOTOS] Album created: ${result.data.id}`);

          return {
            success: true,
            data: {
              id: result.data.id,
              title: result.data.title,
              productUrl: result.data.productUrl,
            },
          };
        } catch (error: any) {
          logger.error("[PHOTOS] Create album failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create album",
          };
        }
      }
    );
  }

  // Add to album
  createAddToAlbumTool() {
    return this.createTool(
      "gphotos_add_to_album",
      "Add existing media items to an album",
      z.object({
        albumId: z.string().min(1, "Album ID is required"),
        mediaItemIds: z.array(z.string()).min(1, "At least one media item ID is required"),
      }),
      async ({ albumId, mediaItemIds }) => {
        try {
          logger.info(`[PHOTOS] Adding ${mediaItemIds.length} items to album`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const photoslibrary = google.photoslibrary({ version: "v1", auth: oauth2Client });

            return await photoslibrary.albums.batchAddMediaItems({
              albumId,
              requestBody: {
                mediaItemIds,
              },
            });
          });

          logger.info(`[PHOTOS] Items added to album successfully`);

          return {
            success: true,
            message: `Added ${mediaItemIds.length} items to album`,
          };
        } catch (error: any) {
          logger.error("[PHOTOS] Add to album failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add items to album",
          };
        }
      }
    );
  }
}

// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

export const createListAlbumsTool = (userId: string) =>
  new PhotosToolSuite(userId).createListAlbumsTool();

export const createGetAlbumTool = (userId: string) =>
  new PhotosToolSuite(userId).createGetAlbumTool();

export const createListMediaTool = (userId: string) =>
  new PhotosToolSuite(userId).createListMediaTool();

export const createGetMediaItemTool = (userId: string) =>
  new PhotosToolSuite(userId).createGetMediaItemTool();

export const createSearchMediaTool = (userId: string) =>
  new PhotosToolSuite(userId).createSearchMediaTool();

export const createCreateAlbumTool = (userId: string) =>
  new PhotosToolSuite(userId).createCreateAlbumTool();

export const createAddToAlbumTool = (userId: string) =>
  new PhotosToolSuite(userId).createAddToAlbumTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createPhotosTools = (userId: string) => {
  const suite = new PhotosToolSuite(userId);
  return [
    suite.createListAlbumsTool(),
    suite.createGetAlbumTool(),
    suite.createListMediaTool(),
    suite.createGetMediaItemTool(),
    suite.createSearchMediaTool(),
    suite.createCreateAlbumTool(),
    suite.createAddToAlbumTool(),
  ];
};
