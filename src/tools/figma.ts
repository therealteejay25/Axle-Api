import { z } from "zod";
import { logger } from "../services/logger";
import { BaseFigmaTool } from "./base_figma";

// ============================================
// FIGMA TOOL SUITE - COMPREHENSIVE (35 tools)
// ============================================

export class FigmaToolSuite extends BaseFigmaTool {
  constructor(userId: string) {
    super(userId);
  }

  // ============================================
  // FILES (8 tools)
  // ============================================

  createGetFileTool() {
    return this.createTool(
      "figma_get_file",
      "Get a Figma file with all document structure",
      z.object({
        fileKey: z.string().min(1, "File key is required"),
        version: z.string().optional().describe("Specific version ID"),
        depth: z.number().optional().describe("Depth of tree traversal"),
        ids: z.string().optional().describe("Comma separated node IDs to filter"),
      }),
      async ({ fileKey, version, depth, ids }) => {
        try {
          logger.info(`[FIGMA] Getting file ${fileKey}`);
          const params = new URLSearchParams();
          if (version) params.append("version", version);
          if (depth) params.append("depth", depth.toString());
          if (ids) params.append("ids", ids);
          const result = await this.executeFigmaRequest(`/files/${fileKey}?${params.toString()}`);
          return { success: true, data: { name: result.name, lastModified: result.lastModified, thumbnailUrl: result.thumbnailUrl, version: result.version, document: result.document } };
        } catch (error: any) {
          logger.error("[FIGMA] Get file failed:", error);
          return { success: false, error: error.message || "Failed to get file" };
        }
      }
    );
  }

  createGetFileNodesTool() {
    return this.createTool("figma_get_file_nodes", "Get specific nodes from a file", z.object({ fileKey: z.string().min(1), ids: z.string().min(1) }), async ({ fileKey, ids }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/nodes?ids=${ids}`);
        return { success: true, data: result.nodes };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get file nodes" };
      }
    });
  }

  createListFilesTool() {
    return this.createTool("figma_list_files", "List files in a project", z.object({ projectId: z.string().min(1) }), async ({ projectId }) => {
      try {
        const result = await this.executeFigmaRequest(`/projects/${projectId}/files`);
        return { success: true, data: { files: result.files.map((f: any) => ({ key: f.key, name: f.name, thumbnailUrl: f.thumbnail_url, lastModified: f.last_modified })) } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to list files" };
      }
    });
  }

  createGetFileVersionsTool() {
    return this.createTool("figma_get_file_versions", "Get version history of a file", z.object({ fileKey: z.string().min(1) }), async ({ fileKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/versions`);
        return { success: true, data: { versions: result.versions } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get file versions" };
      }
    });
  }

  createGetFileComponentsTool() {
    return this.createTool("figma_get_file_components", "Get all components in a file", z.object({ fileKey: z.string().min(1) }), async ({ fileKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/components`);
        return { success: true, data: { components: result.meta.components } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get file components" };
      }
    });
  }

  createGetFileComponentSetsTool() {
    return this.createTool("figma_get_file_component_sets", "Get all component sets in a file", z.object({ fileKey: z.string().min(1) }), async ({ fileKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/component_sets`);
        return { success: true, data: { componentSets: result.meta.component_sets } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get file component sets" };
      }
    });
  }

  createGetFileStylesTool() {
    return this.createTool("figma_get_file_styles", "Get all styles in a file", z.object({ fileKey: z.string().min(1) }), async ({ fileKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/styles`);
        return { success: true, data: { styles: result.meta.styles } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get file styles" };
      }
    });
  }

  createGetThumbnailTool() {
    return this.createTool("figma_get_thumbnail", "Get thumbnail image of a file", z.object({ fileKey: z.string().min(1), scale: z.number().optional(), format: z.enum(["jpg", "png", "svg", "pdf"]).optional() }), async ({ fileKey, scale, format }) => {
      try {
        const params = new URLSearchParams();
        if (scale) params.append("scale", scale.toString());
        if (format) params.append("format", format);
        const result = await this.executeFigmaRequest(`/images/${fileKey}?${params.toString()}`);
        return { success: true, data: { images: result.images } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get thumbnail" };
      }
    });
  }

  // ============================================
  // IMAGES (2 tools)
  // ============================================

  createGetImagesTool() {
    return this.createTool("figma_get_images", "Get image URLs for nodes", z.object({ fileKey: z.string().min(1), ids: z.string().min(1), scale: z.number().optional(), format: z.enum(["jpg", "png", "svg", "pdf"]).optional() }), async ({ fileKey, ids, scale, format }) => {
      try {
        const params = new URLSearchParams({ ids });
        if (scale) params.append("scale", scale.toString());
        if (format) params.append("format", format);
        const result = await this.executeFigmaRequest(`/images/${fileKey}?${params.toString()}`);
        return { success: true, data: { images: result.images } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get images" };
      }
    });
  }

  createGetImageFillsTool() {
    return this.createTool("figma_get_image_fills", "Get image fills from a file", z.object({ fileKey: z.string().min(1) }), async ({ fileKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/images`);
        return { success: true, data: { images: result.meta.images } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get image fills" };
      }
    });
  }

  // ============================================
  // COMMENTS (5 tools)
  // ============================================

  createListCommentsTool() {
    return this.createTool("figma_list_comments", "List comments on a file", z.object({ fileKey: z.string().min(1) }), async ({ fileKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/comments`);
        return { success: true, data: { comments: result.comments } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to list comments" };
      }
    });
  }

  createPostCommentTool() {
    return this.createTool("figma_post_comment", "Post a comment on a file", z.object({ fileKey: z.string().min(1), message: z.string().min(1), clientMeta: z.object({ x: z.number().optional(), y: z.number().optional(), node_id: z.string().optional() }).optional() }), async ({ fileKey, message, clientMeta }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/comments`, { method: "POST", body: JSON.stringify({ message, client_meta: clientMeta }) });
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to post comment" };
      }
    });
  }

  createDeleteCommentTool() {
    return this.createTool("figma_delete_comment", "Delete a comment", z.object({ fileKey: z.string().min(1), commentId: z.string().min(1) }), async ({ fileKey, commentId }) => {
      try {
        await this.executeFigmaRequest(`/files/${fileKey}/comments/${commentId}`, { method: "DELETE" });
        return { success: true, message: "Comment deleted successfully" };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to delete comment" };
      }
    });
  }

  createReplyCommentTool() {
    return this.createTool("figma_reply_comment", "Reply to a comment", z.object({ fileKey: z.string().min(1), commentId: z.string().min(1), message: z.string().min(1) }), async ({ fileKey, commentId, message }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/comments`, { method: "POST", body: JSON.stringify({ message, comment_id: commentId }) });
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to reply to comment" };
      }
    });
  }

  createResolveCommentTool() {
    return this.createTool("figma_resolve_comment", "Resolve a comment thread", z.object({ fileKey: z.string().min(1), commentId: z.string().min(1) }), async ({ fileKey, commentId }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ resolved: true }) });
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to resolve comment" };
      }
    });
  }

  // ============================================
  // PROJECTS & TEAMS (5 tools)
  // ============================================

  createListTeamProjectsTool() {
    return this.createTool("figma_list_team_projects", "List projects in a team", z.object({ teamId: z.string().min(1) }), async ({ teamId }) => {
      try {
        const result = await this.executeFigmaRequest(`/teams/${teamId}/projects`);
        return { success: true, data: { projects: result.projects } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to list team projects" };
      }
    });
  }

  createGetProjectTool() {
    return this.createTool("figma_get_project", "Get project details", z.object({ projectId: z.string().min(1) }), async ({ projectId }) => {
      try {
        const result = await this.executeFigmaRequest(`/projects/${projectId}`);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get project" };
      }
    });
  }

  createListProjectFilesTool() {
    return this.createTool("figma_list_project_files", "List files in a project", z.object({ projectId: z.string().min(1) }), async ({ projectId }) => {
      try {
        const result = await this.executeFigmaRequest(`/projects/${projectId}/files`);
        return { success: true, data: { files: result.files } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to list project files" };
      }
    });
  }

  createGetTeamComponentsTool() {
    return this.createTool("figma_get_team_components", "Get team components", z.object({ teamId: z.string().min(1) }), async ({ teamId }) => {
      try {
        const result = await this.executeFigmaRequest(`/teams/${teamId}/components`);
        return { success: true, data: { components: result.meta.components } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get team components" };
      }
    });
  }

  createGetTeamStylesTool() {
    return this.createTool("figma_get_team_styles", "Get team styles", z.object({ teamId: z.string().min(1) }), async ({ teamId }) => {
      try {
        const result = await this.executeFigmaRequest(`/teams/${teamId}/styles`);
        return { success: true, data: { styles: result.meta.styles } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get team styles" };
      }
    });
  }

  // ============================================
  // COMPONENT LIBRARY (3 tools)
  // ============================================

  createGetComponentTool() {
    return this.createTool("figma_get_component", "Get component details", z.object({ componentKey: z.string().min(1) }), async ({ componentKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/components/${componentKey}`);
        return { success: true, data: result.meta };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get component" };
      }
    });
  }

  createGetComponentSetTool() {
    return this.createTool("figma_get_component_set", "Get component set details", z.object({ componentSetKey: z.string().min(1) }), async ({ componentSetKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/component_sets/${componentSetKey}`);
        return { success: true, data: result.meta };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get component set" };
      }
    });
  }

  createGetStyleTool() {
    return this.createTool("figma_get_style", "Get style details", z.object({ styleKey: z.string().min(1) }), async ({ styleKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/styles/${styleKey}`);
        return { success: true, data: result.meta };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get style" };
      }
    });
  }

  // ============================================
  // VARIABLES (3 tools)
  // ============================================

  createListLocalVariablesTool() {
    return this.createTool("figma_list_local_variables", "List local variables in a file", z.object({ fileKey: z.string().min(1) }), async ({ fileKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/variables/local`);
        return { success: true, data: { variables: result.meta.variables } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to list local variables" };
      }
    });
  }

  createGetVariableTool() {
    return this.createTool("figma_get_variable", "Get variable details", z.object({ fileKey: z.string().min(1), variableId: z.string().min(1) }), async ({ fileKey, variableId }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/variables/${variableId}`);
        return { success: true, data: result.meta };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get variable" };
      }
    });
  }

  createListVariableCollectionsTool() {
    return this.createTool("figma_list_variable_collections", "List variable collections in a file", z.object({ fileKey: z.string().min(1) }), async ({ fileKey }) => {
      try {
        const result = await this.executeFigmaRequest(`/files/${fileKey}/variable_collections`);
        return { success: true, data: { collections: result.meta.variable_collections } };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to list variable collections" };
      }
    });
  }

  // ============================================
  // USERS (1 tool)
  // ============================================

  createGetMeTool() {
    return this.createTool("figma_get_me", "Get current user info", z.object({}), async () => {
      try {
        const result = await this.executeFigmaRequest(`/me`);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get current user" };
      }
    });
  }
}

// ============================================
// FACTORY FUNCTIONS - Individual Tool Exports
// ============================================

// Files (8 tools)
export const createFigmaGetFileTool = (userId: string) => new FigmaToolSuite(userId).createGetFileTool();
export const createFigmaGetFileNodesTool = (userId: string) => new FigmaToolSuite(userId).createGetFileNodesTool();
export const createFigmaListFilesTool = (userId: string) => new FigmaToolSuite(userId).createListFilesTool();
export const createFigmaGetFileVersionsTool = (userId: string) => new FigmaToolSuite(userId).createGetFileVersionsTool();
export const createFigmaGetFileComponentsTool = (userId: string) => new FigmaToolSuite(userId).createGetFileComponentsTool();
export const createFigmaGetFileComponentSetsTool = (userId: string) => new FigmaToolSuite(userId).createGetFileComponentSetsTool();
export const createFigmaGetFileStylesTool = (userId: string) => new FigmaToolSuite(userId).createGetFileStylesTool();
export const createFigmaGetThumbnailTool = (userId: string) => new FigmaToolSuite(userId).createGetThumbnailTool();

// Images (2 tools)
export const createFigmaGetImagesTool = (userId: string) => new FigmaToolSuite(userId).createGetImagesTool();
export const createFigmaGetImageFillsTool = (userId: string) => new FigmaToolSuite(userId).createGetImageFillsTool();

// Comments (5 tools)
export const createFigmaListCommentsTool = (userId: string) => new FigmaToolSuite(userId).createListCommentsTool();
export const createFigmaPostCommentTool = (userId: string) => new FigmaToolSuite(userId).createPostCommentTool();
export const createFigmaDeleteCommentTool = (userId: string) => new FigmaToolSuite(userId).createDeleteCommentTool();
export const createFigmaReplyCommentTool = (userId: string) => new FigmaToolSuite(userId).createReplyCommentTool();
export const createFigmaResolveCommentTool = (userId: string) => new FigmaToolSuite(userId).createResolveCommentTool();

// Projects & Teams (5 tools)
export const createFigmaListTeamProjectsTool = (userId: string) => new FigmaToolSuite(userId).createListTeamProjectsTool();
export const createFigmaGetProjectTool = (userId: string) => new FigmaToolSuite(userId).createGetProjectTool();
export const createFigmaListProjectFilesTool = (userId: string) => new FigmaToolSuite(userId).createListProjectFilesTool();
export const createFigmaGetTeamComponentsTool = (userId: string) => new FigmaToolSuite(userId).createGetTeamComponentsTool();
export const createFigmaGetTeamStylesTool = (userId: string) => new FigmaToolSuite(userId).createGetTeamStylesTool();

// Component Library (3 tools)
export const createFigmaGetComponentTool = (userId: string) => new FigmaToolSuite(userId).createGetComponentTool();
export const createFigmaGetComponentSetTool = (userId: string) => new FigmaToolSuite(userId).createGetComponentSetTool();
export const createFigmaGetStyleTool = (userId: string) => new FigmaToolSuite(userId).createGetStyleTool();

// Variables (3 tools)
export const createFigmaListLocalVariablesTool = (userId: string) => new FigmaToolSuite(userId).createListLocalVariablesTool();
export const createFigmaGetVariableTool = (userId: string) => new FigmaToolSuite(userId).createGetVariableTool();
export const createFigmaListVariableCollectionsTool = (userId: string) => new FigmaToolSuite(userId).createListVariableCollectionsTool();

// Users (1 tool)
export const createFigmaGetMeTool = (userId: string) => new FigmaToolSuite(userId).createGetMeTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createFigmaTools = (userId: string) => {
  const suite = new FigmaToolSuite(userId);
  return [
    suite.createGetFileTool(), suite.createGetFileNodesTool(), suite.createListFilesTool(), suite.createGetFileVersionsTool(),
    suite.createGetFileComponentsTool(), suite.createGetFileComponentSetsTool(), suite.createGetFileStylesTool(), suite.createGetThumbnailTool(),
    suite.createGetImagesTool(), suite.createGetImageFillsTool(),
    suite.createListCommentsTool(), suite.createPostCommentTool(), suite.createDeleteCommentTool(), suite.createReplyCommentTool(), suite.createResolveCommentTool(),
    suite.createListTeamProjectsTool(), suite.createGetProjectTool(), suite.createListProjectFilesTool(), suite.createGetTeamComponentsTool(), suite.createGetTeamStylesTool(),
    suite.createGetComponentTool(), suite.createGetComponentSetTool(), suite.createGetStyleTool(),
    suite.createListLocalVariablesTool(), suite.createGetVariableTool(), suite.createListVariableCollectionsTool(),
    suite.createGetMeTool(),
  ];
};
