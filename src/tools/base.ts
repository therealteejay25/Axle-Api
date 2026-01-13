import { FunctionTool } from "@google/adk";
import { z, ZodSchema } from "zod";
import { logger } from "../services/logger";
import { makeGoogleRequest, makeGithubRequest, makeTwitterRequest } from "../lib/api";

/**
 * Base class for Google tools that handles API requests internally
 */
export abstract class BaseGoogleTool {
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
          if (error.message?.includes("not connected") ||
            error.message?.includes("authentication expired")) {
            return {
              success: false,
              error: "Please connect your Google account to use this action.",
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

  protected async executeGoogleRequest<T>(
    apiCall: (oauth2Client: any) => Promise<T>
  ): Promise<T> {
    return makeGoogleRequest(this.userId, apiCall);
  }
}

/**
 * Base class for GitHub tools that handles API requests internally
 */
export abstract class BaseGithubTool {
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
          if (error.message?.includes("not connected") ||
            error.message?.includes("authentication")) {
            return {
              success: false,
              error: "Please connect your GitHub account to use this action.",
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

  protected async executeGithubRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    return makeGithubRequest(this.userId, endpoint, options);
  }
}

/**
 * Base class for X (Twitter) tools that handles API requests internally
 */
export abstract class BaseXTool {
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
          if (error.message?.includes("not connected") ||
            error.message?.includes("authentication")) {
            return {
              success: false,
              error: "Please connect your X (Twitter) account to use this action.",
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

  protected async executeTwitterRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    return makeTwitterRequest(this.userId, endpoint, options);
  }
}
