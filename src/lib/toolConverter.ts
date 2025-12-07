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

import { AgentTool } from "./agentFramework";
import { z } from "zod";

type ZodSchema = z.ZodType<any, any, any>;

/**
 * Convert a Zod schema to OpenAI function parameters JSON schema
 */
function zodToJsonSchema(schema: ZodSchema): Record<string, any> {
  // Use Zod's built-in JSON schema generation
  const jsonSchema = (schema as any)._def?.jsonSchema?.();

  if (jsonSchema) {
    return jsonSchema;
  }

  // Fallback: basic conversion for common cases
  try {
    return JSON.parse(JSON.stringify(schema));
  } catch {
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
export function convertTool(toolDef: {
  name: string;
  description: string;
  parameters: ZodSchema;
  execute: (params: any, ctx?: any) => Promise<any>;
}): AgentTool {
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
export function convertTools(
  toolDefs: Array<{
    name: string;
    description: string;
    parameters: ZodSchema;
    execute: (params: any, ctx?: any) => Promise<any>;
  }>
): AgentTool[] {
  return toolDefs.map(convertTool);
}
