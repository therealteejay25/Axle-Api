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
      logger.info("Executing action", { 
        type: action.type,
        params: sanitizeParams(action.params)
      });
      
      // Execute the action via adapter registry
      const result = await executeAction(
        action.type,
        action.params,
        loaded.integrations
      );
      
      results.push({
        type: action.type,
        params: action.params,
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

// Convert results to execution action format
export const toExecutionActions = (results: ActionResult[]): IExecutionAction[] => {
  return results.map(r => ({
    type: r.type,
    params: r.params,
    result: r.result,
    error: r.error,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt
  }));
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
