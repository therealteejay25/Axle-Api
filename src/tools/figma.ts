import { z } from "zod";
import { logger } from "../services/logger";
import { BaseFigmaTool } from "./base_figma";

// ============================================
// FIGMA TOOL SUITE
// ============================================

export class FigmaToolSuite extends BaseFigmaTool {
    constructor(userId: string) {
        super(userId);
    }

    // 1. Get Current User Info
    createGetMeTool() {
        return this.createTool(
            "figma_get_me",
            "Get information about the authenticated user.",
            z.object({}),
            async () => {
                logger.info(`[FIGMA] Getting current user info`);
                const result = await this.executeFigmaRequest("/me");
                return {
                    success: true,
                    user: result,
                };
            }
        );
    }

    // 2. Get File
    createGetFileTool() {
        return this.createTool(
            "figma_get_file",
            "Get the JSON of a Figma file. This is a heavy operation for large files.",
            z.object({
                fileKey: z.string().describe("Figma file key (from URL)"),
                version: z.string().optional().describe("Specific version ID"),
                depth: z.number().optional().describe("Depth of the tree traversal"),
                ids: z.string().optional().describe("Comma separated list of node IDs to filter"),
            }),
            async ({ fileKey, version, depth, ids }) => {
                logger.info(`[FIGMA] Getting file ${fileKey}`);
                const params = new URLSearchParams();
                if (version) params.append("version", version);
                if (depth) params.append("depth", depth.toString());
                if (ids) params.append("ids", ids);

                const result = await this.executeFigmaRequest(`/files/${fileKey}?${params.toString()}`);
                return {
                    success: true,
                    file: {
                        name: result.name,
                        lastModified: result.lastModified,
                        thumbnailUrl: result.thumbnailUrl,
                        version: result.version,
                        document: result.document, // Be careful, can be huge
                    },
                };
            }
        );
    }

    // 3. Get File Nodes
    createGetFileNodesTool() {
        return this.createTool(
            "figma_get_file_nodes",
            "Get a specific set of nodes from a file.",
            z.object({
                fileKey: z.string().describe("Figma file key"),
                ids: z.string().describe("Comma separated list of node IDs"),
                version: z.string().optional().describe("Specific version ID"),
                depth: z.number().optional().describe("Depth"),
            }),
            async ({ fileKey, ids, version, depth }) => {
                logger.info(`[FIGMA] Getting nodes ${ids} from ${fileKey}`);
                const params = new URLSearchParams({ ids });
                if (version) params.append("version", version);
                if (depth) params.append("depth", depth.toString());

                const result = await this.executeFigmaRequest(`/files/${fileKey}/nodes?${params.toString()}`);
                return {
                    success: true,
                    nodes: result.nodes,
                    name: result.name,
                    lastModified: result.lastModified,
                };
            }
        );
    }

    // 4. Get Image
    createGetImageTool() {
        return this.createTool(
            "figma_get_image",
            "Render nodes as images.",
            z.object({
                fileKey: z.string().describe("Figma file key"),
                ids: z.string().describe("Comma separated node IDs"),
                scale: z.number().optional().default(1),
                format: z.enum(["jpg", "png", "svg", "pdf"]).optional().default("png"),
                svg_include_id: z.boolean().optional(),
                version: z.string().optional(),
            }),
            async ({ fileKey, ids, scale, format, svg_include_id, version }) => {
                logger.info(`[FIGMA] Getting images for nodes ${ids} in ${fileKey}`);
                const params = new URLSearchParams({ ids, scale: scale.toString(), format });
                if (svg_include_id) params.append("svg_include_id", "true");
                if (version) params.append("version", version);

                const result = await this.executeFigmaRequest(`/images/${fileKey}?${params.toString()}`);
                return {
                    success: true,
                    images: result.images, // Map of node ID to image URL
                    meta: result.meta,
                };
            }
        );
    }

    // 5. Get Image Fills
    createGetImageFillsTool() {
        return this.createTool(
            "figma_get_image_fills",
            "Get image URLs for image fills used in a file.",
            z.object({
                fileKey: z.string().describe("Figma file key"),
            }),
            async ({ fileKey }) => {
                logger.info(`[FIGMA] Getting image fills for ${fileKey}`);
                const result = await this.executeFigmaRequest(`/files/${fileKey}/images`);
                return {
                    success: true,
                    meta: result.meta, // Map of image hash to image URL
                };
            }
        );
    }

    // 6. Get Comments
    createGetCommentsTool() {
        return this.createTool(
            "figma_get_comments",
            "List comments for a file.",
            z.object({
                fileKey: z.string().describe("Figma file key"),
            }),
            async ({ fileKey }) => {
                logger.info(`[FIGMA] Getting comments for ${fileKey}`);
                const result = await this.executeFigmaRequest(`/files/${fileKey}/comments`);
                return {
                    success: true,
                    comments: result.comments,
                };
            }
        );
    }

    // 7. Post Comment
    createPostCommentTool() {
        return this.createTool(
            "figma_post_comment",
            "Post a comment to a file.",
            z.object({
                fileKey: z.string().describe("Figma file key"),
                message: z.string().describe("Comment text"),
                comment_id: z.string().optional().describe("Reply to comment ID"),
                client_meta: z.object({
                    node_id: z.string().optional(),
                    node_offset: z.object({ x: z.number(), y: z.number() }).optional(),
                }).optional().describe("Position of comment"),
            }),
            async ({ fileKey, message, comment_id, client_meta }) => {
                logger.info(`[FIGMA] Posting comment to ${fileKey}`);
                const body: any = { message };
                if (comment_id) body.comment_id = comment_id;
                if (client_meta) body.client_meta = client_meta;

                const result = await this.executeFigmaRequest(`/files/${fileKey}/comments`, {
                    method: "POST",
                    body: JSON.stringify(body),
                });
                return {
                    success: true,
                    comment: result,
                };
            }
        );
    }

    // 8. Delete Comment
    createDeleteCommentTool() {
        return this.createTool(
            "figma_delete_comment",
            "Delete a comment.",
            z.object({
                fileKey: z.string().describe("Figma file key"),
                commentId: z.string().describe("Comment ID"),
            }),
            async ({ fileKey, commentId }) => {
                logger.info(`[FIGMA] Deleting comment ${commentId} in ${fileKey}`);
                await this.executeFigmaRequest(`/files/${fileKey}/comments/${commentId}`, {
                    method: "DELETE",
                });
                return {
                    success: true,
                    message: "Comment deleted",
                };
            }
        );
    }

    // 9. Get Versions
    createGetVersionsTool() {
        return this.createTool(
            "figma_get_versions",
            "Get version history of a file.",
            z.object({
                fileKey: z.string().describe("Figma file key"),
                pageSize: z.number().optional().default(30),
            }),
            async ({ fileKey, pageSize }) => {
                logger.info(`[FIGMA] Getting versions for ${fileKey}`);
                const result = await this.executeFigmaRequest(`/files/${fileKey}/versions?page_size=${pageSize}`);
                return {
                    success: true,
                    versions: result.versions,
                    pagination: result.pagination,
                };
            }
        );
    }

    // 10. Get Team Projects
    createGetTeamProjectsTool() {
        return this.createTool(
            "figma_get_team_projects",
            "List projects in a team.",
            z.object({
                teamId: z.string().describe("Team ID"),
            }),
            async ({ teamId }) => {
                logger.info(`[FIGMA] Getting projects for team ${teamId}`);
                const result = await this.executeFigmaRequest(`/teams/${teamId}/projects`);
                return {
                    success: true,
                    name: result.name,
                    projects: result.projects,
                };
            }
        );
    }

    // 11. Get Project Files
    createGetProjectFilesTool() {
        return this.createTool(
            "figma_get_project_files",
            "List files in a project.",
            z.object({
                projectId: z.string().describe("Project ID"),
            }),
            async ({ projectId }) => {
                logger.info(`[FIGMA] Getting files for project ${projectId}`);
                const result = await this.executeFigmaRequest(`/projects/${projectId}/files`);
                return {
                    success: true,
                    name: result.name,
                    files: result.files,
                };
            }
        );
    }

    // 12. Get Component
    createGetComponentTool() {
        return this.createTool(
            "figma_get_component",
            "Get metadata for a specific component.",
            z.object({
                key: z.string().describe("Component key"),
            }),
            async ({ key }) => {
                logger.info(`[FIGMA] Getting component ${key}`);
                const result = await this.executeFigmaRequest(`/components/${key}`);
                return {
                    success: true,
                    component: result.meta,
                };
            }
        );
    }

    // 13. Get Component Set
    createGetComponentSetTool() {
        return this.createTool(
            "figma_get_component_set",
            "Get metadata for a component set.",
            z.object({
                key: z.string().describe("Component set key"),
            }),
            async ({ key }) => {
                logger.info(`[FIGMA] Getting component set ${key}`);
                const result = await this.executeFigmaRequest(`/component_sets/${key}`);
                return {
                    success: true,
                    componentSet: result.meta,
                };
            }
        );
    }

    // 14. Get Style
    createGetStyleTool() {
        return this.createTool(
            "figma_get_style",
            "Get metadata for a style.",
            z.object({
                key: z.string().describe("Style key"),
            }),
            async ({ key }) => {
                logger.info(`[FIGMA] Getting style ${key}`);
                const result = await this.executeFigmaRequest(`/styles/${key}`);
                return {
                    success: true,
                    style: result.meta,
                };
            }
        );
    }

    // 15. Get File Components
    createGetFileComponentsTool() {
        return this.createTool(
            "figma_get_file_components",
            "List components in a file.",
            z.object({
                fileKey: z.string().describe("File key"),
                pageSize: z.number().optional().default(30),
            }),
            async ({ fileKey, pageSize }) => {
                logger.info(`[FIGMA] Getting components in file ${fileKey}`);
                const result = await this.executeFigmaRequest(`/files/${fileKey}/components?page_size=${pageSize}`);
                return {
                    success: true,
                    components: result.meta?.components,
                };
            }
        );
    }

    // 16. Get File Styles
    createGetFileStylesTool() {
        return this.createTool(
            "figma_get_file_styles",
            "List styles in a file.",
            z.object({
                fileKey: z.string().describe("File key"),
                pageSize: z.number().optional().default(30),
            }),
            async ({ fileKey, pageSize }) => {
                logger.info(`[FIGMA] Getting styles in file ${fileKey}`);
                const result = await this.executeFigmaRequest(`/files/${fileKey}/styles?page_size=${pageSize}`);
                return {
                    success: true,
                    styles: result.meta?.styles,
                };
            }
        );
    }

    // 17. Get Team Components
    createGetTeamComponentsTool() {
        return this.createTool(
            "figma_get_team_components",
            "List components in a team.",
            z.object({
                teamId: z.string().describe("Team ID"),
                pageSize: z.number().optional().default(30),
            }),
            async ({ teamId, pageSize }) => {
                logger.info(`[FIGMA] Getting team components ${teamId}`);
                const result = await this.executeFigmaRequest(`/teams/${teamId}/components?page_size=${pageSize}`);
                return {
                    success: true,
                    components: result.meta?.components,
                    pagination: result.pagination,
                };
            }
        );
    }

    // 18. Get Team Styles
    createGetTeamStylesTool() {
        return this.createTool(
            "figma_get_team_styles",
            "List styles in a team.",
            z.object({
                teamId: z.string().describe("Team ID"),
                pageSize: z.number().optional().default(30),
            }),
            async ({ teamId, pageSize }) => {
                logger.info(`[FIGMA] Getting team styles ${teamId}`);
                const result = await this.executeFigmaRequest(`/teams/${teamId}/styles?page_size=${pageSize}`);
                return {
                    success: true,
                    styles: result.meta?.styles,
                    pagination: result.pagination,
                };
            }
        );
    }

    // 19. Get Team Component Sets
    createGetTeamComponentSetsTool() {
        return this.createTool(
            "figma_get_team_component_sets",
            "List component sets in a team.",
            z.object({
                teamId: z.string().describe("Team ID"),
                pageSize: z.number().optional().default(30),
            }),
            async ({ teamId, pageSize }) => {
                logger.info(`[FIGMA] Getting team component sets ${teamId}`);
                const result = await this.executeFigmaRequest(`/teams/${teamId}/component_sets?page_size=${pageSize}`);
                return {
                    success: true,
                    componentSets: result.meta?.component_sets,
                    pagination: result.pagination,
                };
            }
        );
    }

    // 20. Get User Teams (Note: Figma API doesn't list user's teams directly easily, but we can try /me/teams if supported or infer)
    // NOTE: Figma doesn't have a direct /me/teams endpoint publicly documented easily.
    // Instead, we will simulate this or use a known endpoint if available.
    // Actually, standard OAuth doesn't list all teams. We'll skip this or replace with Dev Resources.
    // Let's implement Dev Resources instead.

    // 20. (Replacement) Get Dev Resources (for file nodes)
    createGetDevResourcesTool() {
        return this.createTool(
            "figma_get_dev_resources",
            "Get dev resources for file nodes.",
            z.object({
                fileKey: z.string().describe("File key"),
                nodeIds: z.string().describe("Node IDs (comma separated)"),
            }),
            async ({ fileKey, nodeIds }) => {
                logger.info(`[FIGMA] Getting dev resources for ${nodeIds} in ${fileKey}`);
                const result = await this.executeFigmaRequest(`/files/${fileKey}/dev_resources?node_ids=${nodeIds}`);
                return {
                    success: true,
                    devResources: result.dev_resources,
                };
            }
        );
    }

    // Bonus 21. Create Dev Resource
    createPostDevResourceTool() {
        return this.createTool(
            "figma_post_dev_resource",
            "Create a dev resource.",
            z.object({
                fileKey: z.string(),
                name: z.string(),
                url: z.string(),
                node_id: z.string(),
            }),
            async ({ fileKey, name, url, node_id }) => {
                logger.info(`[FIGMA] Creating dev resource in ${fileKey}`);
                const result = await this.executeFigmaRequest(`/files/${fileKey}/dev_resources`, {
                    method: "POST",
                    body: JSON.stringify({ name, url, node_id }),
                });
                return {
                    success: true,
                    devResource: result,
                };
            }
        );
    }
}

export const createFigmaTools = (userId: string) => {
    const suite = new FigmaToolSuite(userId);
    return [
        suite.createGetMeTool(),
        suite.createGetFileTool(),
        suite.createGetFileNodesTool(),
        suite.createGetImageTool(),
        suite.createGetImageFillsTool(),
        suite.createGetCommentsTool(),
        suite.createPostCommentTool(),
        suite.createDeleteCommentTool(),
        suite.createGetVersionsTool(),
        suite.createGetTeamProjectsTool(),
        suite.createGetProjectFilesTool(),
        suite.createGetComponentTool(),
        suite.createGetComponentSetTool(),
        suite.createGetStyleTool(),
        suite.createGetFileComponentsTool(),
        suite.createGetFileStylesTool(),
        suite.createGetTeamComponentsTool(),
        suite.createGetTeamStylesTool(),
        suite.createGetTeamComponentSetsTool(),
        suite.createGetDevResourcesTool(),
        suite.createPostDevResourceTool(),
    ];
};
