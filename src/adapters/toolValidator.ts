import { z } from 'zod';
import { ToolDefinition, ToolParameter, ValidationResult } from './types';
import { toolDefinitions, getToolDefinition } from './toolDefinitions';
import { logger } from '../services/logger';

// ============================================
// TOOL VALIDATOR
// ============================================
// Strict schema validation using Zod.
// Detects hallucinated parameters and provides
// helpful error messages.
// ============================================

// Build Zod schema from tool definition
const buildZodSchema = (tool: ToolDefinition): z.ZodObject<any> => {
  const shape: Record<string, z.ZodTypeAny> = {};
  
  for (const param of tool.parameters) {
    let schema: z.ZodTypeAny;
    
    // Base type
    switch (param.type) {
      case 'string':
        schema = z.string();
        break;
      case 'number':
        schema = z.number();
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'object':
        schema = z.record(z.any());
        break;
      case 'array':
        schema = z.array(z.any());
        break;
      default:
        schema = z.any();
    }
    
    // Apply validation rules
    if (param.validation) {
      if (param.type === 'string') {
        const stringSchema = schema as z.ZodString;
        
        // Pattern validation
        if (param.validation.pattern) {
          schema = stringSchema.regex(
            new RegExp(param.validation.pattern),
            `Must match pattern: ${param.validation.pattern}`
          );
        }
        
        // Length validation
        if (param.validation.min !== undefined) {
          schema = (schema as z.ZodString).min(param.validation.min);
        }
        if (param.validation.max !== undefined) {
          schema = (schema as z.ZodString).max(param.validation.max);
        }
      }
      
      if (param.type === 'number') {
        const numberSchema = schema as z.ZodNumber;
        
        // Min/max validation
        if (param.validation.min !== undefined) {
          schema = numberSchema.min(param.validation.min);
        }
        if (param.validation.max !== undefined) {
          schema = numberSchema.max(param.validation.max);
        }
      }
      
      // Enum validation
      if (param.validation.enum && param.validation.enum.length > 0) {
        schema = z.enum(param.validation.enum as [string, ...string[]]);
      }
    }
    
    // Required vs optional
    if (!param.required) {
      schema = schema.optional();
    }
    
    shape[param.name] = schema;
  }
  
  // Strict mode: reject unknown keys
  return z.object(shape).strict();
};

// Validate tool parameters
export const validateToolParams = (
  toolName: string,
  params: Record<string, any>
): ValidationResult => {
  const tool = getToolDefinition(toolName);
  
  if (!tool) {
    logger.warn('Unknown tool', { toolName });
    return {
      valid: false,
      errors: [`Unknown tool: ${toolName}`],
      hallucinated: [],
      suggestions: ['Check the tool name spelling', 'Use a tool from the available tools list']
    };
  }
  
  try {
    const schema = buildZodSchema(tool);
    const result = schema.safeParse(params);
    
    if (result.success) {
      return { valid: true, errors: [], hallucinated: [] };
    }
    
    // Parse Zod errors
    const errors: string[] = [];
    const hallucinated: string[] = [];
    
    for (const issue of result.error.issues) {
      if (issue.code === 'unrecognized_keys') {
        // Hallucinated parameters
        hallucinated.push(...(issue.keys || []));
      } else {
        // Validation errors
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
        errors.push(`${path}: ${issue.message}`);
      }
    }
    
    return {
      valid: false,
      errors,
      hallucinated,
      suggestions: generateSuggestions(tool, errors, hallucinated)
    };
  } catch (error: any) {
    logger.error('Validation error', { toolName, error: error.message });
    return {
      valid: false,
      errors: [`Validation failed: ${error.message}`],
      hallucinated: []
    };
  }
};

// Generate helpful suggestions based on errors
const generateSuggestions = (
  tool: ToolDefinition,
  errors: string[],
  hallucinated: string[]
): string[] => {
  const suggestions: string[] = [];
  
  if (hallucinated.length > 0) {
    suggestions.push(`Remove unknown parameters: ${hallucinated.join(', ')}`);
    suggestions.push('Only use parameters listed in the tool schema');
  }
  
  // Check for missing required parameters
  const requiredParams = tool.parameters.filter(p => p.required).map(p => p.name);
  for (const param of requiredParams) {
    if (errors.some(e => e.includes(param) && e.includes('required'))) {
      suggestions.push(`Add required parameter: ${param} (${tool.parameters.find(p => p.name === param)?.description})`);
    }
  }
  
  // Check for type mismatches
  if (errors.some(e => e.includes('Expected'))) {
    suggestions.push('Check parameter types match the schema');
  }
  
  return suggestions;
};

// Generate detailed error message for AI
export const generateErrorMessage = (
  toolName: string,
  validation: ValidationResult
): string => {
  const tool = getToolDefinition(toolName);
  
  if (!tool) {
    return `Unknown tool: ${toolName}`;
  }
  
  let message = `❌ Tool "${toolName}" validation failed:\n\n`;
  
  // Validation errors
  if (validation.errors.length > 0) {
    message += `**Errors:**\n`;
    validation.errors.forEach(err => message += `  • ${err}\n`);
    message += '\n';
  }
  
  // Hallucinated parameters
  if (validation.hallucinated.length > 0) {
    message += `**Hallucinated parameters (not in schema):**\n`;
    validation.hallucinated.forEach(param => message += `  • ${param}\n`);
    message += '\n';
  }
  
  // Valid parameters
  message += `**Valid parameters for ${toolName}:**\n`;
  tool.parameters.forEach(p => {
    const required = p.required ? '**required**' : 'optional';
    message += `  • ${p.name} (${p.type}, ${required}): ${p.description}\n`;
    if (p.example !== undefined) {
      message += `    Example: ${JSON.stringify(p.example)}\n`;
    }
  });
  message += '\n';
  
  // Suggestions
  if (validation.suggestions && validation.suggestions.length > 0) {
    message += `**Suggestions:**\n`;
    validation.suggestions.forEach(s => message += `  • ${s}\n`);
    message += '\n';
  }
  
  // Example usage
  if (tool.examples.length > 0) {
    message += `**Example usage:**\n`;
    message += `\`\`\`json\n`;
    message += JSON.stringify(tool.examples[0].params, null, 2);
    message += `\n\`\`\`\n`;
  }
  
  return message;
};

// Validate multiple tools at once
export const validateBatch = (
  actions: Array<{ type: string; params: Record<string, any> }>
): Record<string, ValidationResult> => {
  const results: Record<string, ValidationResult> = {};
  
  for (const action of actions) {
    results[action.type] = validateToolParams(action.type, action.params);
  }
  
  return results;
};
