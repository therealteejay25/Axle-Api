"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callAI = void 0;
const openai_1 = __importDefault(require("openai"));
const env_1 = require("../config/env");
const logger_1 = require("../services/logger");
const openai = new openai_1.default({
    apiKey: env_1.env.OPENAI_KEY,
    baseURL: env_1.env.OPENAI_API_BASE
});
const callAI = async (systemPrompt, model = "gpt-4o", temperature = 0.7, maxTokens = 1024) => {
    const startTime = Date.now();
    try {
        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: "system", content: systemPrompt }
            ],
            temperature,
            max_tokens: maxTokens,
            response_format: { type: "json_object" }
        });
        const rawResponse = response.choices[0]?.message?.content || "{}";
        const tokensUsed = response.usage?.total_tokens || 0;
        logger_1.logger.debug("AI response received", {
            model,
            tokensUsed,
            latencyMs: Date.now() - startTime
        });
        // Parse and validate response
        const parsed = parseAIResponse(rawResponse);
        return {
            actions: parsed.actions,
            rawResponse,
            tokensUsed
        };
    }
    catch (error) {
        logger_1.logger.error("AI call failed", {
            error: error.message,
            model,
            latencyMs: Date.now() - startTime
        });
        throw new Error(`AI call failed: ${error.message}`);
    }
};
exports.callAI = callAI;
// Parse and validate AI response
const parseAIResponse = (rawResponse) => {
    try {
        const parsed = JSON.parse(rawResponse);
        // Validate structure
        if (!parsed || typeof parsed !== "object") {
            throw new Error("Response is not an object");
        }
        // Ensure actions array exists
        if (!Array.isArray(parsed.actions)) {
            // If no actions array but has action-like properties, wrap it
            if (parsed.type && parsed.params) {
                return { actions: [parsed] };
            }
            return { actions: [] };
        }
        // Validate each action
        const validActions = [];
        for (const action of parsed.actions) {
            if (validateAction(action)) {
                validActions.push({
                    type: action.type,
                    params: action.params || {}
                });
            }
            else {
                logger_1.logger.warn("Invalid action in AI response", { action });
            }
        }
        return { actions: validActions };
    }
    catch (error) {
        logger_1.logger.error("Failed to parse AI response", {
            error: error.message,
            rawResponse: rawResponse.substring(0, 500)
        });
        throw new Error(`Invalid AI response: ${error.message}`);
    }
};
// Validate a single action
const validateAction = (action) => {
    if (!action || typeof action !== "object")
        return false;
    if (typeof action.type !== "string" || action.type.trim() === "")
        return false;
    if (action.params !== undefined && typeof action.params !== "object")
        return false;
    return true;
};
exports.default = { callAI: exports.callAI };
