import { FunctionTool } from "@google/adk";
import { z, ZodSchema } from "zod";
import { logger } from "../services/logger";
import { makeGoogleRequest, makeGithubRequest, makeTwitterRequest, makeSlackRequest } from "../lib/api";
import { WebClient } from "@slack/web-api";

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
              error: "Please connect your account to use this action.",
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
          if (
            error.message?.includes("not connected") ||
            error.message?.includes("authentication") ||
            error.message?.includes("Unauthorized") ||
            error.message?.includes("401")
          ) {
            return {
              success: false,
              error: "Your X (Twitter) connection needs to be refreshed. Please reconnect your account and try again.",
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
/**
 * Base class for Slack tools that handles API requests internally
 */
export abstract class BaseSlackTool {
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
            error.message?.includes("401")
          ) {
            return {
              success: false,
              error: "Your Slack connection needs to be refreshed. Please reconnect your account and try again.",
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

  protected async executeSlackRequest(
    apiCall: (client: WebClient) => Promise<any>
  ): Promise<any> {
    return makeSlackRequest(this.userId, apiCall);
  }
}
