import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { logger } from "../services/logger";
import { makeFigmaRequest } from "../lib/api";

/**
 * Base class for Figma tools that handles API requests internally
 */
export abstract class BaseFigmaTool {
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
                        error.message?.includes("403") ||
                        error.message?.includes("401")
                    ) {
                        return {
                            success: false,
                            error: "Your Figma connection needs to be refreshed. Please reconnect your account and try again.",
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

    protected async executeFigmaRequest(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<any> {
        return makeFigmaRequest(this.userId, endpoint, options);
    }
}
