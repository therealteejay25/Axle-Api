/**
 * TOOL DEFINITION TEMPLATE
 * 
 * This file documents the exact pattern used for all tools in the Axle API.
 * Use this as a reference when creating new tools to ensure consistency.
 * 
 * PATTERN OVERVIEW:
 * 1. Tools are organized into "Tool Suites" - classes that extend a Base class
 * 2. Each suite has methods that create individual tools
 * 3. Tools use Zod schemas for parameter validation
 * 4. Tools return standardized response objects with success/error handling
 * 5. Factory functions export individual tool creators
 * 6. A main export function returns all tools as an array
 */

import { z } from "zod";
import { logger } from "../../services/logger";
import { 
  BaseGoogleTool,    // For Google API tools (Gmail, Drive, Calendar, Sheets, Docs)
  BaseGithubTool,    // For GitHub API tools
  BaseXTool,         // For X/Twitter API tools
  BaseSlackTool,     // For Slack API tools
  BaseNotionTool,    // For Notion API tools
} from "../base";
import { FunctionTool } from "@google/adk";

// ============================================
// PATTERN 1: INTEGRATION-BASED TOOL SUITE
// ============================================
// Use this pattern for tools that require OAuth/API authentication
// Extends one of the Base classes which handles auth and API requests

/**
 * Example Tool Suite for an integration (e.g., Gmail, GitHub, Slack)
 * 
 * KEY CHARACTERISTICS:
 * - Extends a Base class (BaseGoogleTool, BaseGithubTool, etc.)
 * - Constructor takes userId for authentication
 * - Uses this.createTool() helper from base class
 * - Uses this.executeGoogleRequest() or similar for API calls
 */
export class ExampleIntegrationToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  /**
   * Individual tool creation method
   * 
   * NAMING CONVENTION:
   * - Method name: create{ActionName}Tool (e.g., createSendEmailTool)
   * - Tool name: {service}_{action} (e.g., gmail_send_email)
   * 
   * STRUCTURE:
   * 1. Define Zod schema for parameters
   * 2. Call this.createTool() with name, description, schema, and execute function
   * 3. Execute function receives validated params
   * 4. Use this.executeGoogleRequest() (or similar) for API calls
   * 5. Return standardized response object
   */
  createExampleActionTool() {
    return this.createTool(
      "service_action_name",  // Tool name: lowercase, underscore-separated
      "Clear, concise description of what this tool does",  // User-facing description
      z.object({
        // Define parameters with Zod validation
        requiredParam: z.string().min(1, "Error message if validation fails"),
        optionalParam: z.string().optional().describe("Description for optional param"),
        numberParam: z.number().min(1).max(100).default(10).describe("Number with constraints"),
        enumParam: z.enum(["option1", "option2"]).optional().default("option1"),
        arrayParam: z.array(z.string()).optional().describe("Array of strings"),
      }),
      async ({ requiredParam, optionalParam, numberParam, enumParam, arrayParam }) => {
        // Log the action
        logger.info(`[SERVICE] Performing action with ${requiredParam}`);

        // Execute API request using base class helper
        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          // Import API library inside the function
          const { google } = await import("googleapis");
          const service = google.gmail({ version: "v1", auth: oauth2Client });

          // Make API call
          return await service.users.messages.send({
            userId: "me",
            requestBody: {
              // ... API-specific parameters
            },
          });
        });

        // Log success
        logger.info(`[SERVICE] Action completed successfully`);

        // Return standardized response
        return {
          success: true,
          message: "Human-readable success message",
          // Include relevant data from the API response
          data: {
            id: result.data.id,
            // ... other relevant fields
          },
        };
      }
    );
  }

  // Additional tool methods follow the same pattern...
}

// ============================================
// PATTERN 2: STANDALONE TOOL (NO AUTH)
// ============================================
// Use this pattern for tools that don't require authentication
// Examples: web search, memory tools, control tools

/**
 * Standalone tool creation function
 * 
 * KEY CHARACTERISTICS:
 * - Direct FunctionTool instantiation (no base class)
 * - May take userId and/or agentId as parameters
 * - Handles its own error management
 * - Returns FunctionTool directly
 */
export const createStandaloneExampleTool = (userId: string, agentId?: string) => {
  return new FunctionTool({
    name: "tool_name",
    description: "Clear description of what this tool does",
    parameters: z.object({
      param1: z.string().describe("Parameter description"),
      param2: z.number().optional().default(10),
    }),
    execute: async (input: unknown) => {
      try {
        // Parse and validate input
        const { param1, param2 } = input as { param1: string; param2?: number };

        // Log the action
        logger.info(`[TOOL] Executing action with ${param1}`);

        // Perform the action (may involve service calls, database operations, etc.)
        // const result = await SomeService.doSomething(param1, param2);

        // Return standardized response
        return {
          success: true,
          message: "Action completed successfully",
          // Include relevant data
        };
      } catch (error: any) {
        logger.error("[TOOL] Action failed:", error);
        return {
          success: false,
          error: error.message || "Failed to execute action",
        };
      }
    },
  });
};

// ============================================
// FACTORY FUNCTIONS
// ============================================
// Export individual tool creators for use in registry

/**
 * Factory function for each tool in the suite
 * 
 * NAMING CONVENTION:
 * - Function name matches the method name (e.g., createSendEmailTool)
 * - Takes userId as parameter
 * - Instantiates suite and calls the specific tool method
 */
export const createExampleActionTool = (userId: string) =>
  new ExampleIntegrationToolSuite(userId).createExampleActionTool();

// Export additional factory functions for each tool...

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
// Export all tools from the suite as an array

/**
 * Main export function that returns all tools in the suite
 * 
 * USAGE:
 * - Used in registry.ts to import all tools at once
 * - Instantiates suite once and calls all tool methods
 * - Returns array of FunctionTool instances
 */
export const createExampleTools = (userId: string) => {
  const suite = new ExampleIntegrationToolSuite(userId);
  return [
    suite.createExampleActionTool(),
    // ... all other tools
  ];
};

// ============================================
// RESPONSE PATTERNS
// ============================================

/**
 * SUCCESS RESPONSE PATTERN:
 * {
 *   success: true,
 *   message: "Human-readable success message",
 *   data: {
 *     // Relevant data from the operation
 *     id: "...",
 *     // ... other fields
 *   }
 * }
 */

/**
 * ERROR RESPONSE PATTERN:
 * {
 *   success: false,
 *   error: "Human-readable error message",
 *   needsReauth?: true  // Optional: indicates auth needs to be refreshed
 * }
 */

// ============================================
// INTEGRATION-SPECIFIC PATTERNS
// ============================================

/**
 * GOOGLE TOOLS (Gmail, Drive, Calendar, Sheets, Docs):
 * - Extend BaseGoogleTool
 * - Use this.executeGoogleRequest(async (oauth2Client) => { ... })
 * - Import googleapis inside the execute function
 * - Tool names: gmail_*, drive_*, calendar_*, sheets_*, docs_*
 */

/**
 * GITHUB TOOLS:
 * - Extend BaseGithubTool
 * - Use this.executeGithubRequest(endpoint, options)
 * - Tool names: github_*
 */

/**
 * X/TWITTER TOOLS:
 * - Extend BaseXTool
 * - Use this.executeTwitterRequest(endpoint, options)
 * - Tool names: twitter_*
 */

/**
 * SLACK TOOLS:
 * - Extend BaseSlackTool
 * - Use this.executeSlackRequest(async (client) => { ... })
 * - Tool names: slack_*
 */

/**
 * NOTION TOOLS:
 * - Extend BaseNotionTool
 * - Tool names: notion_*
 */

// ============================================
// CHECKLIST FOR NEW TOOLS
// ============================================

/**
 * When creating a new tool, ensure:
 * 
 * 1. ✅ Tool name follows convention: {service}_{action}
 * 2. ✅ Description is clear and concise
 * 3. ✅ Zod schema validates all parameters
 * 4. ✅ Required parameters have validation error messages
 * 5. ✅ Optional parameters have .optional() and .describe()
 * 6. ✅ Logging uses [SERVICE] prefix
 * 7. ✅ API calls use appropriate base class helper
 * 8. ✅ Response follows success/error pattern
 * 9. ✅ Factory function is exported
 * 10. ✅ Tool is added to main export function
 * 11. ✅ Tool is registered in registry.ts
 */
