import { Client } from "@notionhq/client";
import { Integration } from "../models/Integration";
import { decryptToken } from "./crypto";
import { logger } from "./logger";

export class NotionService {
    private notion: Client;

    constructor(accessToken: string) {
        this.notion = new Client({ auth: accessToken });
    }

    static async fromUserId(userId: string): Promise<NotionService | null> {
        const integration = await Integration.findOne({ userId, provider: "notion" });
        if (!integration || !integration.accessToken) {
            return null;
        }

        try {
            const accessToken = decryptToken(integration.accessToken);
            return new NotionService(accessToken);
        } catch (error) {
            logger.error("Failed to decrypt Notion access token", { userId, error });
            return null;
        }
    }

    async search(query?: string, filter?: any, sort?: any) {
        return this.notion.search({
            query,
            filter,
            sort,
            page_size: 20,
        });
    }

    async getPage(pageId: string) {
        return this.notion.pages.retrieve({ page_id: pageId });
    }

    async getPageContent(blockId: string) {
        return this.notion.blocks.children.list({ block_id: blockId });
    }

    async createPage(parent: { database_id?: string; page_id?: string }, properties: any, children?: any[]) {
        const parentParam = parent.database_id
            ? { database_id: parent.database_id }
            : { page_id: parent.page_id! };

        return this.notion.pages.create({
            parent: parentParam as any,
            properties,
            children,
        });
    }

    async updatePageProperties(pageId: string, properties: any) {
        return this.notion.pages.update({
            page_id: pageId,
            properties,
        });
    }

    async appendBlock(blockId: string, children: any[]) {
        return this.notion.blocks.children.append({
            block_id: blockId,
            children,
        });
    }

    async deleteBlock(blockId: string) {
        return this.notion.blocks.delete({
            block_id: blockId,
        });
    }

    async createDatabase(parentPageId: string, title: string, properties: any) {
        return (this.notion.databases as any).create({
            parent: { type: "page_id", page_id: parentPageId },
            title: [
                {
                    type: "text",
                    text: { content: title },
                },
            ],
            properties,
        });
    }

    async updateDatabase(databaseId: string, properties: any, title?: string) {
        return (this.notion.databases as any).update({
            database_id: databaseId,
            properties,
            ...(title ? {
                title: [
                    {
                        type: "text",
                        text: { content: title },
                    },
                ],
            } : {}),
        });
    }

    async retrieveDatabase(databaseId: string) {
        return this.notion.databases.retrieve({
            database_id: databaseId,
        });
    }

    async listDatabases() {
        // Notion search is the preferred way to find databases
        return this.notion.search({
            filter: { property: "object", value: "database" as any },
        });
    }

    async queryDatabase(databaseId: string, filter?: any, sorts?: any[], startCursor?: string, pageSize: number = 100) {
        return (this.notion.databases as any).query({
            database_id: databaseId,
            filter,
            sorts,
            start_cursor: startCursor,
            page_size: pageSize,
        });
    }

    async addComment(parent: { page_id?: string; discussion_id?: string }, content: string) {
        return this.notion.comments.create({
            parent: parent as any,
            rich_text: [
                {
                    text: {
                        content,
                    },
                },
            ],
        });
    }

    async listUsers() {
        return this.notion.users.list({});
    }

    async getMe() {
        return this.notion.users.me({});
    }

    async getBlock(blockId: string) {
        return this.notion.blocks.retrieve({ block_id: blockId });
    }

    async updateBlock(blockId: string, content: any) {
        return this.notion.blocks.update({
            block_id: blockId,
            ...content,
        } as any);
    }

    async getUser(userId: string) {
        return this.notion.users.retrieve({ user_id: userId });
    }
}
