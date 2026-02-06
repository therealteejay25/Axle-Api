import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { logger } from "../services/logger";
import { makeLinearRequest } from "../lib/api";

/**
 * Base class for Linear tools that handles API requests internally
 */
export abstract class BaseLinearTool {
    protected userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    protected createTool<T extends z.ZodType>(
        name: string,
        description: string,
        schema: T,
        executeFn: (params: z.infer<T>) => Promise<any>
    ): FunctionTool {
        return new FunctionTool({
            name,
            description,
            parameters: schema as any,
            execute: async (input: unknown) => {
                try {
                    const params = schema.parse(input);
                    return await executeFn(params);
                } catch (error: any) {
                    logger.error(`[${name.toUpperCase()}] Tool execution failed:`, error);

                    // Handle integration/connection errors
                    if (
                        error.message?.includes("not connected") ||
                        error.message?.includes("authentication") ||
                        error.message?.includes("Unauthorized") ||
                        error.message?.includes("401") ||
                        error.message?.includes("403")
                    ) {
                        return {
                            success: false,
                            error: "Your Linear connection needs to be refreshed. Please reconnect your account and try again.",
                            needsReauth: true,
                        };
                    }

                    return {
                        success: false,
                        error: error.message || `Failed to execute ${name}`,
                    };
                }
            },
        });
    }

    protected async executeLinearRequest(
        query: string,
        variables: Record<string, any> = {}
    ): Promise<any> {
        return makeLinearRequest(this.userId, "/graphql", {
            method: "POST",
            body: JSON.stringify({ query, variables }),
        });
    }
}
