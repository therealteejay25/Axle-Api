"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toExecutionActions = exports.executeActions = void 0;
const registry_1 = require("../adapters/registry");
const logger_1 = require("../services/logger");
const executeActions = async (actions, loaded, allowedActions) => {
    const results = [];
    for (const action of actions) {
        const startedAt = new Date();
        // Validate action is allowed
        if (!allowedActions.includes(action.type)) {
            logger_1.logger.warn("Action not allowed", {
                type: action.type,
                allowed: allowedActions
            });
            results.push({
                type: action.type,
                params: action.params,
                error: `Action "${action.type}" is not allowed for this agent`,
                startedAt,
                finishedAt: new Date()
            });
            continue;
        }
        try {
            logger_1.logger.info("Executing action", {
                type: action.type,
                params: sanitizeParams(action.params)
            });
            // Execute the action via adapter registry
            const result = await (0, registry_1.executeAction)(action.type, action.params, loaded.integrations);
            results.push({
                type: action.type,
                params: action.params,
                result,
                startedAt,
                finishedAt: new Date()
            });
            logger_1.logger.info("Action completed", {
                type: action.type,
                success: true
            });
        }
        catch (error) {
            logger_1.logger.error("Action failed", {
                type: action.type,
                error: error.message
            });
            results.push({
                type: action.type,
                params: action.params,
                error: error.message,
                startedAt,
                finishedAt: new Date()
            });
        }
    }
    return results;
};
exports.executeActions = executeActions;
// Convert results to execution action format
const toExecutionActions = (results) => {
    return results.map(r => ({
        type: r.type,
        params: r.params,
        result: r.result,
        error: r.error,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt
    }));
};
exports.toExecutionActions = toExecutionActions;
// Remove sensitive data from params for logging
const sanitizeParams = (params) => {
    const sanitized = { ...params };
    const sensitiveKeys = ["password", "token", "secret", "key", "auth"];
    for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
            sanitized[key] = "[REDACTED]";
        }
    }
    return sanitized;
};
exports.default = { executeActions: exports.executeActions, toExecutionActions: exports.toExecutionActions };
