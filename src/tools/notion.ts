import { z } from "zod";
import { logger } from "../services/logger";
import { BaseNotionTool } from "./base";
import { NotionService } from "../services/notion.service";

// ============================================
// NOTION TOOL SUITE - COMPREHENSIVE (45 tools)
// ============================================

export class NotionToolSuite extends BaseNotionTool {
  constructor(userId: string) {
    super(userId);
  }

  private async getNotionService(): Promise<NotionService> {
    const service = await NotionService.fromUserId(this.userId);
    if (!service) {
      throw new Error("Notion account not connected. Please connect your Notion account first.");
    }
    return service;
  }

  // ============================================
  // PAGES (8 tools)
  // ============================================

  // Get page by ID including properties
  createGetPageTool() {
    return this.createTool(
      "notion_get_page",
      "Get page by ID including properties",
      z.object({
        pageId: z.string().min(1, "Page ID is required"),
      }),
      async ({ pageId }) => {
        try {
          logger.info(`[NOTION] Getting page: ${pageId}`);
          const service = await this.getNotionService();
          const page = await service.getPage(pageId);

          return {
            success: true,
            data: page,
          };
        } catch (error: any) {
          logger.error("[NOTION] Get page failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get page",
          };
        }
      }
    );
  }

  // Create a page in a database or as child of a page with properties
  createCreatePageTool() {
    return this.createTool(
      "notion_create_page",
      "Create a page in a database or as child of a page with properties",
      z.object({
        parentId: z.string().min(1, "Parent ID is required"),
        parentType: z.enum(["page", "database"]).describe("Type of parent (page or database)"),
        title: z.string().min(1, "Title is required"),
        properties: z.any().optional().describe("Additional properties for the page"),
        content: z.array(z.any()).optional().describe("Initial content blocks for the page"),
      }),
      async ({ parentId, parentType, title, properties = {}, content }) => {
        try {
          logger.info(`[NOTION] Creating page in ${parentType}: ${parentId}`);
          const service = await this.getNotionService();

          const parent = parentType === "page" ? { page_id: parentId } : { database_id: parentId };

          // Set title in properties
          const finalProperties: any = { ...properties };
          if (parentType === "page") {
            finalProperties.title = { title: [{ text: { content: title } }] };
          } else {
            // For databases, find the title property or use "Name"
            const titleKey = Object.keys(properties).find(k => properties[k]?.type === "title") || "Name";
            finalProperties[titleKey] = { title: [{ text: { content: title } }] };
          }

          const page = await service.createPage(parent, finalProperties, content);

          return {
            success: true,
            data: {
              pageId: page.id,
              url: (page as any).url,
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Create page failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create page",
          };
        }
      }
    );
  }

  // Update page properties
  createUpdatePageTool() {
    return this.createTool(
      "notion_update_page",
      "Update page properties (title, status, date, etc.)",
      z.object({
        pageId: z.string().min(1, "Page ID is required"),
        properties: z.any().describe("Properties to update"),
      }),
      async ({ pageId, properties }) => {
        try {
          logger.info(`[NOTION] Updating page: ${pageId}`);
          const service = await this.getNotionService();
          const page = await service.updatePageProperties(pageId, properties);

          return {
            success: true,
            data: page,
          };
        } catch (error: any) {
          logger.error("[NOTION] Update page failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update page",
          };
        }
      }
    );
  }

  // Archive (soft-delete) a page
  createArchivePageTool() {
    return this.createTool(
      "notion_archive_page",
      "Archive (soft-delete) a page",
      z.object({
        pageId: z.string().min(1, "Page ID is required"),
      }),
      async ({ pageId }) => {
        try {
          logger.info(`[NOTION] Archiving page: ${pageId}`);
          const service = await this.getNotionService();
          await service.updatePageProperties(pageId, { archived: true });

          return {
            success: true,
            message: "Page archived successfully",
          };
        } catch (error: any) {
          logger.error("[NOTION] Archive page failed:", error);
          return {
            success: false,
            error: error.message || "Failed to archive page",
          };
        }
      }
    );
  }

  // Un-archive a page
  createRestorePageTool() {
    return this.createTool(
      "notion_restore_page",
      "Un-archive a page",
      z.object({
        pageId: z.string().min(1, "Page ID is required"),
      }),
      async ({ pageId }) => {
        try {
          logger.info(`[NOTION] Restoring page: ${pageId}`);
          const service = await this.getNotionService();
          await service.updatePageProperties(pageId, { archived: false });

          return {
            success: true,
            message: "Page restored successfully",
          };
        } catch (error: any) {
          logger.error("[NOTION] Restore page failed:", error);
          return {
            success: false,
            error: error.message || "Failed to restore page",
          };
        }
      }
    );
  }

  // Duplicate a page
  createDuplicatePageTool() {
    return this.createTool(
      "notion_duplicate_page",
      "Duplicate a page (create with same content)",
      z.object({
        pageId: z.string().min(1, "Page ID is required"),
        newTitle: z.string().optional().describe("Title for the duplicated page"),
      }),
      async ({ pageId, newTitle }) => {
        try {
          logger.info(`[NOTION] Duplicating page: ${pageId}`);
          const service = await this.getNotionService();

          // Get original page
          const originalPage: any = await service.getPage(pageId);
          const content = await service.getPageContent(pageId);

          // Extract parent
          const parent = originalPage.parent;

          // Copy properties and update title if provided
          const properties = { ...originalPage.properties };
          if (newTitle) {
            const titleKey = Object.keys(properties).find(k => properties[k]?.type === "title") || "title";
            properties[titleKey] = { title: [{ text: { content: newTitle } }] };
          }

          // Create new page with same content
          const blocks = content.results.map((b: any) => {
            const { id, created_time, created_by, last_edited_time, last_edited_by, has_children, archived, ...rest } = b;
            return rest;
          });

          const newPage = await service.createPage(parent, properties, blocks);

          return {
            success: true,
            data: {
              pageId: newPage.id,
              url: (newPage as any).url,
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Duplicate page failed:", error);
          return {
            success: false,
            error: error.message || "Failed to duplicate page",
          };
        }
      }
    );
  }

  // Get all blocks from a page as readable text
  createGetPageContentTool() {
    return this.createTool(
      "notion_get_page_content",
      "Get all blocks from a page as readable text",
      z.object({
        pageId: z.string().min(1, "Page ID is required"),
      }),
      async ({ pageId }) => {
        try {
          logger.info(`[NOTION] Getting page content: ${pageId}`);
          const service = await this.getNotionService();
          const content = await service.getPageContent(pageId);

          // Convert blocks to readable text
          const text = content.results
            .map((b: any) => {
              const blockType = b.type;
              const blockContent = b[blockType];
              if (blockContent?.rich_text) {
                return blockContent.rich_text.map((rt: any) => rt.plain_text).join("");
              }
              return "";
            })
            .filter(t => t.length > 0)
            .join("\n");

          return {
            success: true,
            data: {
              blocks: content.results,
              text,
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Get page content failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get page content",
          };
        }
      }
    );
  }

  // Search pages by title or content
  createSearchPagesTool() {
    return this.createTool(
      "notion_search_pages",
      "Search pages by title or content",
      z.object({
        query: z.string().min(1, "Search query is required"),
      }),
      async ({ query }) => {
        try {
          logger.info(`[NOTION] Searching pages: ${query}`);
          const service = await this.getNotionService();
          const result = await service.search(query, { property: "object", value: "page" });

          return {
            success: true,
            data: {
              results: result.results.map((item: any) => ({
                id: item.id,
                title: item.properties?.title?.title?.[0]?.plain_text || 
                       item.properties?.Name?.title?.[0]?.plain_text || 
                       "Untitled",
                url: item.url,
              })),
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Search pages failed:", error);
          return {
            success: false,
            error: error.message || "Failed to search pages",
          };
        }
      }
    );
  }

  // ============================================
  // BLOCKS (15 tools)
  // ============================================

  // List all child blocks of a page or block
  createGetBlocksTool() {
    return this.createTool(
      "notion_get_blocks",
      "List all child blocks of a page or block",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
      }),
      async ({ blockId }) => {
        try {
          logger.info(`[NOTION] Getting blocks: ${blockId}`);
          const service = await this.getNotionService();
          const content = await service.getPageContent(blockId);

          return {
            success: true,
            data: {
              blocks: content.results,
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Get blocks failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get blocks",
          };
        }
      }
    );
  }

  // Append blocks to a page
  createAppendBlocksTool() {
    return this.createTool(
      "notion_append_blocks",
      "Append blocks to a page (paragraph, heading, todo, bullet, code, etc.)",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        children: z.array(z.any()).describe("List of blocks to append"),
      }),
      async ({ blockId, children }) => {
        try {
          logger.info(`[NOTION] Appending blocks to: ${blockId}`);
          const service = await this.getNotionService();
          const result = await service.appendBlock(blockId, children);

          return {
            success: true,
            data: {
              results: result.results,
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Append blocks failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append blocks",
          };
        }
      }
    );
  }

  // Update a block's content
  createUpdateBlockTool() {
    return this.createTool(
      "notion_update_block",
      "Update a block's content",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        content: z.any().describe("New content for the block"),
      }),
      async ({ blockId, content }) => {
        try {
          logger.info(`[NOTION] Updating block: ${blockId}`);
          const service = await this.getNotionService();
          const block = await service.updateBlock(blockId, content);

          return {
            success: true,
            data: block,
          };
        } catch (error: any) {
          logger.error("[NOTION] Update block failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update block",
          };
        }
      }
    );
  }

  // Delete a block
  createDeleteBlockTool() {
    return this.createTool(
      "notion_delete_block",
      "Delete a block",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
      }),
      async ({ blockId }) => {
        try {
          logger.info(`[NOTION] Deleting block: ${blockId}`);
          const service = await this.getNotionService();
          await service.deleteBlock(blockId);

          return {
            success: true,
            message: "Block deleted successfully",
          };
        } catch (error: any) {
          logger.error("[NOTION] Delete block failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete block",
          };
        }
      }
    );
  }

  // Get a specific block
  createGetBlockTool() {
    return this.createTool(
      "notion_get_block",
      "Get a specific block",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
      }),
      async ({ blockId }) => {
        try {
          logger.info(`[NOTION] Getting block: ${blockId}`);
          const service = await this.getNotionService();
          const block = await service.getBlock(blockId);

          return {
            success: true,
            data: block,
          };
        } catch (error: any) {
          logger.error("[NOTION] Get block failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get block",
          };
        }
      }
    );
  }

  // Quick helper: append a paragraph text block
  createAppendParagraphTool() {
    return this.createTool(
      "notion_append_paragraph",
      "Quick helper: append a paragraph text block",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        text: z.string().min(1, "Text is required"),
      }),
      async ({ blockId, text }) => {
        try {
          logger.info(`[NOTION] Appending paragraph to: ${blockId}`);
          const service = await this.getNotionService();
          const blocks = [{ paragraph: { rich_text: [{ text: { content: text } }] } }];
          const result = await service.appendBlock(blockId, blocks);

          return {
            success: true,
            data: result.results,
          };
        } catch (error: any) {
          logger.error("[NOTION] Append paragraph failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append paragraph",
          };
        }
      }
    );
  }

  // Append a heading (h1, h2, or h3)
  createAppendHeadingTool() {
    return this.createTool(
      "notion_append_heading",
      "Append a heading (h1, h2, or h3)",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        text: z.string().min(1, "Text is required"),
        level: z.enum(["1", "2", "3"]).default("1").describe("Heading level (1, 2, or 3)"),
      }),
      async ({ blockId, text, level }) => {
        try {
          logger.info(`[NOTION] Appending heading ${level} to: ${blockId}`);
          const service = await this.getNotionService();
          const headingType = `heading_${level}`;
          const blocks = [{ [headingType]: { rich_text: [{ text: { content: text } }] } }];
          const result = await service.appendBlock(blockId, blocks);

          return {
            success: true,
            data: result.results,
          };
        } catch (error: any) {
          logger.error("[NOTION] Append heading failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append heading",
          };
        }
      }
    );
  }

  // Append a to-do checkbox block with checked status
  createAppendTodoTool() {
    return this.createTool(
      "notion_append_todo",
      "Append a to-do checkbox block with checked status",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        text: z.string().min(1, "Text is required"),
        checked: z.boolean().default(false).describe("Whether the todo is checked"),
      }),
      async ({ blockId, text, checked }) => {
        try {
          logger.info(`[NOTION] Appending todo to: ${blockId}`);
          const service = await this.getNotionService();
          const blocks = [{ to_do: { rich_text: [{ text: { content: text } }], checked } }];
          const result = await service.appendBlock(blockId, blocks);

          return {
            success: true,
            data: result.results,
          };
        } catch (error: any) {
          logger.error("[NOTION] Append todo failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append todo",
          };
        }
      }
    );
  }

  // Append a bulleted list item
  createAppendBulletTool() {
    return this.createTool(
      "notion_append_bullet",
      "Append a bulleted list item",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        text: z.string().min(1, "Text is required"),
      }),
      async ({ blockId, text }) => {
        try {
          logger.info(`[NOTION] Appending bullet to: ${blockId}`);
          const service = await this.getNotionService();
          const blocks = [{ bulleted_list_item: { rich_text: [{ text: { content: text } }] } }];
          const result = await service.appendBlock(blockId, blocks);

          return {
            success: true,
            data: result.results,
          };
        } catch (error: any) {
          logger.error("[NOTION] Append bullet failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append bullet",
          };
        }
      }
    );
  }

  // Append a numbered list item
  createAppendNumberedTool() {
    return this.createTool(
      "notion_append_numbered",
      "Append a numbered list item",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        text: z.string().min(1, "Text is required"),
      }),
      async ({ blockId, text }) => {
        try {
          logger.info(`[NOTION] Appending numbered item to: ${blockId}`);
          const service = await this.getNotionService();
          const blocks = [{ numbered_list_item: { rich_text: [{ text: { content: text } }] } }];
          const result = await service.appendBlock(blockId, blocks);

          return {
            success: true,
            data: result.results,
          };
        } catch (error: any) {
          logger.error("[NOTION] Append numbered failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append numbered item",
          };
        }
      }
    );
  }

  // Append a code block with language and content
  createAppendCodeTool() {
    return this.createTool(
      "notion_append_code",
      "Append a code block with language and content",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        code: z.string().min(1, "Code content is required"),
        language: z.string().default("javascript").describe("Programming language"),
      }),
      async ({ blockId, code, language }) => {
        try {
          logger.info(`[NOTION] Appending code block to: ${blockId}`);
          const service = await this.getNotionService();
          const blocks = [{ code: { rich_text: [{ text: { content: code } }], language } }];
          const result = await service.appendBlock(blockId, blocks);

          return {
            success: true,
            data: result.results,
          };
        } catch (error: any) {
          logger.error("[NOTION] Append code failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append code",
          };
        }
      }
    );
  }

  // Append a horizontal divider
  createAppendDividerTool() {
    return this.createTool(
      "notion_append_divider",
      "Append a horizontal divider",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
      }),
      async ({ blockId }) => {
        try {
          logger.info(`[NOTION] Appending divider to: ${blockId}`);
          const service = await this.getNotionService();
          const blocks = [{ divider: {} }];
          const result = await service.appendBlock(blockId, blocks);

          return {
            success: true,
            data: result.results,
          };
        } catch (error: any) {
          logger.error("[NOTION] Append divider failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append divider",
          };
        }
      }
    );
  }

  // Append a callout block with emoji and text
  createAppendCalloutTool() {
    return this.createTool(
      "notion_append_callout",
      "Append a callout block with emoji and text",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        text: z.string().min(1, "Text is required"),
        emoji: z.string().default("💡").describe("Emoji icon for the callout"),
      }),
      async ({ blockId, text, emoji }) => {
        try {
          logger.info(`[NOTION] Appending callout to: ${blockId}`);
          const service = await this.getNotionService();
          const blocks = [{ 
            callout: { 
              rich_text: [{ text: { content: text } }],
              icon: { emoji }
            } 
          }];
          const result = await service.appendBlock(blockId, blocks);

          return {
            success: true,
            data: result.results,
          };
        } catch (error: any) {
          logger.error("[NOTION] Append callout failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append callout",
          };
        }
      }
    );
  }

  // Append a simple table block with rows and columns
  createAppendTableTool() {
    return this.createTool(
      "notion_append_table",
      "Append a simple table block with rows and columns",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        tableWidth: z.number().min(1).describe("Number of columns"),
        rows: z.array(z.array(z.string())).describe("Array of rows, each row is an array of cell values"),
      }),
      async ({ blockId, tableWidth, rows }) => {
        try {
          logger.info(`[NOTION] Appending table to: ${blockId}`);
          const service = await this.getNotionService();
          
          const tableBlock: any = {
            table: {
              table_width: tableWidth,
              has_column_header: true,
              has_row_header: false,
              children: rows.map(row => ({
                table_row: {
                  cells: row.map(cell => [{ text: { content: cell } }])
                }
              }))
            }
          };

          const blocks = [tableBlock];
          const result = await service.appendBlock(blockId, blocks);

          return {
            success: true,
            data: result.results,
          };
        } catch (error: any) {
          logger.error("[NOTION] Append table failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append table",
          };
        }
      }
    );
  }

  // Append an image block from URL
  createAppendImageTool() {
    return this.createTool(
      "notion_append_image",
      "Append an image block from URL",
      z.object({
        blockId: z.string().min(1, "Block ID is required"),
        imageUrl: z.string().url("Must be a valid URL"),
        caption: z.string().optional().describe("Optional caption for the image"),
      }),
      async ({ blockId, imageUrl, caption }) => {
        try {
          logger.info(`[NOTION] Appending image to: ${blockId}`);
          const service = await this.getNotionService();
          
          const imageBlock: any = {
            image: {
              type: "external",
              external: { url: imageUrl }
            }
          };

          if (caption) {
            imageBlock.image.caption = [{ text: { content: caption } }];
          }

          const blocks = [imageBlock];
          const result = await service.appendBlock(blockId, blocks);

          return {
            success: true,
            data: result.results,
          };
        } catch (error: any) {
          logger.error("[NOTION] Append image failed:", error);
          return {
            success: false,
            error: error.message || "Failed to append image",
          };
        }
      }
    );
  }

  // ============================================
  // DATABASES (7 tools)
  // ============================================

  // List all databases the integration has access to
  createListDatabasesTool() {
    return this.createTool(
      "notion_list_databases",
      "List all databases the integration has access to",
      z.object({}),
      async () => {
        try {
          logger.info(`[NOTION] Listing databases`);
          const service = await this.getNotionService();
          const result = await service.listDatabases();

          return {
            success: true,
            data: {
              databases: result.results.map((db: any) => ({
                id: db.id,
                title: db.title?.[0]?.plain_text || "Untitled",
                url: db.url,
              })),
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] List databases failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list databases",
          };
        }
      }
    );
  }

  // Get database schema (all properties and their types)
  createGetDatabaseTool() {
    return this.createTool(
      "notion_get_database",
      "Get database schema (all properties and their types)",
      z.object({
        databaseId: z.string().min(1, "Database ID is required"),
      }),
      async ({ databaseId }) => {
        try {
          logger.info(`[NOTION] Getting database: ${databaseId}`);
          const service = await this.getNotionService();
          const database: any = await service.retrieveDatabase(databaseId);

          return {
            success: true,
            data: {
              id: database.id,
              title: database.title?.[0]?.plain_text || "Untitled",
              properties: database.properties,
              url: database.url,
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Get database failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get database",
          };
        }
      }
    );
  }

  // Query a database with filters, sorts, pagination
  createQueryDatabaseTool() {
    return this.createTool(
      "notion_query_database",
      "Query a database with filters, sorts, pagination",
      z.object({
        databaseId: z.string().min(1, "Database ID is required"),
        filter: z.any().optional().describe("Filter conditions"),
        sorts: z.array(z.any()).optional().describe("Sort conditions"),
        startCursor: z.string().optional().describe("Pagination cursor"),
        pageSize: z.number().min(1).max(100).default(100).describe("Number of results per page"),
      }),
      async ({ databaseId, filter, sorts, startCursor, pageSize }) => {
        try {
          logger.info(`[NOTION] Querying database: ${databaseId}`);
          const service = await this.getNotionService();
          const result = await service.queryDatabase(databaseId, filter, sorts, startCursor, pageSize);

          return {
            success: true,
            data: {
              results: result.results,
              hasMore: result.has_more,
              nextCursor: result.next_cursor,
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Query database failed:", error);
          return {
            success: false,
            error: error.message || "Failed to query database",
          };
        }
      }
    );
  }

  // Create a new database inside a page with defined properties
  createCreateDatabaseTool() {
    return this.createTool(
      "notion_create_database",
      "Create a new database inside a page with defined properties",
      z.object({
        parentPageId: z.string().min(1, "Parent page ID is required"),
        title: z.string().min(1, "Title is required"),
        properties: z.any().describe("Database properties schema"),
      }),
      async ({ parentPageId, title, properties }) => {
        try {
          logger.info(`[NOTION] Creating database: ${title}`);
          const service = await this.getNotionService();
          const database = await service.createDatabase(parentPageId, title, properties);

          return {
            success: true,
            data: {
              databaseId: database.id,
              url: (database as any).url,
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Create database failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create database",
          };
        }
      }
    );
  }

  // Update database title or properties schema
  createUpdateDatabaseTool() {
    return this.createTool(
      "notion_update_database",
      "Update database title or properties schema",
      z.object({
        databaseId: z.string().min(1, "Database ID is required"),
        title: z.string().optional().describe("New title for the database"),
        properties: z.any().optional().describe("Properties to add or update"),
      }),
      async ({ databaseId, title, properties }) => {
        try {
          logger.info(`[NOTION] Updating database: ${databaseId}`);
          const service = await this.getNotionService();
          const database = await service.updateDatabase(databaseId, properties, title);

          return {
            success: true,
            data: database,
          };
        } catch (error: any) {
          logger.error("[NOTION] Update database failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update database",
          };
        }
      }
    );
  }

  // Query with pre-built filter helper
  createFilterDatabaseTool() {
    return this.createTool(
      "notion_filter_database",
      "Query with pre-built filter helper (equals, contains, before, after, checkbox, etc.)",
      z.object({
        databaseId: z.string().min(1, "Database ID is required"),
        propertyName: z.string().min(1, "Property name to filter on"),
        filterType: z.enum(["equals", "contains", "does_not_equal", "does_not_contain", "is_empty", "is_not_empty", "before", "after", "on_or_before", "on_or_after", "checkbox"]).describe("Type of filter"),
        value: z.any().optional().describe("Value to filter by (not needed for is_empty/is_not_empty)"),
      }),
      async ({ databaseId, propertyName, filterType, value }) => {
        try {
          logger.info(`[NOTION] Filtering database: ${databaseId} by ${propertyName} ${filterType}`);
          const service = await this.getNotionService();

          // Build filter based on type
          let filter: any = { property: propertyName };

          switch (filterType) {
            case "equals":
              filter.rich_text = { equals: value };
              break;
            case "contains":
              filter.rich_text = { contains: value };
              break;
            case "does_not_equal":
              filter.rich_text = { does_not_equal: value };
              break;
            case "does_not_contain":
              filter.rich_text = { does_not_contain: value };
              break;
            case "is_empty":
              filter.rich_text = { is_empty: true };
              break;
            case "is_not_empty":
              filter.rich_text = { is_not_empty: true };
              break;
            case "before":
              filter.date = { before: value };
              break;
            case "after":
              filter.date = { after: value };
              break;
            case "on_or_before":
              filter.date = { on_or_before: value };
              break;
            case "on_or_after":
              filter.date = { on_or_after: value };
              break;
            case "checkbox":
              filter.checkbox = { equals: value };
              break;
          }

          const result = await service.queryDatabase(databaseId, filter);

          return {
            success: true,
            data: {
              results: result.results,
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Filter database failed:", error);
          return {
            success: false,
            error: error.message || "Failed to filter database",
          };
        }
      }
    );
  }

  // ============================================
  // USERS (3 tools)
  // ============================================

  // List all users in the workspace
  createListUsersTool() {
    return this.createTool(
      "notion_list_users",
      "List all users in the workspace",
      z.object({}),
      async () => {
        try {
          logger.info(`[NOTION] Listing users`);
          const service = await this.getNotionService();
          const result = await service.listUsers();

          return {
            success: true,
            data: {
              users: result.results.map((user: any) => ({
                id: user.id,
                name: user.name,
                type: user.type,
                avatarUrl: user.avatar_url,
                email: user.person?.email,
              })),
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] List users failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list users",
          };
        }
      }
    );
  }

  // Get a specific user by ID
  createGetUserTool() {
    return this.createTool(
      "notion_get_user",
      "Get a specific user by ID",
      z.object({
        userId: z.string().min(1, "User ID is required"),
      }),
      async ({ userId }) => {
        try {
          logger.info(`[NOTION] Getting user: ${userId}`);
          const service = await this.getNotionService();
          const user = await service.getUser(userId);

          return {
            success: true,
            data: user,
          };
        } catch (error: any) {
          logger.error("[NOTION] Get user failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get user",
          };
        }
      }
    );
  }

  // Get the currently authenticated bot user
  createGetMeTool() {
    return this.createTool(
      "notion_get_me",
      "Get the currently authenticated bot user",
      z.object({}),
      async () => {
        try {
          logger.info(`[NOTION] Getting current bot user`);
          const service = await this.getNotionService();
          const me = await service.getMe();

          return {
            success: true,
            data: me,
          };
        } catch (error: any) {
          logger.error("[NOTION] Get me failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get current user",
          };
        }
      }
    );
  }

  // ============================================
  // SEARCH (1 tool)
  // ============================================

  // Global search across pages and databases with optional filter
  createSearchTool() {
    return this.createTool(
      "notion_search",
      "Global search across pages and databases with optional filter",
      z.object({
        query: z.string().optional().describe("Search query (empty for all)"),
        filter: z.enum(["page", "database"]).optional().describe("Filter by object type"),
        sort: z.object({
          direction: z.enum(["ascending", "descending"]),
          timestamp: z.enum(["last_edited_time"]),
        }).optional().describe("Sort options"),
      }),
      async ({ query, filter, sort }) => {
        try {
          logger.info(`[NOTION] Searching: ${query || "all"}`);
          const service = await this.getNotionService();
          
          const filterParam = filter ? { property: "object", value: filter } : undefined;
          const result = await service.search(query, filterParam, sort);

          return {
            success: true,
            data: {
              results: result.results.map((item: any) => ({
                id: item.id,
                type: item.object,
                title: item.properties?.title?.title?.[0]?.plain_text || 
                       item.properties?.Name?.title?.[0]?.plain_text || 
                       item.title?.[0]?.plain_text || 
                       "Untitled",
                url: item.url,
              })),
            },
          };
        } catch (error: any) {
          logger.error("[NOTION] Search failed:", error);
          return {
            success: false,
            error: error.message || "Failed to search",
          };
        }
      }
    );
  }
}

// ============================================
// FACTORY FUNCTIONS - Individual Tool Exports
// ============================================

// Pages (8 tools)
export const createNotionGetPageTool = (userId: string) => new NotionToolSuite(userId).createGetPageTool();
export const createNotionCreatePageTool = (userId: string) => new NotionToolSuite(userId).createCreatePageTool();
export const createNotionUpdatePageTool = (userId: string) => new NotionToolSuite(userId).createUpdatePageTool();
export const createNotionArchivePageTool = (userId: string) => new NotionToolSuite(userId).createArchivePageTool();
export const createNotionRestorePageTool = (userId: string) => new NotionToolSuite(userId).createRestorePageTool();
export const createNotionDuplicatePageTool = (userId: string) => new NotionToolSuite(userId).createDuplicatePageTool();
export const createNotionGetPageContentTool = (userId: string) => new NotionToolSuite(userId).createGetPageContentTool();
export const createNotionSearchPagesTool = (userId: string) => new NotionToolSuite(userId).createSearchPagesTool();

// Blocks (15 tools)
export const createNotionGetBlocksTool = (userId: string) => new NotionToolSuite(userId).createGetBlocksTool();
export const createNotionAppendBlocksTool = (userId: string) => new NotionToolSuite(userId).createAppendBlocksTool();
export const createNotionUpdateBlockTool = (userId: string) => new NotionToolSuite(userId).createUpdateBlockTool();
export const createNotionDeleteBlockTool = (userId: string) => new NotionToolSuite(userId).createDeleteBlockTool();
export const createNotionGetBlockTool = (userId: string) => new NotionToolSuite(userId).createGetBlockTool();
export const createNotionAppendParagraphTool = (userId: string) => new NotionToolSuite(userId).createAppendParagraphTool();
export const createNotionAppendHeadingTool = (userId: string) => new NotionToolSuite(userId).createAppendHeadingTool();
export const createNotionAppendTodoTool = (userId: string) => new NotionToolSuite(userId).createAppendTodoTool();
export const createNotionAppendBulletTool = (userId: string) => new NotionToolSuite(userId).createAppendBulletTool();
export const createNotionAppendNumberedTool = (userId: string) => new NotionToolSuite(userId).createAppendNumberedTool();
export const createNotionAppendCodeTool = (userId: string) => new NotionToolSuite(userId).createAppendCodeTool();
export const createNotionAppendDividerTool = (userId: string) => new NotionToolSuite(userId).createAppendDividerTool();
export const createNotionAppendCalloutTool = (userId: string) => new NotionToolSuite(userId).createAppendCalloutTool();
export const createNotionAppendTableTool = (userId: string) => new NotionToolSuite(userId).createAppendTableTool();
export const createNotionAppendImageTool = (userId: string) => new NotionToolSuite(userId).createAppendImageTool();

// Databases (7 tools)
export const createNotionListDatabasesTool = (userId: string) => new NotionToolSuite(userId).createListDatabasesTool();
export const createNotionGetDatabaseTool = (userId: string) => new NotionToolSuite(userId).createGetDatabaseTool();
export const createNotionQueryDatabaseTool = (userId: string) => new NotionToolSuite(userId).createQueryDatabaseTool();
export const createNotionCreateDatabaseTool = (userId: string) => new NotionToolSuite(userId).createCreateDatabaseTool();
export const createNotionUpdateDatabaseTool = (userId: string) => new NotionToolSuite(userId).createUpdateDatabaseTool();
export const createNotionFilterDatabaseTool = (userId: string) => new NotionToolSuite(userId).createFilterDatabaseTool();

// Users (3 tools)
export const createNotionListUsersTool = (userId: string) => new NotionToolSuite(userId).createListUsersTool();
export const createNotionGetUserTool = (userId: string) => new NotionToolSuite(userId).createGetUserTool();
export const createNotionGetMeTool = (userId: string) => new NotionToolSuite(userId).createGetMeTool();

// Search (1 tool)
export const createNotionSearchTool = (userId: string) => new NotionToolSuite(userId).createSearchTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createNotionTools = (userId: string) => {
  const suite = new NotionToolSuite(userId);
  return [
    // Pages (8 tools)
    suite.createGetPageTool(),
    suite.createCreatePageTool(),
    suite.createUpdatePageTool(),
    suite.createArchivePageTool(),
    suite.createRestorePageTool(),
    suite.createDuplicatePageTool(),
    suite.createGetPageContentTool(),
    suite.createSearchPagesTool(),

    // Blocks (15 tools)
    suite.createGetBlocksTool(),
    suite.createAppendBlocksTool(),
    suite.createUpdateBlockTool(),
    suite.createDeleteBlockTool(),
    suite.createGetBlockTool(),
    suite.createAppendParagraphTool(),
    suite.createAppendHeadingTool(),
    suite.createAppendTodoTool(),
    suite.createAppendBulletTool(),
    suite.createAppendNumberedTool(),
    suite.createAppendCodeTool(),
    suite.createAppendDividerTool(),
    suite.createAppendCalloutTool(),
    suite.createAppendTableTool(),
    suite.createAppendImageTool(),

    // Databases (7 tools)
    suite.createListDatabasesTool(),
    suite.createGetDatabaseTool(),
    suite.createQueryDatabaseTool(),
    suite.createCreateDatabaseTool(),
    suite.createUpdateDatabaseTool(),
    suite.createFilterDatabaseTool(),

    // Users (3 tools)
    suite.createListUsersTool(),
    suite.createGetUserTool(),
    suite.createGetMeTool(),

    // Search (1 tool)
    suite.createSearchTool(),
  ];
};
