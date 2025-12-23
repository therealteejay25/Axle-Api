import { githubActions } from "./github";
import { slackActions } from "./slack";
import { xActions } from "./twitter";
import { instagramActions } from "./instagram";
import { emailActions } from "./email";
import { googleActions } from "./google";
import { httpActions } from "./http";
import { scraperActions } from "./scraper";
import { researchActions } from "./research";
import { logger } from "../services/logger";
import { env } from "../config/env";

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
  x_: "twitter",
  ig_: "instagram",
  google_: "google",
  email_: "email",
  http_: "", 
  scraper_: "", 
  research_: "" 
};

// Combine all action handlers
const allActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  ...githubActions,
  ...slackActions,
  ...xActions,
  ...instagramActions,
  ...emailActions,
  ...googleActions,
  ...httpActions,
  ...scraperActions,
  ...researchActions
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
    
    // Special case: email actions available if google is connected 
    // OR if env vars are set (Resend/SMTP)
    if (actionName.startsWith("email_")) {
      if (integrations.includes("google") || 
          env.RESEND_API_KEY || 
          (env.SMTP_HOST && env.SMTP_USER)) {
        available.push(actionName);
        continue;
      }
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
  
  // Special handling for email fallback to google or env
  if (actionType.startsWith("email_")) {
     // Check Env for Resend/SMTP first (Priority!)
     // If env vars exist, we prioritize this (provider = "") to force usage of env logic in adapter
     if (env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER)) {
        requiredProvider = ""; // No DB integration required, use Env
     } 
     // Fallback to Google if connected
     else if (integrations.has("google")) {
       requiredProvider = "google";
     } 
     // Fallback to Email integration if connected
     else if (integrations.has("email")) {
       requiredProvider = "email";
     } else {
       requiredProvider = "email"; // Default to email to show missing error
     }
  } else {
    for (const [prefix, provider] of Object.entries(actionIntegrationMap)) {
      if (actionType.startsWith(prefix)) {
        requiredProvider = provider;
        break;
      }
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
    // For actions that don't need integration (e.g., HTTP or Resend/SMTP via env)
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

  // Instagram validation
  if (actionType.startsWith("ig_")) {
    if (actionType === "ig_get_profile" || actionType === "ig_get_posts") {
        if (!params.igUserId) errors.push("igUserId is required");
    }
  }

  // X validation
  if (actionType.startsWith("x_")) {
    if (actionType === "x_post_tweet" && !params.text) errors.push("text is required");
  }
  
  return { valid: errors.length === 0, errors };
};

export default {
  executeAction,
  getAvailableActions,
  getActionsForIntegrations,
  validateActionParams
};
