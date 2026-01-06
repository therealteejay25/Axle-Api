"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBatch = exports.generateErrorMessage = exports.validateToolParams = void 0;
const zod_1 = require("zod");
const toolDefinitions_1 = require("./toolDefinitions");
const logger_1 = require("../services/logger");
// ============================================
// TOOL VALIDATOR
// ============================================
// Strict schema validation using Zod.
// Detects hallucinated parameters and provides
// helpful error messages.
// ============================================
// Build Zod schema from tool definition
const buildZodSchema = (tool) => {
    const shape = {};
    for (const param of tool.parameters) {
        let schema;
        // Base type
        switch (param.type) {
            case 'string':
                schema = zod_1.z.string();
                break;
            case 'number':
                schema = zod_1.z.number();
                break;
            case 'boolean':
                schema = zod_1.z.boolean();
                break;
            case 'object':
                schema = zod_1.z.record(zod_1.z.any());
                break;
            case 'array':
                schema = zod_1.z.array(zod_1.z.any());
                break;
            default:
                schema = zod_1.z.any();
        }
        // Apply validation rules
        if (param.validation) {
            if (param.type === 'string') {
                const stringSchema = schema;
                // Pattern validation
                if (param.validation.pattern) {
                    schema = stringSchema.regex(new RegExp(param.validation.pattern), `Must match pattern: ${param.validation.pattern}`);
                }
                // Length validation
                if (param.validation.min !== undefined) {
                    schema = schema.min(param.validation.min);
                }
                if (param.validation.max !== undefined) {
                    schema = schema.max(param.validation.max);
                }
            }
            if (param.type === 'number') {
                const numberSchema = schema;
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
                schema = zod_1.z.enum(param.validation.enum);
            }
        }
        // Required vs optional
        if (!param.required) {
            schema = schema.optional();
        }
        shape[param.name] = schema;
    }
    // Strict mode: reject unknown keys
    return zod_1.z.object(shape).strict();
};
// Validate tool parameters
const validateToolParams = (toolName, params) => {
    const tool = (0, toolDefinitions_1.getToolDefinition)(toolName);
    if (!tool) {
        logger_1.logger.warn('Unknown tool', { toolName });
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
        const errors = [];
        const hallucinated = [];
        for (const issue of result.error.issues) {
            if (issue.code === 'unrecognized_keys') {
                // Hallucinated parameters
                hallucinated.push(...(issue.keys || []));
            }
            else {
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
    }
    catch (error) {
        logger_1.logger.error('Validation error', { toolName, error: error.message });
        return {
            valid: false,
            errors: [`Validation failed: ${error.message}`],
            hallucinated: []
        };
    }
};
exports.validateToolParams = validateToolParams;
// Generate helpful suggestions based on errors
const generateSuggestions = (tool, errors, hallucinated) => {
    const suggestions = [];
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
const generateErrorMessage = (toolName, validation) => {
    const tool = (0, toolDefinitions_1.getToolDefinition)(toolName);
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
exports.generateErrorMessage = generateErrorMessage;
// Validate multiple tools at once
const validateBatch = (actions) => {
    const results = {};
    for (const action of actions) {
        results[action.type] = (0, exports.validateToolParams)(action.type, action.params);
    }
    return results;
};
exports.validateBatch = validateBatch;
