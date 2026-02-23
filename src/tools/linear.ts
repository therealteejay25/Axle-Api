import { z } from "zod";
import { logger } from "../services/logger";
import { BaseLinearTool } from "./base_linear";

// ============================================
// LINEAR TOOL SUITE - COMPREHENSIVE (45 tools)
// ============================================

export class LinearToolSuite extends BaseLinearTool {
  constructor(userId: string) {
    super(userId);
  }

  // ============================================
  // ISSUES (16 tools)
  // ============================================

  // List issues with filters
  createListIssuesTool() {
    return this.createTool(
      "linear_list_issues",
      "List issues with filters (state, assignee, priority, label, project)",
      z.object({
        teamId: z.string().optional().describe("Filter by team ID"),
        stateId: z.string().optional().describe("Filter by state ID"),
        assigneeId: z.string().optional().describe("Filter by assignee user ID"),
        priority: z.number().min(0).max(4).optional().describe("Filter by priority (0-4)"),
        labelId: z.string().optional().describe("Filter by label ID"),
        projectId: z.string().optional().describe("Filter by project ID"),
        first: z.number().min(1).max(250).default(50).describe("Number of results"),
      }),
      async ({ teamId, stateId, assigneeId, priority, labelId, projectId, first }) => {
        try {
          logger.info(`[LINEAR] Listing issues with filters`);
          
          const filters: any = {};
          if (teamId) filters.team = { id: { eq: teamId } };
          if (stateId) filters.state = { id: { eq: stateId } };
          if (assigneeId) filters.assignee = { id: { eq: assigneeId } };
          if (priority !== undefined) filters.priority = { eq: priority };
          if (labelId) filters.labels = { some: { id: { eq: labelId } } };
          if (projectId) filters.project = { id: { eq: projectId } };

          const query = `
            query($filter: IssueFilter, $first: Int) {
              issues(filter: $filter, first: $first) {
                nodes {
                  id
                  identifier
                  title
                  priority
                  state { id name }
                  assignee { id name }
                  team { id name }
                  createdAt
                  updatedAt
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { 
            filter: Object.keys(filters).length > 0 ? filters : undefined, 
            first 
          });

          return {
            success: true,
            data: { issues: result.data.issues.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List issues failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list issues",
          };
        }
      }
    );
  }

  // Get issue by ID with full details
  createGetIssueTool() {
    return this.createTool(
      "linear_get_issue",
      "Get issue by ID with full details",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
      }),
      async ({ issueId }) => {
        try {
          logger.info(`[LINEAR] Getting issue: ${issueId}`);
          
          const query = `
            query($id: String!) {
              issue(id: $id) {
                id
                identifier
                title
                description
                priority
                estimate
                dueDate
                url
                state { id name type }
                assignee { id name email }
                creator { id name }
                team { id name key }
                project { id name }
                cycle { id number }
                labels { nodes { id name color } }
                subscribers { nodes { id name } }
                createdAt
                updatedAt
                archivedAt
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: issueId });

          return {
            success: true,
            data: { issue: result.data.issue },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Get issue failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get issue",
          };
        }
      }
    );
  }

  // Create issue
  createCreateIssueTool() {
    return this.createTool(
      "linear_create_issue",
      "Create issue with title, description, teamId, assigneeId, priority (0-4), labelIds, dueDate",
      z.object({
        teamId: z.string().min(1, "Team ID is required"),
        title: z.string().min(1, "Title is required"),
        description: z.string().optional().describe("Issue description (markdown)"),
        assigneeId: z.string().optional().describe("Assignee user ID"),
        priority: z.number().min(0).max(4).optional().describe("Priority (0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low)"),
        labelIds: z.array(z.string()).optional().describe("Label IDs"),
        dueDate: z.string().optional().describe("Due date (ISO format)"),
        stateId: z.string().optional().describe("State ID"),
        projectId: z.string().optional().describe("Project ID"),
        cycleId: z.string().optional().describe("Cycle ID"),
      }),
      async (input) => {
        try {
          logger.info(`[LINEAR] Creating issue: ${input.title}`);
          
          const query = `
            mutation($input: IssueCreateInput!) {
              issueCreate(input: $input) {
                success
                issue {
                  id
                  identifier
                  title
                  url
                  state { name }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { input });

          return {
            success: true,
            data: { issue: result.data.issueCreate.issue },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Create issue failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create issue",
          };
        }
      }
    );
  }

  // Update issue
  createUpdateIssueTool() {
    return this.createTool(
      "linear_update_issue",
      "Update any field of an issue",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.number().min(0).max(4).optional(),
        stateId: z.string().optional(),
        assigneeId: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
        projectId: z.string().optional(),
        cycleId: z.string().optional(),
        dueDate: z.string().optional(),
      }),
      async ({ issueId, ...input }) => {
        try {
          logger.info(`[LINEAR] Updating issue: ${issueId}`);
          
          const query = `
            mutation($id: String!, $input: IssueUpdateInput!) {
              issueUpdate(id: $id, input: $input) {
                success
                issue {
                  id
                  identifier
                  title
                  state { name }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: issueId, input });

          return {
            success: true,
            data: { issue: result.data.issueUpdate.issue },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Update issue failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update issue",
          };
        }
      }
    );
  }

  // Delete issue
  createDeleteIssueTool() {
    return this.createTool(
      "linear_delete_issue",
      "Delete an issue",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
      }),
      async ({ issueId }) => {
        try {
          logger.info(`[LINEAR] Deleting issue: ${issueId}`);
          
          const query = `
            mutation($id: String!) {
              issueDelete(id: $id) {
                success
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: issueId });

          return {
            success: result.data.issueDelete.success,
            message: "Issue deleted successfully",
          };
        } catch (error: any) {
          logger.error("[LINEAR] Delete issue failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete issue",
          };
        }
      }
    );
  }

  // Archive issue
  createArchiveIssueTool() {
    return this.createTool(
      "linear_archive_issue",
      "Archive an issue",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
      }),
      async ({ issueId }) => {
        try {
          logger.info(`[LINEAR] Archiving issue: ${issueId}`);
          
          const query = `
            mutation($id: String!) {
              issueArchive(id: $id) {
                success
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: issueId });

          return {
            success: result.data.issueArchive.success,
            message: "Issue archived successfully",
          };
        } catch (error: any) {
          logger.error("[LINEAR] Archive issue failed:", error);
          return {
            success: false,
            error: error.message || "Failed to archive issue",
          };
        }
      }
    );
  }

  // Assign issue to a user
  createAssignIssueTool() {
    return this.createTool(
      "linear_assign_issue",
      "Assign an issue to a user",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
        assigneeId: z.string().min(1, "Assignee user ID is required"),
      }),
      async ({ issueId, assigneeId }) => {
        try {
          logger.info(`[LINEAR] Assigning issue ${issueId} to ${assigneeId}`);
          
          const query = `
            mutation($id: String!, $input: IssueUpdateInput!) {
              issueUpdate(id: $id, input: $input) {
                success
                issue {
                  id
                  assignee { id name }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { 
            id: issueId, 
            input: { assigneeId } 
          });

          return {
            success: true,
            data: { issue: result.data.issueUpdate.issue },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Assign issue failed:", error);
          return {
            success: false,
            error: error.message || "Failed to assign issue",
          };
        }
      }
    );
  }

  // Change issue state
  createChangeStateTool() {
    return this.createTool(
      "linear_change_state",
      "Move issue to a different state (Todo, In Progress, Done, etc.)",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
        stateId: z.string().min(1, "State ID is required"),
      }),
      async ({ issueId, stateId }) => {
        try {
          logger.info(`[LINEAR] Changing state for issue ${issueId}`);
          
          const query = `
            mutation($id: String!, $input: IssueUpdateInput!) {
              issueUpdate(id: $id, input: $input) {
                success
                issue {
                  id
                  state { id name type }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { 
            id: issueId, 
            input: { stateId } 
          });

          return {
            success: true,
            data: { issue: result.data.issueUpdate.issue },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Change state failed:", error);
          return {
            success: false,
            error: error.message || "Failed to change state",
          };
        }
      }
    );
  }

  // Set issue priority
  createSetPriorityTool() {
    return this.createTool(
      "linear_set_priority",
      "Set issue priority (0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low)",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
        priority: z.number().min(0).max(4).describe("Priority level"),
      }),
      async ({ issueId, priority }) => {
        try {
          logger.info(`[LINEAR] Setting priority for issue ${issueId} to ${priority}`);
          
          const query = `
            mutation($id: String!, $input: IssueUpdateInput!) {
              issueUpdate(id: $id, input: $input) {
                success
                issue {
                  id
                  priority
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { 
            id: issueId, 
            input: { priority } 
          });

          return {
            success: true,
            data: { issue: result.data.issueUpdate.issue },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Set priority failed:", error);
          return {
            success: false,
            error: error.message || "Failed to set priority",
          };
        }
      }
    );
  }

  // Add label to issue
  createAddLabelTool() {
    return this.createTool(
      "linear_add_label",
      "Add a label to an issue",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
        labelId: z.string().min(1, "Label ID is required"),
      }),
      async ({ issueId, labelId }) => {
        try {
          logger.info(`[LINEAR] Adding label ${labelId} to issue ${issueId}`);
          
          // First get current labels
          const getQuery = `
            query($id: String!) {
              issue(id: $id) {
                labels { nodes { id } }
              }
            }
          `;
          
          const issueData = await this.executeLinearRequest(getQuery, { id: issueId });
          const currentLabelIds = issueData.data.issue.labels.nodes.map((l: any) => l.id);
          
          // Add new label if not already present
          if (!currentLabelIds.includes(labelId)) {
            currentLabelIds.push(labelId);
          }

          const updateQuery = `
            mutation($id: String!, $input: IssueUpdateInput!) {
              issueUpdate(id: $id, input: $input) {
                success
                issue {
                  id
                  labels { nodes { id name color } }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(updateQuery, { 
            id: issueId, 
            input: { labelIds: currentLabelIds } 
          });

          return {
            success: true,
            data: { issue: result.data.issueUpdate.issue },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Add label failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add label",
          };
        }
      }
    );
  }

  // Remove label from issue
  createRemoveLabelTool() {
    return this.createTool(
      "linear_remove_label",
      "Remove a label from an issue",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
        labelId: z.string().min(1, "Label ID is required"),
      }),
      async ({ issueId, labelId }) => {
        try {
          logger.info(`[LINEAR] Removing label ${labelId} from issue ${issueId}`);
          
          // First get current labels
          const getQuery = `
            query($id: String!) {
              issue(id: $id) {
                labels { nodes { id } }
              }
            }
          `;
          
          const issueData = await this.executeLinearRequest(getQuery, { id: issueId });
          const currentLabelIds = issueData.data.issue.labels.nodes
            .map((l: any) => l.id)
            .filter((id: string) => id !== labelId);

          const updateQuery = `
            mutation($id: String!, $input: IssueUpdateInput!) {
              issueUpdate(id: $id, input: $input) {
                success
                issue {
                  id
                  labels { nodes { id name color } }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(updateQuery, { 
            id: issueId, 
            input: { labelIds: currentLabelIds } 
          });

          return {
            success: true,
            data: { issue: result.data.issueUpdate.issue },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Remove label failed:", error);
          return {
            success: false,
            error: error.message || "Failed to remove label",
          };
        }
      }
    );
  }

  // Set or update due date
  createSetDueDateTool() {
    return this.createTool(
      "linear_set_due_date",
      "Set or update the due date",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
        dueDate: z.string().describe("Due date (ISO format, e.g., 2024-12-31)"),
      }),
      async ({ issueId, dueDate }) => {
        try {
          logger.info(`[LINEAR] Setting due date for issue ${issueId}`);
          
          const query = `
            mutation($id: String!, $input: IssueUpdateInput!) {
              issueUpdate(id: $id, input: $input) {
                success
                issue {
                  id
                  dueDate
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { 
            id: issueId, 
            input: { dueDate } 
          });

          return {
            success: true,
            data: { issue: result.data.issueUpdate.issue },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Set due date failed:", error);
          return {
            success: false,
            error: error.message || "Failed to set due date",
          };
        }
      }
    );
  }

  // Subscribe to issue notifications
  createSubscribeIssueTool() {
    return this.createTool(
      "linear_subscribe_issue",
      "Subscribe to issue notifications",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
      }),
      async ({ issueId }) => {
        try {
          logger.info(`[LINEAR] Subscribing to issue ${issueId}`);
          
          const query = `
            mutation($id: String!) {
              issueSubscribe(id: $id) {
                success
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: issueId });

          return {
            success: result.data.issueSubscribe.success,
            message: "Subscribed to issue successfully",
          };
        } catch (error: any) {
          logger.error("[LINEAR] Subscribe issue failed:", error);
          return {
            success: false,
            error: error.message || "Failed to subscribe to issue",
          };
        }
      }
    );
  }

  // List issues assigned to the authenticated user
  createListMyIssuesTool() {
    return this.createTool(
      "linear_list_my_issues",
      "List issues assigned to the authenticated user",
      z.object({
        first: z.number().min(1).max(250).default(50).describe("Number of results"),
      }),
      async ({ first }) => {
        try {
          logger.info(`[LINEAR] Listing my issues`);
          
          const query = `
            query($first: Int) {
              viewer {
                assignedIssues(first: $first) {
                  nodes {
                    id
                    identifier
                    title
                    priority
                    dueDate
                    state { id name type }
                    team { id name }
                    createdAt
                    updatedAt
                  }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { first });

          return {
            success: true,
            data: { issues: result.data.viewer.assignedIssues.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List my issues failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list my issues",
          };
        }
      }
    );
  }

  // Search issues by title or description
  createSearchIssuesTool() {
    return this.createTool(
      "linear_search_issues",
      "Search issues by title or description",
      z.object({
        query: z.string().min(1, "Search query is required"),
        first: z.number().min(1).max(250).default(20).describe("Number of results"),
      }),
      async ({ query, first }) => {
        try {
          logger.info(`[LINEAR] Searching issues: ${query}`);
          
          const graphqlQuery = `
            query($term: String!, $first: Int) {
              issueSearch(query: $term, first: $first) {
                nodes {
                  id
                  identifier
                  title
                  priority
                  state { id name }
                  assignee { id name }
                  team { id name }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(graphqlQuery, { term: query, first });

          return {
            success: true,
            data: { issues: result.data.issueSearch.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Search issues failed:", error);
          return {
            success: false,
            error: error.message || "Failed to search issues",
          };
        }
      }
    );
  }

  // ============================================
  // COMMENTS (4 tools)
  // ============================================

  // List comments on an issue
  createListCommentsTool() {
    return this.createTool(
      "linear_list_comments",
      "List comments on an issue",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
        first: z.number().min(1).max(250).default(50).describe("Number of results"),
      }),
      async ({ issueId, first }) => {
        try {
          logger.info(`[LINEAR] Listing comments for issue ${issueId}`);
          
          const query = `
            query($id: String!, $first: Int) {
              issue(id: $id) {
                comments(first: $first) {
                  nodes {
                    id
                    body
                    createdAt
                    updatedAt
                    user { id name }
                  }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: issueId, first });

          return {
            success: true,
            data: { comments: result.data.issue.comments.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List comments failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list comments",
          };
        }
      }
    );
  }

  // Add a comment to an issue
  createCreateCommentTool() {
    return this.createTool(
      "linear_create_comment",
      "Add a comment to an issue",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
        body: z.string().min(1, "Comment body is required"),
      }),
      async ({ issueId, body }) => {
        try {
          logger.info(`[LINEAR] Creating comment on issue ${issueId}`);
          
          const query = `
            mutation($input: CommentCreateInput!) {
              commentCreate(input: $input) {
                success
                comment {
                  id
                  body
                  createdAt
                  user { id name }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { input: { issueId, body } });

          return {
            success: true,
            data: { comment: result.data.commentCreate.comment },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Create comment failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create comment",
          };
        }
      }
    );
  }

  // Edit own comment
  createUpdateCommentTool() {
    return this.createTool(
      "linear_update_comment",
      "Edit own comment",
      z.object({
        commentId: z.string().min(1, "Comment ID is required"),
        body: z.string().min(1, "Comment body is required"),
      }),
      async ({ commentId, body }) => {
        try {
          logger.info(`[LINEAR] Updating comment ${commentId}`);
          
          const query = `
            mutation($id: String!, $input: CommentUpdateInput!) {
              commentUpdate(id: $id, input: $input) {
                success
                comment {
                  id
                  body
                  updatedAt
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: commentId, input: { body } });

          return {
            success: true,
            data: { comment: result.data.commentUpdate.comment },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Update comment failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update comment",
          };
        }
      }
    );
  }

  // Delete a comment
  createDeleteCommentTool() {
    return this.createTool(
      "linear_delete_comment",
      "Delete a comment",
      z.object({
        commentId: z.string().min(1, "Comment ID is required"),
      }),
      async ({ commentId }) => {
        try {
          logger.info(`[LINEAR] Deleting comment ${commentId}`);
          
          const query = `
            mutation($id: String!) {
              commentDelete(id: $id) {
                success
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: commentId });

          return {
            success: result.data.commentDelete.success,
            message: "Comment deleted successfully",
          };
        } catch (error: any) {
          logger.error("[LINEAR] Delete comment failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete comment",
          };
        }
      }
    );
  }

  // ============================================
  // PROJECTS (6 tools)
  // ============================================

  // List all projects
  createListProjectsTool() {
    return this.createTool(
      "linear_list_projects",
      "List all projects",
      z.object({
        first: z.number().min(1).max(250).default(50).describe("Number of results"),
      }),
      async ({ first }) => {
        try {
          logger.info(`[LINEAR] Listing projects`);
          
          const query = `
            query($first: Int) {
              projects(first: $first) {
                nodes {
                  id
                  name
                  description
                  state
                  progress
                  startDate
                  targetDate
                  createdAt
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { first });

          return {
            success: true,
            data: { projects: result.data.projects.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List projects failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list projects",
          };
        }
      }
    );
  }

  // Get project details and progress
  createGetProjectTool() {
    return this.createTool(
      "linear_get_project",
      "Get project details and progress",
      z.object({
        projectId: z.string().min(1, "Project ID is required"),
      }),
      async ({ projectId }) => {
        try {
          logger.info(`[LINEAR] Getting project ${projectId}`);
          
          const query = `
            query($id: String!) {
              project(id: $id) {
                id
                name
                description
                state
                progress
                startDate
                targetDate
                lead { id name }
                teams { nodes { id name } }
                createdAt
                updatedAt
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: projectId });

          return {
            success: true,
            data: { project: result.data.project },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Get project failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get project",
          };
        }
      }
    );
  }

  // Create a project
  createCreateProjectTool() {
    return this.createTool(
      "linear_create_project",
      "Create a project with name, description, teamIds, targetDate",
      z.object({
        name: z.string().min(1, "Name is required"),
        description: z.string().optional().describe("Project description"),
        teamIds: z.array(z.string()).min(1, "At least one team ID is required"),
        targetDate: z.string().optional().describe("Target date (ISO format)"),
        leadId: z.string().optional().describe("Project lead user ID"),
        state: z.enum(["planned", "started", "paused", "completed", "canceled"]).optional(),
      }),
      async (input) => {
        try {
          logger.info(`[LINEAR] Creating project: ${input.name}`);
          
          const query = `
            mutation($input: ProjectCreateInput!) {
              projectCreate(input: $input) {
                success
                project {
                  id
                  name
                  url
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { input });

          return {
            success: true,
            data: { project: result.data.projectCreate.project },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Create project failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create project",
          };
        }
      }
    );
  }

  // Update project details
  createUpdateProjectTool() {
    return this.createTool(
      "linear_update_project",
      "Update project details",
      z.object({
        projectId: z.string().min(1, "Project ID is required"),
        name: z.string().optional(),
        description: z.string().optional(),
        state: z.enum(["planned", "started", "paused", "completed", "canceled"]).optional(),
        targetDate: z.string().optional(),
        leadId: z.string().optional(),
      }),
      async ({ projectId, ...input }) => {
        try {
          logger.info(`[LINEAR] Updating project ${projectId}`);
          
          const query = `
            mutation($id: String!, $input: ProjectUpdateInput!) {
              projectUpdate(id: $id, input: $input) {
                success
                project {
                  id
                  name
                  state
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: projectId, input });

          return {
            success: true,
            data: { project: result.data.projectUpdate.project },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Update project failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update project",
          };
        }
      }
    );
  }

  // Archive a project
  createArchiveProjectTool() {
    return this.createTool(
      "linear_archive_project",
      "Archive a project",
      z.object({
        projectId: z.string().min(1, "Project ID is required"),
      }),
      async ({ projectId }) => {
        try {
          logger.info(`[LINEAR] Archiving project ${projectId}`);
          
          const query = `
            mutation($id: String!) {
              projectArchive(id: $id) {
                success
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: projectId });

          return {
            success: result.data.projectArchive.success,
            message: "Project archived successfully",
          };
        } catch (error: any) {
          logger.error("[LINEAR] Archive project failed:", error);
          return {
            success: false,
            error: error.message || "Failed to archive project",
          };
        }
      }
    );
  }

  // List issues belonging to a project
  createListProjectIssuesTool() {
    return this.createTool(
      "linear_list_project_issues",
      "List issues belonging to a project",
      z.object({
        projectId: z.string().min(1, "Project ID is required"),
        first: z.number().min(1).max(250).default(50).describe("Number of results"),
      }),
      async ({ projectId, first }) => {
        try {
          logger.info(`[LINEAR] Listing issues for project ${projectId}`);
          
          const query = `
            query($id: String!, $first: Int) {
              project(id: $id) {
                issues(first: $first) {
                  nodes {
                    id
                    identifier
                    title
                    priority
                    state { id name }
                    assignee { id name }
                  }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: projectId, first });

          return {
            success: true,
            data: { issues: result.data.project.issues.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List project issues failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list project issues",
          };
        }
      }
    );
  }

  // ============================================
  // TEAMS (6 tools)
  // ============================================

  // List all teams in the workspace
  createListTeamsTool() {
    return this.createTool(
      "linear_list_teams",
      "List all teams in the workspace",
      z.object({
        first: z.number().min(1).max(250).default(50).describe("Number of results"),
      }),
      async ({ first }) => {
        try {
          logger.info(`[LINEAR] Listing teams`);
          
          const query = `
            query($first: Int) {
              teams(first: $first) {
                nodes {
                  id
                  name
                  key
                  description
                  createdAt
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { first });

          return {
            success: true,
            data: { teams: result.data.teams.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List teams failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list teams",
          };
        }
      }
    );
  }

  // Get team details
  createGetTeamTool() {
    return this.createTool(
      "linear_get_team",
      "Get team details",
      z.object({
        teamId: z.string().min(1, "Team ID is required"),
      }),
      async ({ teamId }) => {
        try {
          logger.info(`[LINEAR] Getting team ${teamId}`);
          
          const query = `
            query($id: String!) {
              team(id: $id) {
                id
                name
                key
                description
                createdAt
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: teamId });

          return {
            success: true,
            data: { team: result.data.team },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Get team failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get team",
          };
        }
      }
    );
  }

  // List members of a team
  createListTeamMembersTool() {
    return this.createTool(
      "linear_list_team_members",
      "List members of a team",
      z.object({
        teamId: z.string().min(1, "Team ID is required"),
        first: z.number().min(1).max(250).default(50).describe("Number of results"),
      }),
      async ({ teamId, first }) => {
        try {
          logger.info(`[LINEAR] Listing members for team ${teamId}`);
          
          const query = `
            query($id: String!, $first: Int) {
              team(id: $id) {
                members(first: $first) {
                  nodes {
                    id
                    name
                    displayName
                    email
                    active
                  }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: teamId, first });

          return {
            success: true,
            data: { members: result.data.team.members.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List team members failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list team members",
          };
        }
      }
    );
  }

  // List workflow states for a team
  createListTeamStatesTool() {
    return this.createTool(
      "linear_list_team_states",
      "List workflow states (Todo, In Progress, etc.) for a team",
      z.object({
        teamId: z.string().min(1, "Team ID is required"),
      }),
      async ({ teamId }) => {
        try {
          logger.info(`[LINEAR] Listing states for team ${teamId}`);
          
          const query = `
            query($id: String!) {
              team(id: $id) {
                states {
                  nodes {
                    id
                    name
                    type
                    color
                    description
                  }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: teamId });

          return {
            success: true,
            data: { states: result.data.team.states.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List team states failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list team states",
          };
        }
      }
    );
  }

  // List all labels for a team
  createListTeamLabelsTool() {
    return this.createTool(
      "linear_list_team_labels",
      "List all labels for a team",
      z.object({
        teamId: z.string().min(1, "Team ID is required"),
        first: z.number().min(1).max(250).default(50).describe("Number of results"),
      }),
      async ({ teamId, first }) => {
        try {
          logger.info(`[LINEAR] Listing labels for team ${teamId}`);
          
          const query = `
            query($id: String!, $first: Int) {
              team(id: $id) {
                labels(first: $first) {
                  nodes {
                    id
                    name
                    color
                    description
                  }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: teamId, first });

          return {
            success: true,
            data: { labels: result.data.team.labels.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List team labels failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list team labels",
          };
        }
      }
    );
  }

  // Create a new label for a team
  createCreateLabelTool() {
    return this.createTool(
      "linear_create_label",
      "Create a new label for a team",
      z.object({
        teamId: z.string().min(1, "Team ID is required"),
        name: z.string().min(1, "Label name is required"),
        color: z.string().optional().describe("Label color (hex)"),
        description: z.string().optional().describe("Label description"),
      }),
      async (input) => {
        try {
          logger.info(`[LINEAR] Creating label: ${input.name}`);
          
          const query = `
            mutation($input: IssueLabelCreateInput!) {
              issueLabelCreate(input: $input) {
                success
                issueLabel {
                  id
                  name
                  color
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { input });

          return {
            success: true,
            data: { label: result.data.issueLabelCreate.issueLabel },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Create label failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create label",
          };
        }
      }
    );
  }

  // ============================================
  // CYCLES (5 tools)
  // ============================================

  // List cycles for a team
  createListCyclesTool() {
    return this.createTool(
      "linear_list_cycles",
      "List cycles for a team",
      z.object({
        teamId: z.string().optional().describe("Filter by team ID"),
        first: z.number().min(1).max(250).default(20).describe("Number of results"),
      }),
      async ({ teamId, first }) => {
        try {
          logger.info(`[LINEAR] Listing cycles`);
          
          const filter = teamId ? { team: { id: { eq: teamId } } } : undefined;
          
          const query = `
            query($filter: CycleFilter, $first: Int) {
              cycles(filter: $filter, first: $first) {
                nodes {
                  id
                  number
                  name
                  startsAt
                  endsAt
                  progress
                  team { id name }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { filter, first });

          return {
            success: true,
            data: { cycles: result.data.cycles.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List cycles failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list cycles",
          };
        }
      }
    );
  }

  // Get cycle details
  createGetCycleTool() {
    return this.createTool(
      "linear_get_cycle",
      "Get cycle details",
      z.object({
        cycleId: z.string().min(1, "Cycle ID is required"),
      }),
      async ({ cycleId }) => {
        try {
          logger.info(`[LINEAR] Getting cycle ${cycleId}`);
          
          const query = `
            query($id: String!) {
              cycle(id: $id) {
                id
                number
                name
                description
                startsAt
                endsAt
                progress
                completedAt
                team { id name }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: cycleId });

          return {
            success: true,
            data: { cycle: result.data.cycle },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Get cycle failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get cycle",
          };
        }
      }
    );
  }

  // Get the currently active cycle for a team
  createGetActiveCycleTool() {
    return this.createTool(
      "linear_get_active_cycle",
      "Get the currently active cycle for a team",
      z.object({
        teamId: z.string().min(1, "Team ID is required"),
      }),
      async ({ teamId }) => {
        try {
          logger.info(`[LINEAR] Getting active cycle for team ${teamId}`);
          
          const query = `
            query($id: String!) {
              team(id: $id) {
                activeCycle {
                  id
                  number
                  name
                  startsAt
                  endsAt
                  progress
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: teamId });

          return {
            success: true,
            data: { cycle: result.data.team.activeCycle },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Get active cycle failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get active cycle",
          };
        }
      }
    );
  }

  // List issues in a cycle
  createListCycleIssuesTool() {
    return this.createTool(
      "linear_list_cycle_issues",
      "List issues in a cycle",
      z.object({
        cycleId: z.string().min(1, "Cycle ID is required"),
        first: z.number().min(1).max(250).default(50).describe("Number of results"),
      }),
      async ({ cycleId, first }) => {
        try {
          logger.info(`[LINEAR] Listing issues for cycle ${cycleId}`);
          
          const query = `
            query($id: String!, $first: Int) {
              cycle(id: $id) {
                issues(first: $first) {
                  nodes {
                    id
                    identifier
                    title
                    priority
                    state { id name }
                    assignee { id name }
                  }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: cycleId, first });

          return {
            success: true,
            data: { issues: result.data.cycle.issues.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List cycle issues failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list cycle issues",
          };
        }
      }
    );
  }

  // Add an issue to a cycle
  createAddToCycleTool() {
    return this.createTool(
      "linear_add_to_cycle",
      "Add an issue to a cycle",
      z.object({
        issueId: z.string().min(1, "Issue ID is required"),
        cycleId: z.string().min(1, "Cycle ID is required"),
      }),
      async ({ issueId, cycleId }) => {
        try {
          logger.info(`[LINEAR] Adding issue ${issueId} to cycle ${cycleId}`);
          
          const query = `
            mutation($id: String!, $input: IssueUpdateInput!) {
              issueUpdate(id: $id, input: $input) {
                success
                issue {
                  id
                  cycle { id number }
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { 
            id: issueId, 
            input: { cycleId } 
          });

          return {
            success: true,
            data: { issue: result.data.issueUpdate.issue },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Add to cycle failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add issue to cycle",
          };
        }
      }
    );
  }

  // ============================================
  // USERS & ORGANIZATION (3 tools)
  // ============================================

  // Get the authenticated user
  createGetMeTool() {
    return this.createTool(
      "linear_get_me",
      "Get the authenticated user",
      z.object({}),
      async () => {
        try {
          logger.info(`[LINEAR] Getting authenticated user`);
          
          const query = `
            query {
              viewer {
                id
                name
                displayName
                email
                avatarUrl
                admin
                active
                createdAt
              }
            }
          `;

          const result = await this.executeLinearRequest(query);

          return {
            success: true,
            data: { user: result.data.viewer },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Get me failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get authenticated user",
          };
        }
      }
    );
  }

  // List all users in the organization
  createListUsersTool() {
    return this.createTool(
      "linear_list_users",
      "List all users in the organization",
      z.object({
        first: z.number().min(1).max(250).default(50).describe("Number of results"),
      }),
      async ({ first }) => {
        try {
          logger.info(`[LINEAR] Listing users`);
          
          const query = `
            query($first: Int) {
              users(first: $first) {
                nodes {
                  id
                  name
                  displayName
                  email
                  avatarUrl
                  active
                  admin
                }
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { first });

          return {
            success: true,
            data: { users: result.data.users.nodes },
          };
        } catch (error: any) {
          logger.error("[LINEAR] List users failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list users",
          };
        }
      }
    );
  }

  // Get a user by ID
  createGetUserTool() {
    return this.createTool(
      "linear_get_user",
      "Get a user by ID",
      z.object({
        userId: z.string().min(1, "User ID is required"),
      }),
      async ({ userId }) => {
        try {
          logger.info(`[LINEAR] Getting user ${userId}`);
          
          const query = `
            query($id: String!) {
              user(id: $id) {
                id
                name
                displayName
                email
                avatarUrl
                timezone
                active
                admin
                createdAt
              }
            }
          `;

          const result = await this.executeLinearRequest(query, { id: userId });

          return {
            success: true,
            data: { user: result.data.user },
          };
        } catch (error: any) {
          logger.error("[LINEAR] Get user failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get user",
          };
        }
      }
    );
  }
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createLinearTools = (userId: string) => {
  const suite = new LinearToolSuite(userId);
  return [
    // Issues (16 tools)
    suite.createListIssuesTool(),
    suite.createGetIssueTool(),
    suite.createCreateIssueTool(),
    suite.createUpdateIssueTool(),
    suite.createDeleteIssueTool(),
    suite.createArchiveIssueTool(),
    suite.createAssignIssueTool(),
    suite.createChangeStateTool(),
    suite.createSetPriorityTool(),
    suite.createAddLabelTool(),
    suite.createRemoveLabelTool(),
    suite.createSetDueDateTool(),
    suite.createSubscribeIssueTool(),
    suite.createListMyIssuesTool(),
    suite.createSearchIssuesTool(),

    // Comments (4 tools)
    suite.createListCommentsTool(),
    suite.createCreateCommentTool(),
    suite.createUpdateCommentTool(),
    suite.createDeleteCommentTool(),

    // Projects (6 tools)
    suite.createListProjectsTool(),
    suite.createGetProjectTool(),
    suite.createCreateProjectTool(),
    suite.createUpdateProjectTool(),
    suite.createArchiveProjectTool(),
    suite.createListProjectIssuesTool(),

    // Teams (6 tools)
    suite.createListTeamsTool(),
    suite.createGetTeamTool(),
    suite.createListTeamMembersTool(),
    suite.createListTeamStatesTool(),
    suite.createListTeamLabelsTool(),
    suite.createCreateLabelTool(),

    // Cycles (5 tools)
    suite.createListCyclesTool(),
    suite.createGetCycleTool(),
    suite.createGetActiveCycleTool(),
    suite.createListCycleIssuesTool(),
    suite.createAddToCycleTool(),

    // Users & Organization (3 tools)
    suite.createGetMeTool(),
    suite.createListUsersTool(),
    suite.createGetUserTool(),
  ];
};
