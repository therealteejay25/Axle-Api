"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateActionParams = exports.executeAction = exports.getActionsForIntegrations = exports.getAvailableActions = void 0;
const github_1 = require("./github");
const slack_1 = require("./slack");
const twitter_1 = require("./twitter");
const instagram_1 = require("./instagram");
const email_1 = require("./email");
const google_1 = require("./google");
const http_1 = require("./http");
const scraper_1 = require("./scraper");
const research_1 = require("./research");
const logger_1 = require("../services/logger");
const env_1 = require("../config/env");
const paramRepair_1 = require("./paramRepair");
// Map action prefixes to required integrations
const actionIntegrationMap = {
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
const allActions = {
    ...github_1.githubActions,
    ...slack_1.slackActions,
    ...twitter_1.xActions,
    ...instagram_1.instagramActions,
    ...email_1.emailActions,
    ...google_1.googleActions,
    ...http_1.httpActions,
    ...scraper_1.scraperActions,
    ...research_1.researchActions
};
// Get list of all available actions
const getAvailableActions = () => {
    return Object.keys(allActions);
};
exports.getAvailableActions = getAvailableActions;
// Get actions available for given integrations
const getActionsForIntegrations = (integrations) => {
    const available = [];
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
                env_1.env.RESEND_API_KEY ||
                (env_1.env.SMTP_HOST && env_1.env.SMTP_USER)) {
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
exports.getActionsForIntegrations = getActionsForIntegrations;
// Execute an action
const executeAction = async (actionType, params, integrations) => {
    // ============================================
    // VALIDATE PARAMETERS FIRST
    // ============================================
    // Use tool validator to check schema and detect hallucinations
    const { validateToolParams, generateErrorMessage } = require('./toolValidator');
    let effectiveParams = params;
    let validation = validateToolParams(actionType, effectiveParams);
    if (!validation.valid) {
        const repaired = (0, paramRepair_1.repairToolParams)(actionType, effectiveParams, validation);
        if (repaired.repaired) {
            logger_1.logger.info('Tool params repaired', {
                actionType,
                notes: repaired.notes
            });
            effectiveParams = repaired.params;
            validation = validateToolParams(actionType, effectiveParams);
        }
    }
    if (!validation.valid) {
        const errorMessage = generateErrorMessage(actionType, validation);
        logger_1.logger.warn('Tool validation failed', {
            actionType,
            errors: validation.errors,
            hallucinated: validation.hallucinated
        });
        throw new Error(errorMessage);
    }
    // ============================================
    // EXECUTE ACTION
    // ============================================
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
        if (env_1.env.RESEND_API_KEY || (env_1.env.SMTP_HOST && env_1.env.SMTP_USER)) {
            requiredProvider = ""; // No DB integration required, use Env
        }
        // Fallback to Google if connected
        else if (integrations.has("google")) {
            requiredProvider = "google";
        }
        // Fallback to Email integration if connected
        else if (integrations.has("email")) {
            requiredProvider = "email";
        }
        else {
            requiredProvider = "email"; // Default to email to show missing error
        }
    }
    else {
        for (const [prefix, provider] of Object.entries(actionIntegrationMap)) {
            if (actionType.startsWith(prefix)) {
                requiredProvider = provider;
                break;
            }
        }
    }
    // Get integration data
    let integration;
    if (requiredProvider) {
        const integrationData = integrations.get(requiredProvider);
        if (!integrationData) {
            throw new Error(`Integration not connected: ${requiredProvider}`);
        }
        integration = integrationData;
    }
    else {
        // For actions that don't need integration (e.g., HTTP or Resend/SMTP via env)
        integration = {
            provider: "none",
            accessToken: "",
            scopes: [],
            metadata: {}
        };
    }
    logger_1.logger.debug("Executing action", { actionType, provider: requiredProvider });
    // Execute the action (with a single retry for transient errors)
    try {
        return await handler(effectiveParams, integration);
    }
    catch (err) {
        if ((0, paramRepair_1.isRetryableToolError)(err)) {
            logger_1.logger.warn("Retrying tool after transient failure", { actionType, error: err.message });
            return await handler(effectiveParams, integration);
        }
        throw err;
    }
};
exports.executeAction = executeAction;
// Validate action params (basic validation)
const validateActionParams = (actionType, params) => {
    const errors = [];
    // Action-specific validation
    if (actionType === "slack_send_message") {
        if (!params.channel)
            errors.push("channel is required");
        if (!params.text)
            errors.push("text is required");
    }
    if (actionType === "github_create_issue") {
        if (!params.owner)
            errors.push("owner is required");
        if (!params.repo)
            errors.push("repo is required");
        if (!params.title)
            errors.push("title is required");
    }
    if (actionType === "twitter_post_tweet") {
        if (!params.text)
            errors.push("text is required");
        if (params.text && params.text.length > 280)
            errors.push("text exceeds 280 characters");
    }
    if (actionType === "email_send") {
        if (!params.to)
            errors.push("to is required");
        if (!params.subject)
            errors.push("subject is required");
        if (!params.text && !params.html)
            errors.push("text or html is required");
    }
    if (actionType.startsWith("http_")) {
        if (!params.url)
            errors.push("url is required");
    }
    // Instagram validation
    if (actionType.startsWith("ig_")) {
        if (actionType === "ig_get_profile" || actionType === "ig_get_posts") {
            if (!params.igUserId)
                errors.push("igUserId is required");
        }
    }
    // X validation
    if (actionType.startsWith("x_")) {
        if (actionType === "x_post_tweet" && !params.text)
            errors.push("text is required");
    }
    return { valid: errors.length === 0, errors };
};
exports.validateActionParams = validateActionParams;
exports.default = {
    executeAction: exports.executeAction,
    getAvailableActions: exports.getAvailableActions,
    getActionsForIntegrations: exports.getActionsForIntegrations,
    validateActionParams: exports.validateActionParams
};
