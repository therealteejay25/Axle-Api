import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface ToolContext {
  executionId: string;
  integrations: Map<string, any>;
  session?: {
    state: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
    };
    history?: any[];
  }
}

/**
 * Base abstract class for Axle tools.
 * Creates ADK-compatible tools without extending FunctionTool directly.
 */
export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodType<any>;

  /**
   * Convert to ADK FunctionTool
   */
  toFunctionTool(): FunctionTool {
    const tool = new FunctionTool({
      name: this.name,
      description: this.description,
      execute: async (params: any, context?: any) => {
        const toolContext = context as ToolContext;
        
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
  private getSchema(): object {
    const jsonSchema = zodToJsonSchema(this.inputSchema, { target: 'jsonSchema7' });
    return jsonSchema;
  }

  /**
   * The actual implementation to be defined by subclasses.
   */
  abstract runImpl(params: any, context: ToolContext): Promise<any>;
}

