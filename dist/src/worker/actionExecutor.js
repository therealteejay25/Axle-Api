"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toExecutionActions = exports.executeSingleAction = exports.executeActions = void 0;
const logger_1 = require("../services/logger");
const SocketService_1 = require("../services/SocketService");
const ExecutionEventService_1 = require("../services/ExecutionEventService");
const executeActions = async (actions, loaded, allowedActions, executionId, agentId) => {
    // Since all adapters and tools are removed, return empty results with errors
    const results = [];
    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const startedAt = new Date();
        const actionResult = {
            type: action.type,
            params: action.params,
            error: `Action "${action.type}" not available - all tools and adapters have been removed`,
            startedAt,
            finishedAt: new Date()
        };
        results.push(actionResult);
        // Emit progress event - action failed
        if (executionId && agentId) {
            SocketService_1.SocketService.getInstance().emitToAgent(agentId, "execution:action_completed", {
                executionId,
                actionType: action.type,
                success: false,
                error: actionResult.error
            });
        }
        if (executionId) {
            await ExecutionEventService_1.ExecutionEventService.log({
                executionId,
                agentId,
                userId: loaded.user?._id?.toString?.() || loaded.user?.id,
                type: "action_failed",
                level: "error",
                message: action.type,
                actionType: action.type,
                actionIndex: i,
                data: {
                    error: actionResult.error
                }
            });
        }
    }
    return results;
};
exports.executeActions = executeActions;
// ============================================
// SINGLE ACTION EXECUTOR (for iterative mode)
// ============================================
// Executes ONE action and returns result.
// Reuses executeActions logic for consistency.
// Used in THINK→DECIDE→ACT→OBSERVE loop.
// ============================================
const executeSingleAction = async (action, loaded, allowedActions, executionId, agentId) => {
    // Reuse existing multi-action executor with single-item array
    const results = await (0, exports.executeActions)([action], loaded, allowedActions, executionId, agentId);
    return results[0];
};
exports.executeSingleAction = executeSingleAction;
// Resolve templates in params using Nunjucks
const resolveParams = (params, previousResults, loaded) => {
    const safeStringify = (value, maxLen = 2000) => {
        try {
            const str = JSON.stringify(value, null, 2);
            if (typeof str !== "string")
                return String(value);
            return str.length > maxLen ? `${str.slice(0, maxLen)}\n...` : str;
        }
        catch {
            return String(value);
        }
    };
    const decorateForTemplate = (value) => {
        if (!value || typeof value !== "object")
            return value;
        const summaryText = value?.summaryText;
        const hasSummaryText = typeof summaryText === "string" && summaryText.trim().length > 0;
        if (Array.isArray(value)) {
            try {
                Object.defineProperty(value, "toString", {
                    value: () => safeStringify(value),
                    enumerable: false
                });
            }
            catch {
                // ignore
            }
            return value.map(v => decorateForTemplate(v));
        }
        try {
            Object.defineProperty(value, "toString", {
                value: () => (hasSummaryText ? summaryText : safeStringify(value)),
                enumerable: false
            });
        }
        catch {
            // ignore
        }
        for (const [k, v] of Object.entries(value)) {
            value[k] = decorateForTemplate(v);
        }
        return value;
    };
    // Create context from results
    const context = {
        user: loaded.user.toObject ? loaded.user.toObject() : loaded.user,
        agent: loaded.agent.toObject ? loaded.agent.toObject() : loaded.agent
    };
    for (const r of previousResults) {
        if (r.result) {
            context[r.type] = decorateForTemplate(r.result);
        }
    }
    // Use Handlebars for rendering
    const Handlebars = require("handlebars");
    Handlebars.registerHelper("json", (value) => safeStringify(value, 4000));
    Handlebars.registerHelper("pretty", (value) => safeStringify(value, 4000));
    const processValue = (value) => {
        if (typeof value === "string") {
            // Check if it looks like a template (Handlebars or square bracket fallback)
            if (value.includes("{{") || value.includes("{%") || value.includes("[[")) {
                try {
                    // Normalize square brackets to curly braces for Handlebars compatibility
                    const normalizedValue = value.replace(/\[\[/g, "{{").replace(/\]\]/g, "}}");
                    const template = Handlebars.compile(normalizedValue, { noEscape: true });
                    return template(context);
                }
                catch (e) {
                    logger_1.logger.warn("Template render failed", { value, error: e });
                    return value;
                }
            }
            return value;
        }
        else if (Array.isArray(value)) {
            return value.map(v => processValue(v));
        }
        else if (typeof value === "object" && value !== null) {
            const result = {};
            for (const [k, v] of Object.entries(value)) {
                result[k] = processValue(v);
            }
            return result;
        }
        return value;
    };
    return processValue(params);
};
// Convert results to execution action format
const toExecutionActions = (results) => {
    return results.map(r => ({
        type: r.type,
        params: r.params,
        result: r.result,
        error: r.error,
        humanReadableStep: generateHumanReadableStep(r),
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        durationMs: r.durationMs,
        // Persist validation + tool metadata for richer execution timelines
        outputValidation: r.outputValidation ?? null,
        toolsCalled: r.toolsCalled ?? [],
        verified: r.verified
    }));
};
exports.toExecutionActions = toExecutionActions;
// Simple heuristic for human-readable steps
const generateHumanReadableStep = (result) => {
    const type = result.type.replace(/_/g, " ");
    const parts = type.split(" ");
    const platform = parts[0].toUpperCase();
    const action = parts.slice(1).join(" ");
    if (result.error) {
        return `Failed to ${action} on ${platform}: ${result.error}`;
    }
    // Common patterns
    if (type.includes("send message"))
        return `Sent a message to ${result.params.channel || result.params.to}`;
    if (type.includes("post tweet"))
        return `Posted a tweet: "${result.params.text?.substring(0, 30)}..."`;
    if (type.includes("create issue"))
        return `Created GitHub issue: "${result.params.title}"`;
    return `Successfully executed ${action} on ${platform}`;
};
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
