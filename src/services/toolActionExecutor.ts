import { logger } from "./logger";
import { messageEmitter } from "./messageEmitter";
import { SocketService } from "./SocketService";
import Execution from "../models/Execution";

/**
 * Tool Action Executor
 * 
 * Handles executing tool actions triggered from UI cards.
 * These are user-initiated actions that may require approval.
 */

interface ToolActionResult {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Execute a tool action from a UI card interaction
 */
export async function executeToolAction(
  executionId: string,
  action: string,
  actionData: any
): Promise<ToolActionResult> {
  logger.info(`[ToolActionExecutor] Executing ${action}`, { executionId, actionData });

  // Get execution context
  const execution = await Execution.findById(executionId);
  if (!execution) {
    throw new Error(`Execution not found: ${executionId}`);
  }

  const userId = execution.userId?.toString();
  const agentId = execution.agentId?.toString();

  if (!userId || !agentId) {
    throw new Error("Missing userId or agentId in execution");
  }

  // Map action to tool name
  const toolMapping: Record<string, string> = {
    'send_email': 'gmail_send_email',
    'post_tweet': 'twitter_post_tweet',
    'merge_pr': 'github_merge_pull_request',
    'comment_issue': 'github_add_issue_comment',
    'send_slack_message': 'slack_send_message',
    'create_slack_channel': 'slack_create_channel',
    'share_file': 'drive_share_file',
    'apply_changes': 'sheets_update_row',
    'toggle_schedule': 'schedule_toggle',
  };

  const toolName = toolMapping[action];
  if (!toolName) {
    throw new Error(`Unknown action: ${action}`);
  }

  try {
    // Dynamically import and execute the tool
    const { createUserTools } = await import("../tools");
    const tools = createUserTools(userId, agentId);
    
    // Find the tool
    const tool = (tools as any[]).find((t: any) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Emit tool call status
    messageEmitter.emitToolCall(executionId, toolName, actionData);

    // Check if approval is required
    if (messageEmitter.shouldRequireApproval(toolName)) {
      const approved = await messageEmitter.emitApprovalRequest(
        executionId,
        userId,
        toolName,
        actionData
      );

      if (!approved) {
        return {
          success: false,
          error: "User rejected the action",
        };
      }
    }

    // Execute the tool
    const result = await tool.execute(actionData, {
      userId,
      agentId,
      executionId,
    });

    // Emit tool result
    messageEmitter.emitToolResult(executionId, toolName, result, true);

    // Notify success
    SocketService.getInstance().emitToExecution(executionId, "tool_action_completed", {
      action,
      success: true,
      result,
    });

    return {
      success: true,
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[ToolActionExecutor] Failed to execute ${action}`, { error });

    // Emit error
    messageEmitter.emitError(executionId, errorMessage);

    // Notify failure
    SocketService.getInstance().emitToExecution(executionId, "tool_action_completed", {
      action,
      success: false,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
