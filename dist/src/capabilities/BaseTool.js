"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTool = void 0;
const adk_1 = require("@google/adk");
const zod_to_json_schema_1 = require("zod-to-json-schema");
/**
 * Base abstract class for Axle tools.
 * Creates ADK-compatible tools without extending FunctionTool directly.
 */
class BaseTool {
    /**
     * Convert to ADK FunctionTool
     */
    toFunctionTool() {
        const tool = new adk_1.FunctionTool({
            name: this.name,
            description: this.description,
            execute: async (params, context) => {
                const toolContext = context;
                // Validate input using Zod
                const validation = this.inputSchema.safeParse(params);
                if (!validation.success) {
                    throw new Error(`Invalid input for ${this.name}: ${validation.error.message}`);
                }
                return this.runImpl(validation.data, toolContext);
            }
        });
        return tool;
    }
    /**
     * Get JSON Schema from Zod schema
     */
    getSchema() {
        const jsonSchema = (0, zod_to_json_schema_1.zodToJsonSchema)(this.inputSchema, { target: 'jsonSchema7' });
        return jsonSchema;
    }
}
exports.BaseTool = BaseTool;
