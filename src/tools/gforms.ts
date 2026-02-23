import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE FORMS TOOL SUITE - COMPREHENSIVE
// ============================================

export class FormsToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Create form
  createCreateFormTool() {
    return this.createTool(
      "gforms_create_form",
      "Create a new Google Form",
      z.object({
        title: z.string().min(1, "Form title is required"),
        documentTitle: z.string().optional().describe("Document title (defaults to title)"),
      }),
      async ({ title, documentTitle }) => {
        try {
          logger.info(`[FORMS] Creating form: ${title}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const forms = google.forms({ version: "v1", auth: oauth2Client });

            return await forms.forms.create({
              requestBody: {
                info: {
                  title,
                  documentTitle: documentTitle || title,
                },
              },
            });
          });

          logger.info(`[FORMS] Form created: ${result.data.formId}`);

          return {
            success: true,
            message: `Form "${title}" created successfully`,
            data: {
              formId: result.data.formId,
              responderUri: result.data.responderUri,
              title: result.data.info?.title,
            },
          };
        } catch (error: any) {
          logger.error("[FORMS] Create form failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create form",
          };
        }
      }
    );
  }

  // Get form
  createGetFormTool() {
    return this.createTool(
      "gforms_get_form",
      "Get form details including questions and settings",
      z.object({
        formId: z.string().min(1, "Form ID is required"),
      }),
      async ({ formId }) => {
        try {
          logger.info(`[FORMS] Getting form: ${formId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const forms = google.forms({ version: "v1", auth: oauth2Client });

            return await forms.forms.get({
              formId,
            });
          });

          logger.info(`[FORMS] Retrieved form: ${result.data.info?.title}`);

          return {
            success: true,
            data: {
              formId: result.data.formId,
              info: result.data.info,
              settings: result.data.settings,
              items: result.data.items,
              responderUri: result.data.responderUri,
              revisionId: result.data.revisionId,
            },
          };
        } catch (error: any) {
          logger.error("[FORMS] Get form failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get form",
          };
        }
      }
    );
  }

  // Get responses
  createGetResponsesTool() {
    return this.createTool(
      "gforms_get_responses",
      "Get all responses for a form",
      z.object({
        formId: z.string().min(1, "Form ID is required"),
        filter: z.string().optional().describe("Filter responses (e.g., 'timestamp > 2024-01-01')"),
      }),
      async ({ formId, filter }) => {
        try {
          logger.info(`[FORMS] Getting responses for form: ${formId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const forms = google.forms({ version: "v1", auth: oauth2Client });

            return await forms.forms.responses.list({
              formId,
              filter,
            });
          });

          const responses = result.data.responses || [];
          logger.info(`[FORMS] Found ${responses.length} responses`);

          return {
            success: true,
            data: {
              responses: responses.map((response: any) => ({
                responseId: response.responseId,
                createTime: response.createTime,
                lastSubmittedTime: response.lastSubmittedTime,
                respondentEmail: response.respondentEmail,
                answers: response.answers,
              })),
              totalCount: responses.length,
            },
          };
        } catch (error: any) {
          logger.error("[FORMS] Get responses failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get responses",
          };
        }
      }
    );
  }

  // Get specific response
  createGetResponseTool() {
    return this.createTool(
      "gforms_get_response",
      "Get a specific form response by ID",
      z.object({
        formId: z.string().min(1, "Form ID is required"),
        responseId: z.string().min(1, "Response ID is required"),
      }),
      async ({ formId, responseId }) => {
        try {
          logger.info(`[FORMS] Getting response: ${responseId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const forms = google.forms({ version: "v1", auth: oauth2Client });

            return await forms.forms.responses.get({
              formId,
              responseId,
            });
          });

          logger.info(`[FORMS] Retrieved response`);

          return {
            success: true,
            data: {
              responseId: result.data.responseId,
              createTime: result.data.createTime,
              lastSubmittedTime: result.data.lastSubmittedTime,
              respondentEmail: result.data.respondentEmail,
              answers: result.data.answers,
            },
          };
        } catch (error: any) {
          logger.error("[FORMS] Get response failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get response",
          };
        }
      }
    );
  }

  // Get response count
  createGetResponseCountTool() {
    return this.createTool(
      "gforms_get_response_count",
      "Get the total number of responses for a form",
      z.object({
        formId: z.string().min(1, "Form ID is required"),
      }),
      async ({ formId }) => {
        try {
          logger.info(`[FORMS] Getting response count for form: ${formId}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const forms = google.forms({ version: "v1", auth: oauth2Client });

            return await forms.forms.responses.list({
              formId,
            });
          });

          const responses = result.data.responses || [];
          const count = responses.length;

          logger.info(`[FORMS] Form has ${count} responses`);

          return {
            success: true,
            data: {
              formId,
              responseCount: count,
            },
          };
        } catch (error: any) {
          logger.error("[FORMS] Get response count failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get response count",
          };
        }
      }
    );
  }
}

// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

export const createCreateFormTool = (userId: string) =>
  new FormsToolSuite(userId).createCreateFormTool();

export const createGetFormTool = (userId: string) =>
  new FormsToolSuite(userId).createGetFormTool();

export const createGetResponsesTool = (userId: string) =>
  new FormsToolSuite(userId).createGetResponsesTool();

export const createGetResponseTool = (userId: string) =>
  new FormsToolSuite(userId).createGetResponseTool();

export const createGetResponseCountTool = (userId: string) =>
  new FormsToolSuite(userId).createGetResponseCountTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createFormsTools = (userId: string) => {
  const suite = new FormsToolSuite(userId);
  return [
    suite.createCreateFormTool(),
    suite.createGetFormTool(),
    suite.createGetResponsesTool(),
    suite.createGetResponseTool(),
    suite.createGetResponseCountTool(),
  ];
};
