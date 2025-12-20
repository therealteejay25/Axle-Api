"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateActionParams = exports.executeAction = exports.getActionsForIntegrations = exports.getAvailableActions = void 0;
const github_1 = require("./github");
const slack_1 = require("./slack");
const twitter_1 = require("./twitter");
const email_1 = require("./email");
const google_1 = require("./google");
const http_1 = require("./http");
const logger_1 = require("../services/logger");
// Map action prefixes to required integrations
const actionIntegrationMap = {
    github_: "github",
    slack_: "slack",
    twitter_: "twitter",
    google_: "google",
    email_: "email",
    http_: "" // HTTP doesn't require integration
};
// Combine all action handlers
const allActions = {
    ...github_1.githubActions,
    ...slack_1.slackActions,
    ...twitter_1.twitterActions,
    ...email_1.emailActions,
    ...google_1.googleActions,
    ...http_1.httpActions
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
    let integration;
    if (requiredProvider) {
        const integrationData = integrations.get(requiredProvider);
        if (!integrationData) {
            throw new Error(`Integration not connected: ${requiredProvider}`);
        }
        integration = integrationData;
    }
    else {
        // For actions that don't need integration (e.g., HTTP)
        integration = {
            provider: "none",
            accessToken: "",
            scopes: [],
            metadata: {}
        };
    }
    logger_1.logger.debug("Executing action", { actionType, provider: requiredProvider });
    // Execute the action
    return handler(params, integration);
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
    return { valid: errors.length === 0, errors };
};
exports.validateActionParams = validateActionParams;
exports.default = {
    executeAction: exports.executeAction,
    getAvailableActions: exports.getAvailableActions,
    getActionsForIntegrations: exports.getActionsForIntegrations,
    validateActionParams: exports.validateActionParams
};
