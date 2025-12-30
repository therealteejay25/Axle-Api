import { 
  ActionDefinition, 
  ActionInputs, 
  ActionResult, 
  ExecutionContext,
  RateLimitUsage
} from './types';
import { discoverActions } from './discover';
import { readActions } from './read';
import { writeActions } from './write';
import { notifyActions } from './notify';
import { engageActions } from './engage';
import { organizeActions } from './organize';
import { logger } from '../services/logger';

// ============================================
// CAPABILITY EXECUTOR
// ============================================
// Central dispatcher for capability-based actions.
// Maps human-intent actions to underlying tools.
// ============================================

// Combine all actions
const allActions: Record<string, ActionDefinition> = {
  ...discoverActions,
  ...readActions,
  ...writeActions,
  ...notifyActions,
  ...engageActions,
  ...organizeActions
};

// Rate limit tracking (in-memory for now)
const rateLimits: Map<string, RateLimitUsage> = new Map();

// ============================================
// RATE LIMITING
// ============================================

function checkRateLimit(action: ActionDefinition): void {
  if (!action.constraints.rateLimit) return;
  
  const key = action.actionId;
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  let usage = rateLimits.get(key);
  
  if (!usage) {
    usage = {
      action: key,
      currentHour: 0,
      currentDay: 0,
      resetHour: new Date(now.getTime() + 60 * 60 * 1000),
      resetDay: new Date(now.getTime() + 24 * 60 * 60 * 1000)
    };
    rateLimits.set(key, usage);
  }
  
  // Reset counters if needed
  if (now > usage.resetHour) {
    usage.currentHour = 0;
    usage.resetHour = new Date(now.getTime() + 60 * 60 * 1000);
  }
  
  if (now > usage.resetDay) {
    usage.currentDay = 0;
    usage.resetDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  
  // Check limits
  const limits = action.constraints.rateLimit!;
  
  if (usage.currentHour >= limits.maxPerHour) {
    throw new Error(
      `Rate limit exceeded for ${action.actionId}: ${limits.maxPerHour}/hour. ` +
      `Resets at ${usage.resetHour.toISOString()}`
    );
  }
  
  if (usage.currentDay >= limits.maxPerDay) {
    throw new Error(
      `Rate limit exceeded for ${action.actionId}: ${limits.maxPerDay}/day. ` +
      `Resets at ${usage.resetDay.toISOString()}`
    );
  }
  
  // Increment counters
  usage.currentHour++;
  usage.currentDay++;
}

// ============================================
// INPUT VALIDATION
// ============================================

function validateInputs(action: ActionDefinition, inputs: ActionInputs): void {
  const schema = action.inputSchema;
  
  for (const [fieldName, fieldDef] of Object.entries(schema)) {
    const value = inputs[fieldName];
    
    // Check required
    if (fieldDef.required && (value === undefined || value === null)) {
      throw new Error(`Missing required input: ${fieldName}`);
    }
    
    // Skip validation if not provided and not required
    if (value === undefined || value === null) {
      // Set default if available
      if (fieldDef.default !== undefined) {
        inputs[fieldName] = fieldDef.default;
      }
      continue;
    }
    
    // SKIP VALIDATION FOR TEMPLATES (Runtime resolution)
    if (typeof value === 'string' && value.includes('{{') && value.includes('}}')) {
      continue;
    }
    
    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== fieldDef.type) {
      throw new Error(
        `Invalid type for ${fieldName}: expected ${fieldDef.type}, got ${actualType}`
      );
    }
    
    // Enum validation
    if (fieldDef.enum && !fieldDef.enum.includes(value)) {
      throw new Error(
        `Invalid value for ${fieldName}: must be one of ${fieldDef.enum.join(', ')}`
      );
    }
    
    // String/number validation
    if (fieldDef.validation) {
      if (fieldDef.type === 'string' && typeof value === 'string') {
        if (fieldDef.validation.min && value.length < fieldDef.validation.min) {
          throw new Error(
            `${fieldName} must be at least ${fieldDef.validation.min} characters`
          );
        }
        if (fieldDef.validation.max && value.length > fieldDef.validation.max) {
          throw new Error(
            `${fieldName} must be at most ${fieldDef.validation.max} characters`
          );
        }
        if (fieldDef.validation.pattern) {
          const regex = new RegExp(fieldDef.validation.pattern);
          if (!regex.test(value)) {
            throw new Error(
              `${fieldName} does not match required pattern: ${fieldDef.validation.pattern}`
            );
          }
        }
      }
      
      if (fieldDef.type === 'number' && typeof value === 'number') {
        if (fieldDef.validation.min !== undefined && value < fieldDef.validation.min) {
          throw new Error(
            `${fieldName} must be at least ${fieldDef.validation.min}`
          );
        }
        if (fieldDef.validation.max !== undefined && value > fieldDef.validation.max) {
          throw new Error(
            `${fieldName} must be at most ${fieldDef.validation.max}`
          );
        }
      }
    }
  }
}

// ============================================
// VERIFICATION
// ============================================

async function verifyResult(
  action: ActionDefinition,
  result: any,
  context: ExecutionContext
): Promise<boolean> {
  if (!action.verification || action.verification.method === 'none') {
    return true;
  }
  
  if (action.verification.method === 'check_status') {
    // Simple check: result exists and has no error
    return result && !result.error;
  }
  
  if (action.verification.method === 'read_back') {
    // Verify expected output fields exist
    const expected = action.verification.expectedOutput || {};
    
    for (const [field, type] of Object.entries(expected)) {
      if (!(field in result)) {
        logger.warn(`Verification failed: missing field ${field}`, {
          action: action.actionId,
          result
        });
        return false;
      }
      
      const actualType = typeof result[field];
      if (actualType !== type && !(type === 'array' && Array.isArray(result[field]))) {
        logger.warn(`Verification failed: ${field} type mismatch`, {
          action: action.actionId,
          expected: type,
          actual: actualType
        });
        return false;
      }
    }
    
    return true;
  }
  
  return true;
}

// ============================================
// EXECUTE ACTION
// ============================================

export async function executeAction(
  actionId: string,
  inputs: ActionInputs,
  context: ExecutionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  // Get action definition
  const action = allActions[actionId];
  
  if (!action) {
    return {
      success: false,
      error: `Unknown action: ${actionId}. Available actions: ${Object.keys(allActions).join(', ')}`
    };
  }
  
  logger.info('Executing capability action', {
    actionId,
    capability: action.capability,
    inputs
  });
  
  try {
    // 1. Check rate limits
    checkRateLimit(action);
    
    // 2. Validate inputs
    validateInputs(action, inputs);
    
    // 3. Check required integrations
    for (const integration of action.metadata.requiresIntegration) {
      if (!context.integrations.has(integration)) {
        throw new Error(`Required integration not connected: ${integration}`);
      }
    }
    
    // 4. Execute action
    const toolsCalled: string[] = [];
    const data = await action.executor(inputs, context);
    
    // 5. Verify result
    const verified = await verifyResult(action, data, context);
    
    const duration = Date.now() - startTime;
    
    logger.info('Action completed', {
      actionId,
      success: true,
      duration,
      verified
    });
    
    return {
      success: true,
      data,
      metadata: {
        duration,
        toolsCalled,
        verified
      }
    };
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error('Action failed', {
      actionId,
      error: error.message,
      duration
    });
    
    return {
      success: false,
      error: error.message,
      metadata: {
        duration,
        toolsCalled: []
      }
    };
  }
}

// ============================================
// GET AVAILABLE ACTIONS
// ============================================

export function getAvailableActions(connectedIntegrations: string[]): ActionDefinition[] {
  return Object.values(allActions).filter(action => {
    // If no integrations required, always available
    if (action.metadata.requiresIntegration.length === 0) {
      return true;
    }
    
    // Check if at least one required integration is connected
    return action.metadata.requiresIntegration.some(required =>
      connectedIntegrations.includes(required)
    );
  });
}

// ============================================
// GET ACTION BY ID
// ============================================

export function getAction(actionId: string): ActionDefinition | null {
  return allActions[actionId] || null;
}

export function validateActionParams(actionId: string, params: any): { valid: boolean, errors: string[] } {
  const action = allActions[actionId];
  if (!action) {
    return { valid: false, errors: [`Unknown action: ${actionId}`] };
  }
  
  try {
    validateInputs(action, params);
    return { valid: true, errors: [] };
  } catch (error: any) {
    return { valid: false, errors: [error.message] };
  }
}

// ============================================
// EXPORTS
// ============================================

export { allActions };
export default {
  executeAction,
  getAvailableActions,
  getAction,
  validateActionParams
};
