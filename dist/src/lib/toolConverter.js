"use strict";
/**
 * Utility to convert @openai/agents tools to the new agentFramework format
 *
 * Usage:
 * import { convertTool } from "./lib/toolConverter";
 *
 * const myTool = convertTool({
 *   name: "my_tool",
 *   description: "Does something",
 *   parameters: z.object({ ... }),
 *   execute: async (params, ctx) => { ... }
 * });
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertTool = convertTool;
exports.convertTools = convertTools;
/**
 * Convert a Zod schema to OpenAI function parameters JSON schema
 */
function zodToJsonSchema(schema) {
    // Use Zod's built-in JSON schema generation
    const jsonSchema = schema._def?.jsonSchema?.();
    if (jsonSchema) {
        return jsonSchema;
    }
    // Fallback: basic conversion for common cases
    try {
        return JSON.parse(JSON.stringify(schema));
    }
    catch {
        // If conversion fails, return a generic object schema
        return {
            type: "object",
            properties: {},
            required: [],
        };
    }
}
/**
 * Convert tool definition from @openai/agents format to new format
 */
function convertTool(toolDef) {
    return {
        name: toolDef.name,
        description: toolDef.description,
        parameters: zodToJsonSchema(toolDef.parameters),
        execute: toolDef.execute,
    };
}
/**
 * Batch convert multiple tools
 */
function convertTools(toolDefs) {
    return toolDefs.map(convertTool);
}
