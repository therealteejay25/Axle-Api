# Google Tasks Tools Summary

## Overview
Comprehensive Google Tasks tool suite with 10 tools for managing task lists and tasks.

## Tool Categories

### Task List Management (2 tools)
- `gtasks_list_task_lists` - List all task lists
- `gtasks_create_task_list` - Create a new task list

### Task Management (8 tools)
- `gtasks_list_tasks` - List tasks in a task list (with filters: showCompleted, showHidden, dueMin, dueMax)
- `gtasks_get_task` - Get a specific task by ID
- `gtasks_create_task` - Create a new task (with title, notes, due date, parent for subtasks)
- `gtasks_update_task` - Update an existing task (title, notes, status, due date)
- `gtasks_complete_task` - Mark a task as completed
- `gtasks_delete_task` - Delete a task
- `gtasks_move_task` - Move task to another position or parent
- `gtasks_clear_completed` - Clear all completed tasks from a task list

## Implementation Details
- All tools extend `BaseGoogleTool`
- Uses Google Tasks API v1
- Supports task hierarchies (parent/child relationships)
- Proper error handling and logging with `[TASKS]` prefix
- Zod validation for all inputs
- Factory functions for each tool
- Main export function: `createTasksTools(userId)`

## Total Tools: 10
