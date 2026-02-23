import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE SLIDES TOOL SUITE - COMPREHENSIVE
// ============================================

export class SlidesToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Create presentation
  createCreateTool() {
    return this.createTool(
      "gslides_create",
      "Create a new presentation with title",
      z.object({
        title: z.string().min(1, "Title is required"),
      }),
      async ({ title }) => {
        try {
          logger.info(`[SLIDES] Creating presentation: ${title}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.create({
              requestBody: {
                title,
              },
            });
          });

          logger.info(`[SLIDES] Presentation created: ${result.data.presentationId}`);

          return {
            success: true,
            data: {
              presentationId: result.data.presentationId,
              title: result.data.title,
              url: `https://docs.google.com/presentation/d/${result.data.presentationId}/edit`,
            },
          };
        } catch (error: any) {
          logger.error("[SLIDES] Create failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create presentation",
          };
        }
      }
    );
  }

  // Get presentation
  createGetTool() {
    return this.createTool(
      "gslides_get",
      "Get presentation metadata and slide count",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
      }),
      async ({ presentationId }) => {
        try {
          logger.info(`[SLIDES] Getting presentation: ${presentationId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.get({
              presentationId,
            });
          });

          const slideCount = result.data.slides?.length || 0;
          logger.info(`[SLIDES] Retrieved presentation with ${slideCount} slides`);

          return {
            success: true,
            data: {
              presentationId: result.data.presentationId,
              title: result.data.title,
              slideCount,
              pageSize: result.data.pageSize,
            },
          };
        } catch (error: any) {
          logger.error("[SLIDES] Get failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get presentation",
          };
        }
      }
    );
  }

  // Get slide
  createGetSlideTool() {
    return this.createTool(
      "gslides_get_slide",
      "Get a specific slide's content and elements",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
        slideId: z.string().min(1, "Slide ID is required"),
      }),
      async ({ presentationId, slideId }) => {
        try {
          logger.info(`[SLIDES] Getting slide: ${slideId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            const presentation = await slides.presentations.get({
              presentationId,
            });

            const slide = presentation.data.slides?.find((s: any) => s.objectId === slideId);

            return { data: slide };
          });

          if (!result.data) {
            throw new Error("Slide not found");
          }

          logger.info(`[SLIDES] Retrieved slide`);

          return {
            success: true,
            data: {
              slideId: result.data.objectId,
              pageElements: result.data.pageElements,
              slideProperties: result.data.slideProperties,
            },
          };
        } catch (error: any) {
          logger.error("[SLIDES] Get slide failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get slide",
          };
        }
      }
    );
  }

  // List slides
  createListSlidesTool() {
    return this.createTool(
      "gslides_list_slides",
      "List all slides with their IDs and titles",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
      }),
      async ({ presentationId }) => {
        try {
          logger.info(`[SLIDES] Listing slides`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.get({
              presentationId,
            });
          });

          const slidesList = result.data.slides?.map((slide: any, index: number) => ({
            slideId: slide.objectId,
            index,
            title: this.extractSlideTitle(slide),
          })) || [];

          logger.info(`[SLIDES] Found ${slidesList.length} slides`);

          return {
            success: true,
            data: {
              slides: slidesList,
              totalCount: slidesList.length,
            },
          };
        } catch (error: any) {
          logger.error("[SLIDES] List slides failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list slides",
          };
        }
      }
    );
  }

  // Add slide
  createAddSlideTool() {
    return this.createTool(
      "gslides_add_slide",
      "Add a new slide with a layout",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
        insertionIndex: z.number().optional().describe("Position to insert slide (optional, appends if not provided)"),
        layout: z.enum(["BLANK", "TITLE", "TITLE_AND_BODY", "TITLE_ONLY", "SECTION_HEADER", "CAPTION_ONLY"]).default("BLANK").optional(),
      }),
      async ({ presentationId, insertionIndex, layout }) => {
        try {
          logger.info(`[SLIDES] Adding slide with layout: ${layout}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            const slideId = `slide_${Date.now()}`;

            return await slides.presentations.batchUpdate({
              presentationId,
              requestBody: {
                requests: [
                  {
                    createSlide: {
                      objectId: slideId,
                      insertionIndex,
                      slideLayoutReference: {
                        predefinedLayout: layout,
                      },
                    },
                  },
                ],
              },
            });
          });

          const slideId = result.data.replies?.[0]?.createSlide?.objectId;
          logger.info(`[SLIDES] Slide added: ${slideId}`);

          return {
            success: true,
            data: {
              slideId,
            },
          };
        } catch (error: any) {
          logger.error("[SLIDES] Add slide failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add slide",
          };
        }
      }
    );
  }

  // Delete slide
  createDeleteSlideTool() {
    return this.createTool(
      "gslides_delete_slide",
      "Delete a slide",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
        slideId: z.string().min(1, "Slide ID is required"),
      }),
      async ({ presentationId, slideId }) => {
        try {
          logger.info(`[SLIDES] Deleting slide: ${slideId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.batchUpdate({
              presentationId,
              requestBody: {
                requests: [
                  {
                    deleteObject: {
                      objectId: slideId,
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SLIDES] Slide deleted successfully`);

          return {
            success: true,
            message: "Slide deleted successfully",
          };
        } catch (error: any) {
          logger.error("[SLIDES] Delete slide failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete slide",
          };
        }
      }
    );
  }

  // Duplicate slide
  createDuplicateSlideTool() {
    return this.createTool(
      "gslides_duplicate_slide",
      "Duplicate a slide",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
        slideId: z.string().min(1, "Slide ID is required"),
      }),
      async ({ presentationId, slideId }) => {
        try {
          logger.info(`[SLIDES] Duplicating slide: ${slideId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.batchUpdate({
              presentationId,
              requestBody: {
                requests: [
                  {
                    duplicateObject: {
                      objectId: slideId,
                    },
                  },
                ],
              },
            });
          });

          const newSlideId = result.data.replies?.[0]?.duplicateObject?.objectId;
          logger.info(`[SLIDES] Slide duplicated: ${newSlideId}`);

          return {
            success: true,
            data: {
              newSlideId,
            },
          };
        } catch (error: any) {
          logger.error("[SLIDES] Duplicate slide failed:", error);
          return {
            success: false,
            error: error.message || "Failed to duplicate slide",
          };
        }
      }
    );
  }

  // Move slide
  createMoveSlideTool() {
    return this.createTool(
      "gslides_move_slide",
      "Reorder a slide to a new position",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
        slideId: z.string().min(1, "Slide ID is required"),
        newIndex: z.number().min(0, "New index must be at least 0"),
      }),
      async ({ presentationId, slideId, newIndex }) => {
        try {
          logger.info(`[SLIDES] Moving slide ${slideId} to index ${newIndex}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.batchUpdate({
              presentationId,
              requestBody: {
                requests: [
                  {
                    updateSlidesPosition: {
                      slideObjectIds: [slideId],
                      insertionIndex: newIndex,
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SLIDES] Slide moved successfully`);

          return {
            success: true,
            message: "Slide moved successfully",
          };
        } catch (error: any) {
          logger.error("[SLIDES] Move slide failed:", error);
          return {
            success: false,
            error: error.message || "Failed to move slide",
          };
        }
      }
    );
  }

  // Update text
  createUpdateTextTool() {
    return this.createTool(
      "gslides_update_text",
      "Update text in a specific shape/element on a slide",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
        shapeId: z.string().min(1, "Shape/element ID is required"),
        text: z.string().min(1, "Text is required"),
      }),
      async ({ presentationId, shapeId, text }) => {
        try {
          logger.info(`[SLIDES] Updating text in shape: ${shapeId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.batchUpdate({
              presentationId,
              requestBody: {
                requests: [
                  {
                    deleteText: {
                      objectId: shapeId,
                      textRange: {
                        type: "ALL",
                      },
                    },
                  },
                  {
                    insertText: {
                      objectId: shapeId,
                      text,
                      insertionIndex: 0,
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SLIDES] Text updated successfully`);

          return {
            success: true,
            message: "Text updated successfully",
          };
        } catch (error: any) {
          logger.error("[SLIDES] Update text failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update text",
          };
        }
      }
    );
  }

  // Replace text
  createReplaceTextTool() {
    return this.createTool(
      "gslides_replace_text",
      "Find and replace text across all slides",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
        find: z.string().min(1, "Text to find is required"),
        replace: z.string().describe("Replacement text"),
        matchCase: z.boolean().default(false).optional(),
      }),
      async ({ presentationId, find, replace, matchCase }) => {
        try {
          logger.info(`[SLIDES] Replacing text: "${find}" with "${replace}"`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.batchUpdate({
              presentationId,
              requestBody: {
                requests: [
                  {
                    replaceAllText: {
                      containsText: {
                        text: find,
                        matchCase,
                      },
                      replaceText: replace,
                    },
                  },
                ],
              },
            });
          });

          const occurrences = result.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
          logger.info(`[SLIDES] Replaced ${occurrences} occurrences`);

          return {
            success: true,
            data: {
              occurrencesChanged: occurrences,
            },
          };
        } catch (error: any) {
          logger.error("[SLIDES] Replace text failed:", error);
          return {
            success: false,
            error: error.message || "Failed to replace text",
          };
        }
      }
    );
  }

  // Insert image
  createInsertImageTool() {
    return this.createTool(
      "gslides_insert_image",
      "Insert an image from URL onto a slide",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
        slideId: z.string().min(1, "Slide ID is required"),
        imageUrl: z.string().url("Valid image URL is required"),
        x: z.number().optional().describe("X position in EMU (default: 0)"),
        y: z.number().optional().describe("Y position in EMU (default: 0)"),
        width: z.number().optional().describe("Width in EMU (default: 3000000)"),
        height: z.number().optional().describe("Height in EMU (default: 3000000)"),
      }),
      async ({ presentationId, slideId, imageUrl, x, y, width, height }) => {
        try {
          logger.info(`[SLIDES] Inserting image on slide: ${slideId}`);

          const imageId = `image_${Date.now()}`;

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.batchUpdate({
              presentationId,
              requestBody: {
                requests: [
                  {
                    createImage: {
                      objectId: imageId,
                      url: imageUrl,
                      elementProperties: {
                        pageObjectId: slideId,
                        size: {
                          width: { magnitude: width || 3000000, unit: "EMU" },
                          height: { magnitude: height || 3000000, unit: "EMU" },
                        },
                        transform: {
                          scaleX: 1,
                          scaleY: 1,
                          translateX: x || 0,
                          translateY: y || 0,
                          unit: "EMU",
                        },
                      },
                    },
                  },
                ],
              },
            });
          });

          logger.info(`[SLIDES] Image inserted: ${imageId}`);

          return {
            success: true,
            data: {
              imageId,
            },
          };
        } catch (error: any) {
          logger.error("[SLIDES] Insert image failed:", error);
          return {
            success: false,
            error: error.message || "Failed to insert image",
          };
        }
      }
    );
  }

  // Set slide background
  createSetSlideBackgroundTool() {
    return this.createTool(
      "gslides_set_slide_background",
      "Set background color or image of a slide",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
        slideId: z.string().min(1, "Slide ID is required"),
        backgroundColor: z.object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1),
        }).optional(),
        imageUrl: z.string().url().optional(),
      }),
      async ({ presentationId, slideId, backgroundColor, imageUrl }) => {
        try {
          logger.info(`[SLIDES] Setting slide background`);

          const requests: any[] = [];

          if (backgroundColor) {
            requests.push({
              updatePageProperties: {
                objectId: slideId,
                pageProperties: {
                  pageBackgroundFill: {
                    solidFill: {
                      color: {
                        rgbColor: backgroundColor,
                      },
                    },
                  },
                },
                fields: "pageBackgroundFill.solidFill.color",
              },
            });
          } else if (imageUrl) {
            requests.push({
              updatePageProperties: {
                objectId: slideId,
                pageProperties: {
                  pageBackgroundFill: {
                    stretchedPictureFill: {
                      contentUrl: imageUrl,
                    },
                  },
                },
                fields: "pageBackgroundFill.stretchedPictureFill",
              },
            });
          }

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.batchUpdate({
              presentationId,
              requestBody: { requests },
            });
          });

          logger.info(`[SLIDES] Slide background set successfully`);

          return {
            success: true,
            message: "Slide background set successfully",
          };
        } catch (error: any) {
          logger.error("[SLIDES] Set slide background failed:", error);
          return {
            success: false,
            error: error.message || "Failed to set slide background",
          };
        }
      }
    );
  }

  // Get thumbnail
  createGetThumbnailTool() {
    return this.createTool(
      "gslides_get_thumbnail",
      "Get a thumbnail image URL for a slide",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
        slideId: z.string().min(1, "Slide ID is required"),
      }),
      async ({ presentationId, slideId }) => {
        try {
          logger.info(`[SLIDES] Getting thumbnail for slide: ${slideId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const slides = google.slides({ version: "v1", auth: oauth2Client });

            return await slides.presentations.pages.getThumbnail({
              presentationId,
              pageObjectId: slideId,
            });
          });

          logger.info(`[SLIDES] Thumbnail retrieved`);

          return {
            success: true,
            data: {
              thumbnailUrl: result.data.contentUrl,
              width: result.data.width,
              height: result.data.height,
            },
          };
        } catch (error: any) {
          logger.error("[SLIDES] Get thumbnail failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get thumbnail",
          };
        }
      }
    );
  }

  // Export PDF
  createExportPdfTool() {
    return this.createTool(
      "gslides_export_pdf",
      "Export entire presentation as PDF",
      z.object({
        presentationId: z.string().min(1, "Presentation ID is required"),
      }),
      async ({ presentationId }) => {
        try {
          logger.info(`[SLIDES] Exporting presentation as PDF`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const drive = google.drive({ version: "v3", auth: oauth2Client });

            return await drive.files.export({
              fileId: presentationId,
              mimeType: "application/pdf",
            }, {
              responseType: "arraybuffer",
            });
          });

          logger.info(`[SLIDES] PDF exported successfully`);

          return {
            success: true,
            data: {
              pdfData: Buffer.from(result.data as ArrayBuffer).toString("base64"),
              downloadUrl: `https://docs.google.com/presentation/d/${presentationId}/export/pdf`,
            },
          };
        } catch (error: any) {
          logger.error("[SLIDES] Export PDF failed:", error);
          return {
            success: false,
            error: error.message || "Failed to export PDF",
          };
        }
      }
    );
  }

  // Helper method
  private extractSlideTitle(slide: any): string {
    const pageElements = slide.pageElements || [];
    for (const element of pageElements) {
      if (element.shape?.shapeType === "TEXT_BOX" && element.shape?.text) {
        const textElements = element.shape.text.textElements || [];
        for (const textElement of textElements) {
          if (textElement.textRun?.content) {
            return textElement.textRun.content.trim();
          }
        }
      }
    }
    return "Untitled Slide";
  }
}


// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

export const createCreateTool = (userId: string) =>
  new SlidesToolSuite(userId).createCreateTool();

export const createGetTool = (userId: string) =>
  new SlidesToolSuite(userId).createGetTool();

export const createGetSlideTool = (userId: string) =>
  new SlidesToolSuite(userId).createGetSlideTool();

export const createListSlidesTool = (userId: string) =>
  new SlidesToolSuite(userId).createListSlidesTool();

export const createAddSlideTool = (userId: string) =>
  new SlidesToolSuite(userId).createAddSlideTool();

export const createDeleteSlideTool = (userId: string) =>
  new SlidesToolSuite(userId).createDeleteSlideTool();

export const createDuplicateSlideTool = (userId: string) =>
  new SlidesToolSuite(userId).createDuplicateSlideTool();

export const createMoveSlideTool = (userId: string) =>
  new SlidesToolSuite(userId).createMoveSlideTool();

export const createUpdateTextTool = (userId: string) =>
  new SlidesToolSuite(userId).createUpdateTextTool();

export const createReplaceTextTool = (userId: string) =>
  new SlidesToolSuite(userId).createReplaceTextTool();

export const createInsertImageTool = (userId: string) =>
  new SlidesToolSuite(userId).createInsertImageTool();

export const createSetSlideBackgroundTool = (userId: string) =>
  new SlidesToolSuite(userId).createSetSlideBackgroundTool();

export const createGetThumbnailTool = (userId: string) =>
  new SlidesToolSuite(userId).createGetThumbnailTool();

export const createExportPdfTool = (userId: string) =>
  new SlidesToolSuite(userId).createExportPdfTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createSlidesTools = (userId: string) => {
  const suite = new SlidesToolSuite(userId);
  return [
    suite.createCreateTool(),
    suite.createGetTool(),
    suite.createGetSlideTool(),
    suite.createListSlidesTool(),
    suite.createAddSlideTool(),
    suite.createDeleteSlideTool(),
    suite.createDuplicateSlideTool(),
    suite.createMoveSlideTool(),
    suite.createUpdateTextTool(),
    suite.createReplaceTextTool(),
    suite.createInsertImageTool(),
    suite.createSetSlideBackgroundTool(),
    suite.createGetThumbnailTool(),
    suite.createExportPdfTool(),
  ];
};
