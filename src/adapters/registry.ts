import { githubActions } from "./github";
import { slackActions } from "./slack";
import { twitterActions } from "./twitter";
import { emailActions } from "./email";
import { googleActions } from "./google";
import { httpActions } from "./http";
import { logger } from "../services/logger";

// ============================================
// ACTION REGISTRY
// ============================================
// Central registry mapping action types to adapters.
// All actions go through this registry.
// ============================================

interface IntegrationData {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
}

type IntegrationMap = Map<string, IntegrationData>;

// Map action prefixes to required integrations
const actionIntegrationMap: Record<string, string> = {
  github_: "github",
  slack_: "slack",
  twitter_: "twitter",
  google_: "google",
  email_: "email",
  http_: "" // HTTP doesn't require integration
};

// Combine all action handlers
const allActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  ...githubActions,
  ...slackActions,
  ...twitterActions,
  ...emailActions,
  ...googleActions,
  ...httpActions
};

// Get list of all available actions
export const getAvailableActions = (): string[] => {
  return Object.keys(allActions);
};

// Get actions available for given integrations
export const getActionsForIntegrations = (integrations: string[]): string[] => {
  const available: string[] = [];
  
  for (const actionName of Object.keys(allActions)) {
    // HTTP actions always available
    if (actionName.startsWith("http_")) {
      available.push(actionName);
      continue;
    }
    
    // Check if required integration is connected
    for (const [prefix, provider] of Object.entries(actionIntegrationMap)) {
      if (actionName.startsWith(prefix) && integrations.includes(provider)) {
        available.push(actionName);
        break;
      }
    }
  }
  
  return available;
};

// Execute an action
export const executeAction = async (
  actionType: string,
  params: Record<string, any>,
  integrations: IntegrationMap
): Promise<any> => {
  const handler = allActions[actionType];
  
  if (!handler) {
    throw new Error(`Unknown action type: ${actionType}`);
  }
  
  // Find required integration
  let requiredProvider = "";
  for (const [prefix, provider] of Object.entries(actionIntegrationMap)) {
    if (actionType.startsWith(prefix)) {
      requiredProvider = provider;
      break;
    }
  }
  
  // Get integration data
  let integration: IntegrationData;
  
  if (requiredProvider) {
    const integrationData = integrations.get(requiredProvider);
    if (!integrationData) {
      throw new Error(`Integration not connected: ${requiredProvider}`);
    }
    integration = integrationData;
  } else {
    // For actions that don't need integration (e.g., HTTP)
    integration = {
      provider: "none",
      accessToken: "",
      scopes: [],
      metadata: {}
    };
  }
  
  logger.debug("Executing action", { actionType, provider: requiredProvider });
  
  // Execute the action
  return handler(params, integration);
};

// Validate action params (basic validation)
export const validateActionParams = (
  actionType: string,
  params: Record<string, any>
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Action-specific validation
  if (actionType === "slack_send_message") {
    if (!params.channel) errors.push("channel is required");
    if (!params.text) errors.push("text is required");
  }
  
  if (actionType === "github_create_issue") {
    if (!params.owner) errors.push("owner is required");
    if (!params.repo) errors.push("repo is required");
    if (!params.title) errors.push("title is required");
  }
  
  if (actionType === "twitter_post_tweet") {
    if (!params.text) errors.push("text is required");
    if (params.text && params.text.length > 280) errors.push("text exceeds 280 characters");
  }
  
  if (actionType === "email_send") {
    if (!params.to) errors.push("to is required");
    if (!params.subject) errors.push("subject is required");
    if (!params.text && !params.html) errors.push("text or html is required");
  }
  
  if (actionType.startsWith("http_")) {
    if (!params.url) errors.push("url is required");
  }
  
  return { valid: errors.length === 0, errors };
};

export default {
  executeAction,
  getAvailableActions,
  getActionsForIntegrations,
  validateActionParams
};
