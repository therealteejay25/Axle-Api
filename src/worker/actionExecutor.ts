import { AIAction } from "./aiCaller";
import { LoadedAgent } from "./agentLoader";
import { executeAction } from "../adapters/registry";
import { logger } from "../services/logger";
import { IExecutionAction } from "../models/Execution";

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
}

export const executeActions = async (
  actions: AIAction[],
  loaded: LoadedAgent,
  allowedActions: string[]
): Promise<ActionResult[]> => {
  const results: ActionResult[] = [];
  
  for (const action of actions) {
    const startedAt = new Date();
    
    // Validate action is allowed
    if (!allowedActions.includes(action.type)) {
      logger.warn("Action not allowed", { 
        type: action.type, 
        allowed: allowedActions 
      });
      
      results.push({
        type: action.type,
        params: action.params,
        error: `Action "${action.type}" is not allowed for this agent`,
        startedAt,
        finishedAt: new Date()
      });
      continue;
    }
    
    try {
      // Resolve params using results from previous actions
      const resolvedParams = resolveParams(action.params, results, loaded);

      logger.info("Executing action", { 
        type: action.type,
        params: sanitizeParams(resolvedParams)
      });
      
      // Execute the action via adapter registry
      const result = await executeAction(
        action.type,
        resolvedParams,
        loaded.integrations
      );
      
      results.push({
        type: action.type,
        params: resolvedParams,
        result,
        startedAt,
        finishedAt: new Date()
      });
      
      logger.info("Action completed", { 
        type: action.type,
        success: true
      });
      
    } catch (error: any) {
      logger.error("Action failed", {
        type: action.type,
        error: error.message
      });
      
      results.push({
        type: action.type,
        params: action.params,
        error: error.message,
        startedAt,
        finishedAt: new Date()
      });
    }
  }
  
  return results;
};

// Resolve templates in params using Nunjucks
const resolveParams = (
  params: Record<string, any>, 
  previousResults: ActionResult[],
  loaded: LoadedAgent
): Record<string, any> => {
  // Create context from results
  const context: Record<string, any> = {
    user: loaded.user,
    agent: loaded.agent
  };
  
  for (const r of previousResults) {
    if (r.result) {
      context[r.type] = r.result;
    }
  }

  // Use Nunjucks for rendering
  const nunjucks = require("nunjucks");
  nunjucks.configure({ autoescape: false });

  const processValue = (value: any): any => {
    if (typeof value === "string") {
      // Check if it looks like a template
      if (value.includes("{{") || value.includes("{%")) {
        try {
          return nunjucks.renderString(value, context);
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
    finishedAt: r.finishedAt
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
