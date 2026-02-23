import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE TASKS TOOL SUITE - COMPREHENSIVE
// ============================================

export class TasksToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // List task lists
  createListTaskListsTool() {
    return this.createTool(
      "gtasks_list_task_lists",
      "List all task lists",
      z.object({
        maxResults: z.number().min(1).max(100).default(100).optional(),
      }),
      async ({ maxResults }) => {
        try {
          logger.info(`[TASKS] Listing task lists`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const tasks = google.tasks({ version: "v1", auth: oauth2Client });

            return await tasks.tasklists.list({
              maxResults,
            });
          });

          const taskLists = result.data.items || [];
          logger.info(`[TASKS] Found ${taskLists.length} task lists`);

          return {
            success: true,
            data: {
              taskLists: taskLists.map((list: any) => ({
                id: list.id,
                title: list.title,
                updated: list.updated,
              })),
              totalCount: taskLists.length,
            },
          };
        } catch (error: any) {
          logger.error("[TASKS] List task lists failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list task lists",
          };
        }
      }
    );
  }

  // Create task list
  createCreateTaskListTool() {
    return this.createTool(
      "gtasks_create_task_list",
      "Create a new task list",
      z.object({
        title: z.string().min(1, "Task list title is required"),
      }),
      async ({ title }) => {
        try {
          logger.info(`[TASKS] Creating task list: ${title}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const tasks = google.tasks({ version: "v1", auth: oauth2Client });

            return await tasks.tasklists.insert({
              requestBody: {
                title,
              },
            });
          });

          logger.info(`[TASKS] Task list created: ${result.data.id}`);

          return {
            success: true,
            message: `Task list "${title}" created successfully`,
            data: {
              taskListId: result.data.id,
              title: result.data.title,
            },
          };
        } catch (error: any) {
          logger.error("[TASKS] Create task list failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create task list",
          };
        }
      }
    );
  }

  // List tasks
  createListTasksTool() {
    return this.createTool(
      "gtasks_list_tasks",
      "List tasks in a task list",
      z.object({
        taskListId: z.string().min(1, "Task list ID is required"),
        maxResults: z.number().min(1).max(100).default(100).optional(),
        showCompleted: z.boolean().default(true).optional(),
        showHidden: z.boolean().default(false).optional(),
        dueMin: z.string().optional().describe("Lower bound for task's due date (RFC 3339 timestamp)"),
        dueMax: z.string().optional().describe("Upper bound for task's due date (RFC 3339 timestamp)"),
      }),
      async ({ taskListId, maxResults, showCompleted, showHidden, dueMin, dueMax }) => {
        try {
          logger.info(`[TASKS] Listing tasks for list: ${taskListId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const tasks = google.tasks({ version: "v1", auth: oauth2Client });

            return await tasks.tasks.list({
              tasklist: taskListId,
              maxResults,
              showCompleted,
              showHidden,
              dueMin,
              dueMax,
            });
          });

          const taskItems = result.data.items || [];
          logger.info(`[TASKS] Found ${taskItems.length} tasks`);

          return {
            success: true,
            data: {
              tasks: taskItems.map((task: any) => ({
                id: task.id,
                title: task.title,
                notes: task.notes,
                status: task.status,
                due: task.due,
                completed: task.completed,
                updated: task.updated,
                parent: task.parent,
                position: task.position,
              })),
              totalCount: taskItems.length,
            },
          };
        } catch (error: any) {
          logger.error("[TASKS] List tasks failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list tasks",
          };
        }
      }
    );
  }

  // Get task
  createGetTaskTool() {
    return this.createTool(
      "gtasks_get_task",
      "Get a specific task by ID",
      z.object({
        taskListId: z.string().min(1, "Task list ID is required"),
        taskId: z.string().min(1, "Task ID is required"),
      }),
      async ({ taskListId, taskId }) => {
        try {
          logger.info(`[TASKS] Getting task: ${taskId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const tasks = google.tasks({ version: "v1", auth: oauth2Client });

            return await tasks.tasks.get({
              tasklist: taskListId,
              task: taskId,
            });
          });

          logger.info(`[TASKS] Retrieved task: ${result.data.title}`);

          return {
            success: true,
            data: {
              id: result.data.id,
              title: result.data.title,
              notes: result.data.notes,
              status: result.data.status,
              due: result.data.due,
              completed: result.data.completed,
              updated: result.data.updated,
              parent: result.data.parent,
              position: result.data.position,
              links: result.data.links,
            },
          };
        } catch (error: any) {
          logger.error("[TASKS] Get task failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get task",
          };
        }
      }
    );
  }

  // Create task
  createCreateTaskTool() {
    return this.createTool(
      "gtasks_create_task",
      "Create a new task in a task list",
      z.object({
        taskListId: z.string().min(1, "Task list ID is required"),
        title: z.string().min(1, "Task title is required"),
        notes: z.string().optional().describe("Task notes/description"),
        due: z.string().optional().describe("Due date (RFC 3339 timestamp)"),
        parent: z.string().optional().describe("Parent task ID for subtasks"),
        previous: z.string().optional().describe("Previous sibling task ID for positioning"),
      }),
      async ({ taskListId, title, notes, due, parent, previous }) => {
        try {
          logger.info(`[TASKS] Creating task: ${title}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const tasks = google.tasks({ version: "v1", auth: oauth2Client });

            return await tasks.tasks.insert({
              tasklist: taskListId,
              parent,
              previous,
              requestBody: {
                title,
                notes,
                due,
              },
            });
          });

          logger.info(`[TASKS] Task created: ${result.data.id}`);

          return {
            success: true,
            message: `Task "${title}" created successfully`,
            data: {
              taskId: result.data.id,
              title: result.data.title,
              status: result.data.status,
            },
          };
        } catch (error: any) {
          logger.error("[TASKS] Create task failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create task",
          };
        }
      }
    );
  }

  // Update task
  createUpdateTaskTool() {
    return this.createTool(
      "gtasks_update_task",
      "Update an existing task",
      z.object({
        taskListId: z.string().min(1, "Task list ID is required"),
        taskId: z.string().min(1, "Task ID is required"),
        title: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(["needsAction", "completed"]).optional(),
        due: z.string().optional().describe("Due date (RFC 3339 timestamp)"),
      }),
      async ({ taskListId, taskId, title, notes, status, due }) => {
        try {
          logger.info(`[TASKS] Updating task: ${taskId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const tasks = google.tasks({ version: "v1", auth: oauth2Client });

            // Get existing task first
            const existing = await tasks.tasks.get({
              tasklist: taskListId,
              task: taskId,
            });

            return await tasks.tasks.update({
              tasklist: taskListId,
              task: taskId,
              requestBody: {
                ...existing.data,
                title: title !== undefined ? title : existing.data.title,
                notes: notes !== undefined ? notes : existing.data.notes,
                status: status !== undefined ? status : existing.data.status,
                due: due !== undefined ? due : existing.data.due,
              },
            });
          });

          logger.info(`[TASKS] Task updated successfully`);

          return {
            success: true,
            message: "Task updated successfully",
            data: {
              taskId: result.data.id,
              title: result.data.title,
              status: result.data.status,
            },
          };
        } catch (error: any) {
          logger.error("[TASKS] Update task failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update task",
          };
        }
      }
    );
  }

  // Complete task
  createCompleteTaskTool() {
    return this.createTool(
      "gtasks_complete_task",
      "Mark a task as completed",
      z.object({
        taskListId: z.string().min(1, "Task list ID is required"),
        taskId: z.string().min(1, "Task ID is required"),
      }),
      async ({ taskListId, taskId }) => {
        try {
          logger.info(`[TASKS] Completing task: ${taskId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const tasks = google.tasks({ version: "v1", auth: oauth2Client });

            // Get existing task
            const existing = await tasks.tasks.get({
              tasklist: taskListId,
              task: taskId,
            });

            return await tasks.tasks.update({
              tasklist: taskListId,
              task: taskId,
              requestBody: {
                ...existing.data,
                status: "completed",
                completed: new Date().toISOString(),
              },
            });
          });

          logger.info(`[TASKS] Task completed successfully`);

          return {
            success: true,
            message: "Task marked as completed",
            data: {
              taskId: result.data.id,
              title: result.data.title,
              status: result.data.status,
              completed: result.data.completed,
            },
          };
        } catch (error: any) {
          logger.error("[TASKS] Complete task failed:", error);
          return {
            success: false,
            error: error.message || "Failed to complete task",
          };
        }
      }
    );
  }

  // Delete task
  createDeleteTaskTool() {
    return this.createTool(
      "gtasks_delete_task",
      "Delete a task",
      z.object({
        taskListId: z.string().min(1, "Task list ID is required"),
        taskId: z.string().min(1, "Task ID is required"),
      }),
      async ({ taskListId, taskId }) => {
        try {
          logger.info(`[TASKS] Deleting task: ${taskId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const tasks = google.tasks({ version: "v1", auth: oauth2Client });

            return await tasks.tasks.delete({
              tasklist: taskListId,
              task: taskId,
            });
          });

          logger.info(`[TASKS] Task deleted successfully`);

          return {
            success: true,
            message: "Task deleted successfully",
          };
        } catch (error: any) {
          logger.error("[TASKS] Delete task failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete task",
          };
        }
      }
    );
  }

  // Move task
  createMoveTaskTool() {
    return this.createTool(
      "gtasks_move_task",
      "Move task to another position or parent",
      z.object({
        taskListId: z.string().min(1, "Task list ID is required"),
        taskId: z.string().min(1, "Task ID is required"),
        parent: z.string().optional().describe("New parent task ID (for subtasks)"),
        previous: z.string().optional().describe("Previous sibling task ID for positioning"),
      }),
      async ({ taskListId, taskId, parent, previous }) => {
        try {
          logger.info(`[TASKS] Moving task: ${taskId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const tasks = google.tasks({ version: "v1", auth: oauth2Client });

            return await tasks.tasks.move({
              tasklist: taskListId,
              task: taskId,
              parent,
              previous,
            });
          });

          logger.info(`[TASKS] Task moved successfully`);

          return {
            success: true,
            message: "Task moved successfully",
            data: {
              taskId: result.data.id,
              parent: result.data.parent,
              position: result.data.position,
            },
          };
        } catch (error: any) {
          logger.error("[TASKS] Move task failed:", error);
          return {
            success: false,
            error: error.message || "Failed to move task",
          };
        }
      }
    );
  }

  // Clear completed tasks
  createClearCompletedTool() {
    return this.createTool(
      "gtasks_clear_completed",
      "Clear all completed tasks from a task list",
      z.object({
        taskListId: z.string().min(1, "Task list ID is required"),
      }),
      async ({ taskListId }) => {
        try {
          logger.info(`[TASKS] Clearing completed tasks from list: ${taskListId}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const tasks = google.tasks({ version: "v1", auth: oauth2Client });

            return await tasks.tasks.clear({
              tasklist: taskListId,
            });
          });

          logger.info(`[TASKS] Completed tasks cleared successfully`);

          return {
            success: true,
            message: "Completed tasks cleared successfully",
          };
        } catch (error: any) {
          logger.error("[TASKS] Clear completed failed:", error);
          return {
            success: false,
            error: error.message || "Failed to clear completed tasks",
          };
        }
      }
    );
  }
}

// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

export const createListTaskListsTool = (userId: string) =>
  new TasksToolSuite(userId).createListTaskListsTool();

export const createCreateTaskListTool = (userId: string) =>
  new TasksToolSuite(userId).createCreateTaskListTool();

export const createListTasksTool = (userId: string) =>
  new TasksToolSuite(userId).createListTasksTool();

export const createGetTaskTool = (userId: string) =>
  new TasksToolSuite(userId).createGetTaskTool();

export const createCreateTaskTool = (userId: string) =>
  new TasksToolSuite(userId).createCreateTaskTool();

export const createUpdateTaskTool = (userId: string) =>
  new TasksToolSuite(userId).createUpdateTaskTool();

export const createCompleteTaskTool = (userId: string) =>
  new TasksToolSuite(userId).createCompleteTaskTool();

export const createDeleteTaskTool = (userId: string) =>
  new TasksToolSuite(userId).createDeleteTaskTool();

export const createMoveTaskTool = (userId: string) =>
  new TasksToolSuite(userId).createMoveTaskTool();

export const createClearCompletedTool = (userId: string) =>
  new TasksToolSuite(userId).createClearCompletedTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createTasksTools = (userId: string) => {
  const suite = new TasksToolSuite(userId);
  return [
    suite.createListTaskListsTool(),
    suite.createCreateTaskListTool(),
    suite.createListTasksTool(),
    suite.createGetTaskTool(),
    suite.createCreateTaskTool(),
    suite.createUpdateTaskTool(),
    suite.createCompleteTaskTool(),
    suite.createDeleteTaskTool(),
    suite.createMoveTaskTool(),
    suite.createClearCompletedTool(),
  ];
};
