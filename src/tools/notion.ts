import { z } from "zod";
import { logger } from "../services/logger";
import { BaseNotionTool } from "./base";
import { NotionService } from "../services/notion.service";

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

    // 1. Search tool
    createSearchTool() {
        return this.createTool(
            "notion_search",
            "Search for pages or databases in Notion by title.",
            z.object({
                query: z.string().describe("The text to search for."),
                filter: z.enum(["page", "database"]).optional().describe("Filter results by object type."),
            }),
            async ({ query, filter }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Searching for: ${query}`);

                const filterParam = filter ? { property: "object", value: filter } : undefined;
                const result = await service.search(query, filterParam);

                return {
                    success: true,
                    results: result.results.map((item: any) => ({
                        id: item.id,
                        type: item.object,
                        title: item.properties?.title?.title?.[0]?.plain_text || item.title?.[0]?.plain_text || "Untitled",
                        url: item.url,
                    })),
                };
            }
        );
    }

    // 2. Get Page tool
    createGetPageTool() {
        return this.createTool(
            "notion_get_page",
            "Retrieve the metadata and properties of a specific Notion page.",
            z.object({
                pageId: z.string().describe("The ID of the page to retrieve."),
            }),
            async ({ pageId }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Getting page: ${pageId}`);

                const page = await service.getPage(pageId);
                return {
                    success: true,
                    page,
                };
            }
        );
    }

    // 3. Get Page Content tool
    createGetPageContentTool() {
        return this.createTool(
            "notion_get_page_content",
            "Retrieve the content (blocks) of a Notion page or block.",
            z.object({
                blockId: z.string().describe("The ID of the page or block to get children from."),
            }),
            async ({ blockId }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Getting content for block: ${blockId}`);

                const content = await service.getPageContent(blockId);
                return {
                    success: true,
                    blocks: content.results,
                };
            }
        );
    }

    // 4. Create Page tool
    createCreatePageTool() {
        return this.createTool(
            "notion_create_page",
            "Create a new page in a parent page or database entries.",
            z.object({
                parentId: z.string().describe("The ID of the parent page or database."),
                parentType: z.enum(["page", "database"]).describe("The type of the parent."),
                title: z.string().describe("The title of the new page."),
                properties: z.any().optional().describe("Additional properties for the page (especially if parent is a database)."),
                content: z.array(z.any()).optional().describe("Initial content (blocks) for the page."),
            }),
            async ({ parentId, parentType, title, properties = {}, content }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Creating page in ${parentType}: ${parentId}`);

                const parent = parentType === "page" ? { page_id: parentId } : { database_id: parentId };

                // Ensure title is set in properties
                const finalProperties = { ...properties };
                if (parentType === "page") {
                    finalProperties.title = {
                        title: [{ text: { content: title } }]
                    };
                } else {
                    // Databases might have different title property names, usually "Name" or "title"
                    const titleKey = Object.keys(properties).find(k => properties[k].type === "title") || "Name";
                    finalProperties[titleKey] = {
                        title: [{ text: { content: title } }]
                    };
                }

                const page = await service.createPage(parent, finalProperties, content);
                return {
                    success: true,
                    pageId: page.id,
                    url: (page as any).url,
                };
            }
        );
    }

    // 5. Update Page Properties tool
    createUpdatePagePropertiesTool() {
        return this.createTool(
            "notion_update_page_properties",
            "Update the properties of an existing Notion page.",
            z.object({
                pageId: z.string().describe("The ID of the page to update."),
                properties: z.any().describe("The properties to update (JSON object)."),
            }),
            async ({ pageId, properties }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Updating page properties: ${pageId}`);

                const page = await service.updatePageProperties(pageId, properties);
                return {
                    success: true,
                    page,
                };
            }
        );
    }

    // 6. Append Block tool
    createAppendBlockTool() {
        return this.createTool(
            "notion_append_block",
            "Append new content blocks to a Notion page or block.",
            z.object({
                blockId: z.string().describe("The ID of the page or block to append to."),
                children: z.array(z.any()).describe("List of blocks to append."),
            }),
            async ({ blockId, children }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Appending blocks to: ${blockId}`);

                const result = await service.appendBlock(blockId, children);
                return {
                    success: true,
                    results: result.results,
                };
            }
        );
    }

    // 7. List Databases tool
    createListDatabasesTool() {
        return this.createTool(
            "notion_list_databases",
            "List all databases the integration has access to.",
            z.object({}),
            async () => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Listing databases`);

                const result = await service.listDatabases();
                return {
                    success: true,
                    databases: result.results.map((db: any) => ({
                        id: db.id,
                        title: db.title?.[0]?.plain_text || "Untitled",
                        url: db.url,
                    })),
                };
            }
        );
    }

    // 8. Query Database tool
    createByQueryDatabaseTool() {
        return this.createTool(
            "notion_query_database",
            "Query a Notion database with filters and sorts.",
            z.object({
                databaseId: z.string().describe("The ID of the database to query."),
                filter: z.any().optional().describe("Filter conditions."),
                sorts: z.array(z.any()).optional().describe("Sort conditions."),
            }),
            async ({ databaseId, filter, sorts }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Querying database: ${databaseId}`);

                const result = await service.queryDatabase(databaseId, filter, sorts);
                return {
                    success: true,
                    results: result.results,
                };
            }
        );
    }

    // 9. Add Comment tool
    createAddCommentTool() {
        return this.createTool(
            "notion_add_comment",
            "Add a comment to a Notion page or discussion.",
            z.object({
                pageId: z.string().optional().describe("The ID of the page to comment on."),
                discussionId: z.string().optional().describe("The ID of the discussion thread."),
                content: z.string().describe("The comment content."),
            }),
            async ({ pageId, discussionId, content }) => {
                const service = await this.getNotionService();
                if (!pageId && !discussionId) {
                    throw new Error("Either pageId or discussionId must be provided.");
                }

                logger.info(`[NOTION] Adding comment to ${pageId || discussionId}`);

                const parent = pageId ? { page_id: pageId } : { discussion_id: discussionId };
                const result = await service.addComment(parent, content);

                return {
                    success: true,
                    comment: result,
                };
            }
        );
    }

    // 10. List Users tool
    createListUsersTool() {
        return this.createTool(
            "notion_list_users",
            "List all users in the Notion workspace.",
            z.object({}),
            async () => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Listing users`);

                const result = await service.listUsers();
                return {
                    success: true,
                    users: result.results.map((user: any) => ({
                        id: user.id,
                        name: user.name,
                        type: user.type,
                        avatarUrl: user.avatar_url,
                    })),
                };
            }
        );
    }

    // --- Database Management ---

    // 11. Create Database
    createCreateDatabaseTool() {
        return this.createTool(
            "notion_create_database",
            "Create a new database in a parent page.",
            z.object({
                parentPageId: z.string().describe("The ID of the parent page."),
                title: z.string().describe("The title of the new database."),
                properties: z.any().describe("The properties (schema) of the database."),
            }),
            async ({ parentPageId, title, properties }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Creating database: ${title}`);
                const db = await service.createDatabase(parentPageId, title, properties);
                return { success: true, databaseId: db.id, url: (db as any).url };
            }
        );
    }

    // 12. Delete Row (Block)
    createDeleteRowTool() {
        return this.createTool(
            "notion_delete_row",
            "Delete a row (page) or any block in Notion.",
            z.object({
                blockOrPageId: z.string().describe("The ID of the row/page or block to delete."),
            }),
            async ({ blockOrPageId }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Deleting block: ${blockOrPageId}`);
                await service.deleteBlock(blockOrPageId);
                return { success: true, message: "Deleted successfully" };
            }
        );
    }

    // 13. List Properties
    createListPropertiesTool() {
        return this.createTool(
            "notion_list_properties",
            "Retrieve the schema/properties of a Notion database.",
            z.object({
                databaseId: z.string().describe("The ID of the database."),
            }),
            async ({ databaseId }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Retrieving database schema: ${databaseId}`);
                const db = await service.retrieveDatabase(databaseId) as any;
                return { success: true, properties: db.properties };
            }
        );
    }

    // 14. Add / Update Property
    createUpdateDatabaseSchemaTool() {
        return this.createTool(
            "notion_update_database_schema",
            "Add, update, or rename properties in a Notion database.",
            z.object({
                databaseId: z.string().describe("The ID of the database."),
                properties: z.any().describe("The properties to add or update."),
                title: z.string().optional().describe("Optional new title for the database."),
            }),
            async ({ databaseId, properties, title }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Updating database schema: ${databaseId}`);
                const db = await service.updateDatabase(databaseId, properties, title);
                return { success: true, database: db };
            }
        );
    }

    // --- Task Management ---

    // 15. Create Task
    createCreateTaskTool() {
        return this.createTool(
            "notion_create_task",
            "Create a task in a database with status, assignee, and priority.",
            z.object({
                databaseId: z.string().describe("The ID of the task database."),
                title: z.string().describe("Task title."),
                status: z.string().optional().describe("Task status (e.g., 'To Do')."),
                assigneeId: z.string().optional().describe("User ID to assign."),
                priority: z.string().optional().describe("Priority level."),
                dueDate: z.string().optional().describe("Due date (ISO format)."),
            }),
            async ({ databaseId, title, status, assigneeId, priority, dueDate }) => {
                const service = await this.getNotionService();
                const properties: any = {
                    Name: { title: [{ text: { content: title } }] }
                };
                if (status) properties.Status = { status: { name: status } };
                if (assigneeId) properties.Assignee = { people: [{ id: assigneeId }] };
                if (priority) properties.Priority = { select: { name: priority } };
                if (dueDate) properties["Due Date"] = { date: { start: dueDate } };

                const page = await service.createPage({ database_id: databaseId }, properties);
                return { success: true, taskId: page.id, url: (page as any).url };
            }
        );
    }

    // 16. Update Task Status
    createUpdateTaskStatusTool() {
        return this.createTool(
            "notion_update_task_status",
            "Update the status of a Notion task.",
            z.object({
                taskId: z.string().describe("The ID of the task."),
                status: z.string().describe("The new status (e.g., 'Done', 'In Progress')."),
            }),
            async ({ taskId, status }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Updating task status: ${taskId} -> ${status}`);
                // Try "Status" first, fallback to "status"
                const properties: any = {
                    Status: { status: { name: status } }
                };
                try {
                    await service.updatePageProperties(taskId, properties);
                } catch {
                    await service.updatePageProperties(taskId, {
                        status: { status: { name: status } }
                    });
                }
                return { success: true };
            }
        );
    }

    // 17. Assign Task
    createAssignTaskTool() {
        return this.createTool(
            "notion_assign_task",
            "Assign a task to a user in Notion.",
            z.object({
                taskId: z.string().describe("The ID of the task."),
                userId: z.string().describe("The Notion user ID to assign."),
            }),
            async ({ taskId, userId }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Assigning task: ${taskId} to ${userId}`);
                await service.updatePageProperties(taskId, {
                    Assignee: { people: [{ id: userId }] }
                });
                return { success: true };
            }
        );
    }

    // 18. Set Task Due Date
    createSetTaskDueDateTool() {
        return this.createTool(
            "notion_set_task_due_date",
            "Set or update the due date for a Notion task.",
            z.object({
                taskId: z.string().describe("The ID of the task."),
                dueDate: z.string().describe("The due date (ISO format)."),
            }),
            async ({ taskId, dueDate }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Setting task due date: ${taskId} -> ${dueDate}`);
                await service.updatePageProperties(taskId, {
                    "Due Date": { date: { start: dueDate } }
                });
                return { success: true };
            }
        );
    }

    // 19. Update Task Priority
    createUpdateTaskPriorityTool() {
        return this.createTool(
            "notion_task_priority_update",
            "Update the priority of a Notion task.",
            z.object({
                taskId: z.string().describe("The ID of the task."),
                priority: z.string().describe("The priority level (e.g., 'High', 'Medium', 'Low')."),
            }),
            async ({ taskId, priority }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Updating task priority: ${taskId} -> ${priority}`);
                await service.updatePageProperties(taskId, {
                    Priority: { select: { name: priority } }
                });
                return { success: true };
            }
        );
    }

    // 20. Add Task Comment (Alias for Comment)
    createAddTaskCommentTool() {
        return this.createTool(
            "notion_add_task_comment",
            "Add a note or comment to a specific task.",
            z.object({
                taskId: z.string().describe("The ID of the task."),
                comment: z.string().describe("The comment content."),
            }),
            async ({ taskId, comment }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Adding task comment: ${taskId}`);
                await service.addComment({ page_id: taskId }, comment);
                return { success: true };
            }
        );
    }

    // 21. Get Task Overview
    createGetTaskOverviewTool() {
        return this.createTool(
            "notion_get_task_overview",
            "Get an overview of all tasks in a database (optionally filtered by user).",
            z.object({
                databaseId: z.string().describe("The ID of the task database."),
                userId: z.string().optional().describe("Filter by user ID."),
            }),
            async ({ databaseId, userId }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Getting task overview for database: ${databaseId}`);
                const filter: any = userId ? {
                    property: "Assignee",
                    people: { contains: userId }
                } : undefined;

                const result = await service.queryDatabase(databaseId, filter);
                return {
                    success: true,
                    tasks: result.results.map((t: any) => ({
                        id: t.id,
                        title: t.properties?.Name?.title?.[0]?.plain_text || "Untitled",
                        status: t.properties?.Status?.status?.name || t.properties?.status?.status?.name,
                        assignee: t.properties?.Assignee?.people?.[0]?.name,
                        priority: t.properties?.Priority?.select?.name,
                        dueDate: t.properties?.["Due Date"]?.date?.start,
                    }))
                };
            }
        );
    }

    // 22. Search Tasks
    createSearchTasksTool() {
        return this.createTool(
            "notion_search_tasks",
            "Search for tasks by keyword across the workspace.",
            z.object({
                query: z.string().describe("The keyword to search for."),
            }),
            async ({ query }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Searching tasks for: ${query}`);

                const result = await service.search(query, { property: "object", value: "page" });
                // Filter results to likely tasks (those containing 'task' related properties or in likely databases)
                return {
                    success: true,
                    results: result.results.map((item: any) => ({
                        id: item.id,
                        title: item.properties?.Name?.title?.[0]?.plain_text || item.properties?.title?.title?.[0]?.plain_text || "Untitled",
                        url: item.url,
                    }))
                };
            }
        );
    }

    // 23. Archive Task (Alias for Delete Row)
    createArchiveTaskTool() {
        return this.createTool(
            "notion_archive_task",
            "Archive (remove from active view) a task.",
            z.object({
                taskId: z.string().describe("The ID of the task to archive."),
            }),
            async ({ taskId }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Archiving task: ${taskId}`);
                // In Notion, archiving usually means deleting the block or moving it to an 'Archive' status.
                // We'll use deleteBlock as requested ("remove from active view").
                await service.deleteBlock(taskId);
                return { success: true };
            }
        );
    }

    // --- Meeting & Notes ---

    // 24. Create Meeting Note
    createCreateMeetingNoteTool() {
        return this.createTool(
            "notion_create_meeting_note",
            "Create a structured meeting note page.",
            z.object({
                parentPageId: z.string().describe("The ID of the parent page or database."),
                title: z.string().describe("Meeting title."),
                date: z.string().optional().describe("Meeting date."),
                participants: z.array(z.string()).optional().describe("List of participant names/IDs."),
            }),
            async ({ parentPageId, title, date, participants }) => {
                const service = await this.getNotionService();
                const content: any[] = [
                    { heading_1: { rich_text: [{ text: { content: "Meeting Minutes" } }] } },
                    { heading_2: { rich_text: [{ text: { content: "Attendees" } }] } },
                    { bulleted_list_item: { rich_text: [{ text: { content: participants?.join(", ") || "No attendees listed" } }] } },
                    { heading_2: { rich_text: [{ text: { content: "Agenda" } }] } },
                    { bulleted_list_item: { rich_text: [{ text: { content: "..." } }] } },
                    { heading_2: { rich_text: [{ text: { content: "Action Items" } }] } }
                ];

                const props: any = {
                    title: { title: [{ text: { content: title } }] }
                };
                if (date) props.Date = { date: { start: date } };

                const page = await service.createPage({ page_id: parentPageId }, props, content);
                return { success: true, pageId: page.id, url: (page as any).url };
            }
        );
    }

    // 25. Tag Notes
    createTagNotesTool() {
        return this.createTool(
            "notion_tag_notes",
            "Add tags to a Notion note/page.",
            z.object({
                pageId: z.string().describe("The ID of the page."),
                tags: z.array(z.string()).describe("List of tags to add (Multi-select properties)."),
            }),
            async ({ pageId, tags }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Tagging page: ${pageId} with ${tags.join(", ")}`);
                await service.updatePageProperties(pageId, {
                    Tags: { multi_select: tags.map(t => ({ name: t })) }
                });
                return { success: true };
            }
        );
    }

    // 26. List Notes by Tag
    createListNotesByTagTool() {
        return this.createTool(
            "notion_list_notes_by_tag",
            "Fetch notes/pages filtered by a specific tag.",
            z.object({
                databaseId: z.string().describe("The ID of the database to search in."),
                tag: z.string().describe("The tag to filter by."),
            }),
            async ({ databaseId, tag }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Listing notes by tag: ${tag}`);
                const result = await service.queryDatabase(databaseId, {
                    property: "Tags",
                    multi_select: { contains: tag }
                });
                return {
                    success: true,
                    notes: result.results.map((n: any) => ({
                        id: n.id,
                        title: n.properties?.title?.title?.[0]?.plain_text || n.properties?.Name?.title?.[0]?.plain_text || "Untitled",
                        url: n.url
                    }))
                };
            }
        );
    }

    // 27. Share Note with User
    createShareNoteWithUserTool() {
        return this.createTool(
            "notion_share_note_with_user",
            "Share a note with a user by adding a comment mention.",
            z.object({
                pageId: z.string().describe("The ID of the page."),
                userId: z.string().describe("The Notion user ID to share with."),
            }),
            async ({ pageId, userId }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Sharing note: ${pageId} with user: ${userId}`);
                await service.addComment({ page_id: pageId }, `Shared with user ID: ${userId}`);
                return { success: true, message: "User notified via comment (sharing via API limited)" };
            }
        );
    }

    // 28. Merge Notes
    createMergeNotesTool() {
        return this.createTool(
            "notion_merge_notes",
            "Combine content from multiple pages into one destination page.",
            z.object({
                sourcePageIds: z.array(z.string()).describe("List of page IDs to merge FROM."),
                destinationPageId: z.string().describe("The page ID to merge INTO."),
            }),
            async ({ sourcePageIds, destinationPageId }) => {
                const service = await this.getNotionService();
                logger.info(`[NOTION] Merging ${sourcePageIds.length} pages into ${destinationPageId}`);

                for (const sourceId of sourcePageIds) {
                    const content = await service.getPageContent(sourceId);
                    if (content.results.length > 0) {
                        const blocks = content.results.map((b: any) => {
                            const { id, created_time, created_by, last_edited_time, last_edited_by, has_children, archived, ...rest } = b;
                            return rest;
                        });
                        await service.appendBlock(destinationPageId, blocks);
                    }
                }
                return { success: true };
            }
        );
    }

    // --- AI & Automation ---

    // 29. Summarize Notes
    createSummarizeNotesTool() {
        return this.createTool(
            "notion_summarize_notes",
            "Generate an AI-powered summary of a Notion page's content.",
            z.object({
                pageId: z.string().describe("The ID of the page to summarize."),
            }),
            async ({ pageId }) => {
                const service = await this.getNotionService();
                const content = await service.getPageContent(pageId);
                const text = content.results
                    .map((b: any) => b[b.type]?.rich_text?.[0]?.plain_text || "")
                    .filter(t => t.length > 0)
                    .join("\n");

                return {
                    success: true,
                    originalContent: text,
                    instruction: "The agent should now synthesize this content into a summary for the user."
                };
            }
        );
    }

    // 30. Extract Action Items
    createExtractActionItemsTool() {
        return this.createTool(
            "notion_extract_action_items",
            "Extract tasks and action items from a Notion page.",
            z.object({
                pageId: z.string().describe("The ID of the page."),
            }),
            async ({ pageId }) => {
                const service = await this.getNotionService();
                const content = await service.getPageContent(pageId);
                const items = content.results
                    .map((b: any) => ({ type: b.type, text: b[b.type]?.rich_text?.[0]?.plain_text || "" }))
                    .filter(i => i.text.length > 0);

                return {
                    success: true,
                    content: items,
                    instruction: "The agent should identify action items from this list and suggest creating tasks for them."
                };
            }
        );
    }

    // 31. Generate To-Do from Text
    createGenerateTodoFromTextTool() {
        return this.createTool(
            "notion_generate_todo_from_text",
            "Convert raw text into a list of Notion checkboxes in a page.",
            z.object({
                pageId: z.string().describe("The ID of the destination page."),
                text: z.string().describe("The raw text containing to-do items."),
            }),
            async ({ pageId, text }) => {
                const service = await this.getNotionService();
                const items = text.split("\n").filter(line => line.trim().length > 0);
                const blocks = items.map(item => ({
                    to_do: { rich_text: [{ text: { content: item } }] }
                }));

                await service.appendBlock(pageId, blocks);
                return { success: true, message: `Added ${blocks.length} to-do items.` };
            }
        );
    }

    // 32. Cross Reference Pages
    createCrossReferencePagesTool() {
        return this.createTool(
            "notion_cross_reference_pages",
            "Create bidirectional links between two Notion pages.",
            z.object({
                pageIdA: z.string().describe("The first page ID."),
                pageIdB: z.string().describe("The second page ID."),
            }),
            async ({ pageIdA, pageIdB }) => {
                const service = await this.getNotionService();

                const linkToB = [{ paragraph: { rich_text: [{ text: { content: "Related: " }, mention: { page: { id: pageIdB } } }] } }];
                const linkToA = [{ paragraph: { rich_text: [{ text: { content: "Related: " }, mention: { page: { id: pageIdA } } }] } }];

                await service.appendBlock(pageIdA, linkToB as any);
                await service.appendBlock(pageIdB, linkToA as any);

                return { success: true };
            }
        );
    }

    // 33. Analyze DB Trends
    createAnalyzeDbTrendsTool() {
        return this.createTool(
            "notion_analyze_db_trends",
            "Analyze data in a Notion database to identify trends or summaries.",
            z.object({
                databaseId: z.string().describe("The ID of the database."),
            }),
            async ({ databaseId }) => {
                const service = await this.getNotionService();
                const result = await service.queryDatabase(databaseId);

                const data = result.results.map((r: any) => ({
                    properties: r.properties
                }));

                return {
                    success: true,
                    data,
                    instruction: "The agent should analyze this database export and provide a summary of trends (e.g., most common status, upcoming deadlines)."
                };
            }
        );
    }

    // 34. Automate Reminders
    createAutomateRemindersTool() {
        return this.createTool(
            "notion_automate_reminders",
            "Set up a reminder for a task or page.",
            z.object({
                pageId: z.string().describe("The ID of the page/task."),
                reminderDate: z.string().describe("The date for the reminder (ISO format)."),
            }),
            async ({ pageId, reminderDate }) => {
                const service = await this.getNotionService();
                // Notion reminders are part of the 'Date' property
                await service.updatePageProperties(pageId, {
                    "Reminder": { date: { start: reminderDate } }
                });
                return { success: true };
            }
        );
    }

    // 35. Sync External Docs (Placeholder/Informative)
    createSyncExternalDocsTool() {
        return this.createTool(
            "notion_sync_external_docs",
            "Log a sync operation from external docs (Google/Outlook) to Notion.",
            z.object({
                externalSource: z.string().describe("The source platform (e.g., Google Docs)."),
                pageId: z.string().describe("The destination Notion page ID."),
                contentSnippet: z.string().describe("A snippet of synced content."),
            }),
            async ({ externalSource, pageId, contentSnippet }) => {
                const service = await this.getNotionService();
                await service.appendBlock(pageId, [
                    { callout: { rich_text: [{ text: { content: `Synced from ${externalSource}: ${contentSnippet}` } }] } }
                ]);
                return { success: true };
            }
        );
    }

    // Helper method to get all tools
    getTools() {
        return [
            this.createSearchTool(),
            this.createGetPageTool(),
            this.createGetPageContentTool(),
            this.createCreatePageTool(),
            this.createUpdatePagePropertiesTool(),
            this.createAppendBlockTool(),
            this.createListDatabasesTool(),
            this.createByQueryDatabaseTool(),
            this.createAddCommentTool(),
            this.createListUsersTool(),
            this.createCreateDatabaseTool(),
            this.createDeleteRowTool(),
            this.createListPropertiesTool(),
            this.createUpdateDatabaseSchemaTool(),
            this.createCreateTaskTool(),
            this.createUpdateTaskStatusTool(),
            this.createAssignTaskTool(),
            this.createSetTaskDueDateTool(),
            this.createUpdateTaskPriorityTool(),
            this.createAddTaskCommentTool(),
            this.createGetTaskOverviewTool(),
            this.createSearchTasksTool(),
            this.createArchiveTaskTool(),
            this.createCreateMeetingNoteTool(),
            this.createTagNotesTool(),
            this.createListNotesByTagTool(),
            this.createShareNoteWithUserTool(),
            this.createMergeNotesTool(),
            this.createSummarizeNotesTool(),
            this.createExtractActionItemsTool(),
            this.createGenerateTodoFromTextTool(),
            this.createCrossReferencePagesTool(),
            this.createAnalyzeDbTrendsTool(),
            this.createAutomateRemindersTool(),
            this.createSyncExternalDocsTool(),
        ];
    }
}

export const createNotionSearchTool = (userId: string) => new NotionToolSuite(userId).createSearchTool();
export const createNotionGetPageTool = (userId: string) => new NotionToolSuite(userId).createGetPageTool();
export const createNotionGetPageContentTool = (userId: string) => new NotionToolSuite(userId).createGetPageContentTool();
export const createNotionCreatePageTool = (userId: string) => new NotionToolSuite(userId).createCreatePageTool();
export const createNotionUpdatePagePropertiesTool = (userId: string) => new NotionToolSuite(userId).createUpdatePagePropertiesTool();
export const createNotionAppendBlockTool = (userId: string) => new NotionToolSuite(userId).createAppendBlockTool();
export const createNotionListDatabasesTool = (userId: string) => new NotionToolSuite(userId).createListDatabasesTool();
export const createNotionQueryDatabaseTool = (userId: string) => new NotionToolSuite(userId).createByQueryDatabaseTool();
export const createNotionAddCommentTool = (userId: string) => new NotionToolSuite(userId).createAddCommentTool();
export const createNotionListUsersTool = (userId: string) => new NotionToolSuite(userId).createListUsersTool();

export const createNotionSearchTasksTool = (userId: string) => new NotionToolSuite(userId).createSearchTasksTool();
export const createNotionArchiveTaskTool = (userId: string) => new NotionToolSuite(userId).createArchiveTaskTool();

export const createNotionCreateDatabaseTool = (userId: string) => new NotionToolSuite(userId).createCreateDatabaseTool();
export const createNotionDeleteRowTool = (userId: string) => new NotionToolSuite(userId).createDeleteRowTool();
export const createNotionListPropertiesTool = (userId: string) => new NotionToolSuite(userId).createListPropertiesTool();
export const createNotionUpdateDatabaseSchemaTool = (userId: string) => new NotionToolSuite(userId).createUpdateDatabaseSchemaTool();

export const createNotionCreateTaskTool = (userId: string) => new NotionToolSuite(userId).createCreateTaskTool();
export const createNotionUpdateTaskStatusTool = (userId: string) => new NotionToolSuite(userId).createUpdateTaskStatusTool();
export const createNotionAssignTaskTool = (userId: string) => new NotionToolSuite(userId).createAssignTaskTool();
export const createNotionSetTaskDueDateTool = (userId: string) => new NotionToolSuite(userId).createSetTaskDueDateTool();
export const createNotionUpdateTaskPriorityTool = (userId: string) => new NotionToolSuite(userId).createUpdateTaskPriorityTool();
export const createNotionAddTaskCommentTool = (userId: string) => new NotionToolSuite(userId).createAddTaskCommentTool();
export const createNotionGetTaskOverviewTool = (userId: string) => new NotionToolSuite(userId).createGetTaskOverviewTool();

export const createNotionCreateMeetingNoteTool = (userId: string) => new NotionToolSuite(userId).createCreateMeetingNoteTool();
export const createNotionTagNotesTool = (userId: string) => new NotionToolSuite(userId).createTagNotesTool();
export const createNotionListNotesByTagTool = (userId: string) => new NotionToolSuite(userId).createListNotesByTagTool();
export const createNotionShareNoteWithUserTool = (userId: string) => new NotionToolSuite(userId).createShareNoteWithUserTool();
export const createNotionMergeNotesTool = (userId: string) => new NotionToolSuite(userId).createMergeNotesTool();

export const createNotionSummarizeNotesTool = (userId: string) => new NotionToolSuite(userId).createSummarizeNotesTool();
export const createNotionExtractActionItemsTool = (userId: string) => new NotionToolSuite(userId).createExtractActionItemsTool();
export const createNotionGenerateTodoFromTextTool = (userId: string) => new NotionToolSuite(userId).createGenerateTodoFromTextTool();
export const createNotionCrossReferencePagesTool = (userId: string) => new NotionToolSuite(userId).createCrossReferencePagesTool();
export const createNotionAnalyzeDbTrendsTool = (userId: string) => new NotionToolSuite(userId).createAnalyzeDbTrendsTool();
export const createNotionAutomateRemindersTool = (userId: string) => new NotionToolSuite(userId).createAutomateRemindersTool();
export const createNotionSyncExternalDocsTool = (userId: string) => new NotionToolSuite(userId).createSyncExternalDocsTool();

export const createNotionTools = (userId: string) => new NotionToolSuite(userId).getTools();
