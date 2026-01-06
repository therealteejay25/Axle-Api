"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toExecutionActions = exports.executeSingleAction = exports.executeActions = void 0;
const registry_1 = require("../adapters/registry");
const logger_1 = require("../services/logger");
const SocketService_1 = require("../services/SocketService");
const ExecutionEventService_1 = require("../services/ExecutionEventService");
const executeActions = async (actions, loaded, allowedActions, executionId, agentId) => {
    const results = [];
    // SIMPLIFIED UX: If allowedActions is empty, allow ALL actions
    const checkActionAllowed = allowedActions.length > 0;
    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const startedAt = new Date();
        if (executionId) {
            await ExecutionEventService_1.ExecutionEventService.log({
                executionId,
                agentId,
                userId: loaded.user?._id?.toString?.() || loaded.user?.id,
                type: "action_started",
                level: "info",
                message: action.type,
                actionType: action.type,
                actionIndex: i,
                data: { params: action.params }
            });
        }
        // Emit progress event - action started
        if (executionId && agentId) {
            SocketService_1.SocketService.getInstance().emitToAgent(agentId, "execution:action_started", {
                executionId,
                actionType: action.type,
                actionIndex: i,
                totalActions: actions.length
            });
        }
        // Validate action is allowed (only if specific actions are configured)
        if (checkActionAllowed && !allowedActions.includes(action.type)) {
            logger_1.logger.warn("Action not allowed", {
                type: action.type,
                allowed: allowedActions
            });
            const result = {
                type: action.type,
                params: action.params,
                error: `Action "${action.type}" is not allowed for this agent`,
                startedAt,
                finishedAt: new Date()
            };
            results.push(result);
            // Emit progress event - action failed
            if (executionId && agentId) {
                SocketService_1.SocketService.getInstance().emitToAgent(agentId, "execution:action_completed", {
                    executionId,
                    actionType: action.type,
                    success: false,
                    error: result.error
                });
            }
            continue;
        }
        try {
            // Resolve params using results from previous actions
            const resolvedParams = resolveParams(action.params, results, loaded);
            // ============================================
            // CAPABILITY LAYER INTERCEPTION
            // ============================================
            // Check if this is a new capability-based action
            const capabilityExecutor = require('../capabilities/executor');
            const capabilityAction = capabilityExecutor.getAction(action.type);
            let result;
            let toolsCalled = [];
            let verified = undefined;
            if (capabilityAction) {
                // Execute via capability layer
                logger_1.logger.info("Routing to capability layer", {
                    type: action.type,
                    capability: capabilityAction.capability
                });
                if (executionId) {
                    await ExecutionEventService_1.ExecutionEventService.log({
                        executionId,
                        agentId,
                        userId: loaded.user?._id?.toString?.() || loaded.user?.id,
                        type: "action_routed_capability",
                        level: "debug",
                        message: action.type,
                        actionType: action.type,
                        actionIndex: i,
                        data: { capability: capabilityAction.capability }
                    });
                }
                const execContext = {
                    integrations: loaded.integrations,
                    executionId,
                    agentId,
                    previousResults: results.reduce((acc, r) => ({ ...acc, [r.type]: r.result }), {})
                };
                const execResult = await capabilityExecutor.executeAction(action.type, resolvedParams, execContext);
                if (!execResult.success) {
                    throw new Error(execResult.error || 'Action failed in capability layer');
                }
                result = execResult.data;
                toolsCalled = execResult.metadata?.toolsCalled || [];
                verified = execResult.metadata?.verified;
            }
            else {
                // Fallback to legacy registry
                // Execute the action via adapter registry
                result = await (0, registry_1.executeAction)(action.type, resolvedParams, loaded.integrations);
            }
            // ============================================
            // VALIDATE OUTPUT
            // ============================================
            const { validateActionOutput } = require('./dataIntegrity');
            const { getOutputContract } = require('./outputContracts');
            const contract = getOutputContract(action.type);
            let outputValidation = null;
            if (contract.length > 0) {
                outputValidation = validateActionOutput(action.type, result, contract);
                if (!outputValidation.valid) {
                    logger_1.logger.warn('Output validation failed', {
                        action: action.type,
                        errors: outputValidation.errors,
                        warnings: outputValidation.warnings
                    });
                }
            }
            // ============================================
            const finishedAt = new Date();
            const durationMs = finishedAt.getTime() - startedAt.getTime();
            const actionResult = {
                type: action.type,
                params: resolvedParams,
                result,
                outputValidation, // NEW: Include validation results
                startedAt,
                finishedAt,
                durationMs
            };
            results.push(actionResult);
            logger_1.logger.info("Action completed", {
                type: action.type,
                success: true,
                durationMs,
                outputValid: outputValidation?.valid ?? true
            });
            // Emit progress event - action completed successfully
            if (executionId && agentId) {
                SocketService_1.SocketService.getInstance().emitToAgent(agentId, "execution:action_completed", {
                    executionId,
                    actionType: action.type,
                    success: true,
                    durationMs,
                    outputValidation: outputValidation?.valid ?? true
                });
            }
            if (executionId) {
                await ExecutionEventService_1.ExecutionEventService.log({
                    executionId,
                    agentId,
                    userId: loaded.user?._id?.toString?.() || loaded.user?.id,
                    type: "action_completed",
                    level: outputValidation?.valid === false ? "warn" : "info",
                    message: action.type,
                    actionType: action.type,
                    actionIndex: i,
                    data: {
                        durationMs,
                        outputValidation,
                        toolsCalled,
                        verified,
                        result
                    }
                });
            }
        }
        catch (error) {
            // Get smart suggestion for this error
            const { getSuggestion } = await Promise.resolve().then(() => __importStar(require("../lib/errorSuggestions")));
            const errorSuggestion = getSuggestion(error, action.type);
            const enhancedError = {
                message: error.message,
                suggestion: errorSuggestion.suggestion,
                category: errorSuggestion.category,
                actionable: errorSuggestion.actionable
            };
            logger_1.logger.error("Action failed with context", {
                type: action.type,
                error: error.message,
                suggestion: errorSuggestion.suggestion,
                category: errorSuggestion.category
            });
            const actionResult = {
                type: action.type,
                params: action.params,
                error: `${error.message}\n\n💡 ${errorSuggestion.suggestion}`,
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
                    error: enhancedError.message,
                    suggestion: enhancedError.suggestion
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
                        error: error.message,
                        suggestion: errorSuggestion.suggestion,
                        category: errorSuggestion.category,
                        actionable: errorSuggestion.actionable
                    }
                });
            }
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
