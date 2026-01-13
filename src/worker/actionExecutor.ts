import { AIAction } from "./aiCaller";
import { LoadedAgent } from "./agentLoader";
import { logger } from "../services/logger";
import { IExecutionAction } from "../models/Execution";
import { SocketService } from "../services/SocketService";
import { ExecutionEventService } from "../services/ExecutionEventService";

// ============================================
// ACTION EXECUTOR
// ============================================
// Executes actions returned by AI.
// Each action is executed in sequence.
// No AI inside executors.
// Wrapped with error handling.
// ============================================

export interface ActionResult {
  type: string;
  params: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs?: number;
}

export const executeActions = async (
  actions: AIAction[],
  loaded: LoadedAgent,
  allowedActions: string[],
  executionId?: string,
  agentId?: string
): Promise<ActionResult[]> => {
  // Since all adapters and tools are removed, return empty results with errors
  const results: ActionResult[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const startedAt = new Date();

    const actionResult = {
      type: action.type,
      params: action.params,
      error: `Action "${action.type}" not available - all tools and adapters have been removed`,
      startedAt,
      finishedAt: new Date()
    };

    results.push(actionResult);

    // Emit progress event - action failed
    if (executionId && agentId) {
      SocketService.getInstance().emitToAgent(agentId, "execution:action_completed", {
        executionId,
        actionType: action.type,
        success: false,
        error: actionResult.error
      });
    }

    if (executionId) {
      await ExecutionEventService.log({
        executionId,
        agentId,
        userId: (loaded.user as any)?._id?.toString?.() || (loaded.user as any)?.id,
        type: "action_failed",
        level: "error",
        message: action.type,
        actionType: action.type,
        actionIndex: i,
        data: {
          error: actionResult.error
        }
      });
    }
  }

  return results;
};

// ============================================
// SINGLE ACTION EXECUTOR (for iterative mode)
// ============================================
// Executes ONE action and returns result.
// Reuses executeActions logic for consistency.
// Used in THINK→DECIDE→ACT→OBSERVE loop.
// ============================================
export const executeSingleAction = async (
  action: AIAction,
  loaded: LoadedAgent,
  allowedActions: string[],
  executionId?: string,
  agentId?: string
): Promise<ActionResult> => {
  // Reuse existing multi-action executor with single-item array
  const results = await executeActions(
    [action],
    loaded,
    allowedActions,
    executionId,
    agentId
  );
  
  return results[0];
};

// Resolve templates in params using Nunjucks
const resolveParams = (
  params: Record<string, any>, 
  previousResults: ActionResult[],
  loaded: LoadedAgent
): Record<string, any> => {
  const safeStringify = (value: any, maxLen = 2000): string => {
    try {
      const str = JSON.stringify(value, null, 2);
      if (typeof str !== "string") return String(value);
      return str.length > maxLen ? `${str.slice(0, maxLen)}\n...` : str;
    } catch {
      return String(value);
    }
  };

  const decorateForTemplate = (value: any): any => {
    if (!value || typeof value !== "object") return value;

    const summaryText = (value as any)?.summaryText;
    const hasSummaryText = typeof summaryText === "string" && summaryText.trim().length > 0;

    if (Array.isArray(value)) {
      try {
        Object.defineProperty(value, "toString", {
          value: () => safeStringify(value),
          enumerable: false
        });
      } catch {
        // ignore
      }
      return value.map(v => decorateForTemplate(v));
    }

    try {
      Object.defineProperty(value, "toString", {
        value: () => (hasSummaryText ? summaryText : safeStringify(value)),
        enumerable: false
      });
    } catch {
      // ignore
    }

    for (const [k, v] of Object.entries(value)) {
      (value as any)[k] = decorateForTemplate(v);
    }
    return value;
  };

  // Create context from results
  const context: Record<string, any> = {
    user: loaded.user.toObject ? loaded.user.toObject() : loaded.user,
    agent: loaded.agent.toObject ? loaded.agent.toObject() : loaded.agent
  };
  
  for (const r of previousResults) {
    if (r.result) {
      context[r.type] = decorateForTemplate(r.result);
    }
  }

  // Use Handlebars for rendering
  const Handlebars = require("handlebars");

  Handlebars.registerHelper("json", (value: any) => safeStringify(value, 4000));
  Handlebars.registerHelper("pretty", (value: any) => safeStringify(value, 4000));

  const processValue = (value: any): any => {
    if (typeof value === "string") {
      // Check if it looks like a template (Handlebars or square bracket fallback)
      if (value.includes("{{") || value.includes("{%") || value.includes("[[")) {
        try {
          // Normalize square brackets to curly braces for Handlebars compatibility
          const normalizedValue = value.replace(/\[\[/g, "{{").replace(/\]\]/g, "}}");
          const template = Handlebars.compile(normalizedValue, { noEscape: true });
          return template(context);
        } catch (e) {
          logger.warn("Template render failed", { value, error: e });
          return value;
        }
      }
      return value;
    } else if (Array.isArray(value)) {
      return value.map(v => processValue(v));
    } else if (typeof value === "object" && value !== null) {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = processValue(v);
      }
      return result;
    }
    return value;
  };

  return processValue(params);
};

// Convert results to execution action format
export const toExecutionActions = (results: ActionResult[]): IExecutionAction[] => {
  return results.map(r => ({
    type: r.type,
    params: r.params,
    result: r.result,
    error: r.error,
    humanReadableStep: generateHumanReadableStep(r),
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    durationMs: r.durationMs,
    // Persist validation + tool metadata for richer execution timelines
    outputValidation: (r as any).outputValidation ?? null,
    toolsCalled: (r as any).toolsCalled ?? [],
    verified: (r as any).verified
  }));
};

// Simple heuristic for human-readable steps
const generateHumanReadableStep = (result: ActionResult): string => {
  const type = result.type.replace(/_/g, " ");
  const parts = type.split(" ");
  const platform = parts[0].toUpperCase();
  const action = parts.slice(1).join(" ");

  if (result.error) {
    return `Failed to ${action} on ${platform}: ${result.error}`;
  }

  // Common patterns
  if (type.includes("send message")) return `Sent a message to ${result.params.channel || result.params.to}`;
  if (type.includes("post tweet")) return `Posted a tweet: "${result.params.text?.substring(0, 30)}..."`;
  if (type.includes("create issue")) return `Created GitHub issue: "${result.params.title}"`;
  
  return `Successfully executed ${action} on ${platform}`;
};

// Remove sensitive data from params for logging
const sanitizeParams = (params: Record<string, any>): Record<string, any> => {
  const sanitized = { ...params };
  const sensitiveKeys = ["password", "token", "secret", "key", "auth"];
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = "[REDACTED]";
    }
  }
  
  return sanitized;
};

export default { executeActions, toExecutionActions };
