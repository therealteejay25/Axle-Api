"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgentById = exports.buildIntegrationContext = void 0;
const Agent_1 = require("../models/Agent");
const Integration_1 = require("../models/Integration");
const User_1 = require("../models/User");
const main_1 = require("../agent/main");
const crypto_1 = require("../lib/crypto");
const realtime_1 = require("./realtime");
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const redis_1 = __importDefault(require("../lib/redis"));
const bullmq_1 = require("bullmq");
const openai_1 = __importDefault(require("../lib/openai"));
const registry_1 = require("../tools/registry");
const parseModelJson_1 = require("../lib/parseModelJson");
const toolExecutor_1 = require("../lib/toolExecutor");
const buildIntegrationContext = async (userId) => {
    const integrationDocs = await Integration_1.Integration.find({ userId }).lean();
    const context = {};
    integrationDocs.forEach((i) => {
        context[i.name] = {
            ...i,
            accessToken: i.accessToken ? (0, crypto_1.decrypt)(i.accessToken) : undefined,
            refreshToken: i.refreshToken ? (0, crypto_1.decrypt)(i.refreshToken) : undefined,
        };
    });
    return context;
};
exports.buildIntegrationContext = buildIntegrationContext;
/**
 * Run agent with exponential backoff retry logic.
 */
const runAgentById = async (userId, agentId, input, retryAttempt = 0) => {
    const agent = await Agent_1.Agent.findById(agentId);
    if (!agent)
        throw new Error("Agent not found");
    if (agent.ownerId !== userId)
        throw new Error("Unauthorized");
    const context = await (0, exports.buildIntegrationContext)(userId);
    const prompt = input || agent.systemPrompt || agent.description || "";
    let result = null;
    const startTime = Date.now();
    try {
        (0, realtime_1.emitToAgent)(agentId, "agent:run:start", {
            agentId,
            at: new Date().toISOString(),
            prompt,
            retryAttempt,
        });
        const runner = main_1.axleAgent;
        // Build availableAgents for the main agent runner so the model can call agents
        const availableAgentDocs = await Agent_1.Agent.find({ ownerId: userId }).lean();
        const availableAgents = availableAgentDocs.map((a) => ({
            id: String(a._id),
            name: a.name,
            description: a.description,
        }));
        // Determine allowed tools: if agent.tools is empty or contains '*', allow all tools
        const allowedTools = agent.tools && agent.tools.length > 0 && !agent.tools.includes("*")
            ? agent.tools
            : undefined;
        // Get the model from agent config, default to gpt-4o
        const agentModel = agent.model || "gpt-4o";
        // For scheduled/autonomous runs, use independent agent execution with agent's own systemPrompt
        // For manual/chat runs, use the main AI orchestrator
        const isScheduledRun = !input || input === agent.systemPrompt;
        if (isScheduledRun) {
            // Independent agent execution - uses agent's own systemPrompt
            result = await runIndependentAgent({
                agent,
                context,
                userId,
                agentModel,
                allowedTools,
                onStep: (step) => {
                    (0, realtime_1.emitToAgent)(agentId, "agent:run:step", step);
                },
            });
        }
        else if (runner && typeof runner.run === "function") {
            // Manual/chat run - use main AI orchestrator
            result = await runner.run({
                input: prompt,
                context: { ...context, userId },
                availableAgents,
                allowedTools,
                userId,
                model: agentModel,
                onStep: (step) => {
                    (0, realtime_1.emitToAgent)(agentId, "agent:run:step", step);
                },
            });
        }
        else if (runner && typeof runner.execute === "function") {
            result = await runner.execute({ input: prompt, context, userId });
        }
        else {
            result = {
                message: "Axle agent runner not available; returning context",
                availableTools: agent.tools,
                contextKeys: Object.keys(context),
            };
        }
        (0, realtime_1.emitToAgent)(agentId, "agent:run:complete", {
            agentId,
            result,
            duration: Date.now() - startTime,
        });
        logger_1.logger.info(`Agent ${agentId} completed successfully in ${Date.now() - startTime}ms`);
    }
    catch (err) {
        const duration = Date.now() - startTime;
        const errorMsg = err.message || String(err);
        // Exponential backoff retry on transient errors
        if (retryAttempt < env_1.env.AGENT_MAX_RETRIES && isTransientError(err)) {
            const delayMs = Math.pow(2, retryAttempt) * 1000; // 1s, 2s, 4s, 8s
            logger_1.logger.warn(`Agent ${agentId} failed (${errorMsg}), retrying in ${delayMs}ms (attempt ${retryAttempt + 1}/${env_1.env.AGENT_MAX_RETRIES})`);
            (0, realtime_1.emitToAgent)(agentId, "agent:run:retry", {
                agentId,
                attempt: retryAttempt + 1,
                delayMs,
                error: errorMsg,
            });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return (0, exports.runAgentById)(userId, agentId, input, retryAttempt + 1);
        }
        result = { error: errorMsg };
        (0, realtime_1.emitToAgent)(agentId, "agent:run:error", {
            agentId,
            error: errorMsg,
            duration,
            finalRetry: retryAttempt >= env_1.env.AGENT_MAX_RETRIES,
        });
        logger_1.logger.error(`Agent ${agentId} failed after ${retryAttempt + 1} attempts: ${errorMsg}`);
    }
    // Store execution log
    agent.logs = agent.logs || [];
    agent.logs.push({
        message: `Run at ${new Date().toISOString()}: ${JSON.stringify(result)}`,
    });
    agent.lastRunAt = new Date();
    await agent.save();
    // Allow agents to self-schedule by returning a schedule directive in result
    try {
        const finalResult = result?.result || result;
        if (finalResult && finalResult.schedule && finalResult.schedule.enabled) {
            const queue = new bullmq_1.Queue("agent-run-queue", { connection: redis_1.default });
            const repeatOpts = {};
            if (finalResult.schedule.intervalMinutes)
                repeatOpts.every =
                    (finalResult.schedule.intervalMinutes || 5) * 60 * 1000;
            else if (finalResult.schedule.cron)
                repeatOpts.cron = finalResult.schedule.cron;
            await queue.add(`agent-${agent._id}`, { agentId: agent._id.toString(), ownerId: userId }, { repeat: repeatOpts });
            logger_1.logger.info(`Scheduled agent ${agent._id} via self-schedule directive`);
        }
    }
    catch (schErr) {
        logger_1.logger.error(`Failed to apply self-schedule for agent ${agentId}`, schErr);
    }
    return result;
};
exports.runAgentById = runAgentById;
/**
 * Run an agent independently using its own systemPrompt (for scheduled/autonomous runs)
 */
async function runIndependentAgent({ agent, context, userId, agentModel, allowedTools, onStep, }) {
    const systemPrompt = agent.systemPrompt || agent.description || "";
    if (!systemPrompt) {
        return { message: "Agent has no system prompt" };
    }
    // Get user email for context
    const user = await User_1.User.findById(userId).lean();
    const userEmail = user?.email || "";
    // Filter tools based on allowedTools
    let availableTools = registry_1.tools;
    if (allowedTools && allowedTools.length > 0) {
        availableTools = registry_1.tools.filter((t) => {
            const toolName = t.name || t.toolName || (t.tool && t.tool.name);
            return allowedTools.includes(toolName);
        });
    }
    // Build tool list with descriptions (simplified to reduce tokens)
    const toolDescriptions = availableTools
        .map((t) => {
        const name = t.name || t.toolName || (t.tool && t.tool.name);
        const desc = t.description || t.tool?.description || "";
        // Extract parameter names only (no types to save tokens)
        let paramsInfo = "";
        if (t.parameters) {
            try {
                const zodSchema = t.parameters;
                if (zodSchema._def?.shape) {
                    const shape = zodSchema._def.shape();
                    const paramNames = Object.keys(shape);
                    if (paramNames.length > 0) {
                        paramsInfo = ` (params: ${paramNames.join(", ")})`;
                    }
                }
            }
            catch (e) {
                // Ignore errors extracting params
            }
        }
        return `${name}${paramsInfo}: ${desc}`;
    })
        .filter(Boolean)
        .join("\n");
    // Build system message with agent's prompt and available tools
    // Make it VERY explicit that tools MUST be called (simplified to reduce tokens)
    const userContext = userEmail ? `\nUser email: ${userEmail}` : "";
    const hasEmailTool = availableTools.some((t) => {
        const name = t.name || t.toolName || (t.tool && t.tool.name);
        return name === "send_email" || name === "send_gmail";
    });
    const emailReminder = hasEmailTool && systemPrompt.toLowerCase().includes("email")
        ? `\n\nCRITICAL EMAIL REQUIREMENT: Your task requires sending an email. After collecting any data, you MUST call send_email or send_gmail tool as your FINAL action. The user's email is: ${userEmail || "check context"}. Do NOT complete your task without sending the email. This is mandatory.`
        : "";
    const systemMessage = `${systemPrompt}${userContext}${emailReminder}

CRITICAL: Execute actions using tools. Return ONLY JSON tool calls.

Tools: ${toolDescriptions}

Format: {"type":"tool","target":"tool_name","args":{"param":"value"}}

Example: {"type":"tool","target":"search_github","args":{"query":"user:username","type":"repositories"}}
Example: {"type":"tool","target":"send_email","args":{"to":"${userEmail || "user@example.com"}","subject":"Report","body":"Content"}}

IMPORTANT: If your task mentions email, sending email MUST be your final step. Collect data first, then send email.

Return only JSON, no text. Call tools one at a time.`;
    logger_1.logger.info(`[runIndependentAgent] Agent ${agent._id} starting execution with ${availableTools.length} tools available`);
    const messages = [
        { role: "system", content: systemMessage },
        {
            role: "user",
            content: "Execute your task now. You MUST call the required tools to complete it. Return only the JSON tool call, no other text.",
        },
    ];
    const maxLoops = 8; // Increased to give more chances for email sending
    let lastReply = "";
    let emailSent = false; // Track if email has been sent
    let dataCollected = false; // Track if data has been collected
    // Limit conversation history to prevent token overflow
    const maxMessages = 10; // Keep only last 10 messages (system + user + assistant pairs)
    for (let i = 0; i < maxLoops; i++) {
        if (onStep)
            onStep({ status: "model:call", attempt: i + 1 });
        try {
            const modelToUse = agentModel.startsWith("") || agentModel.startsWith("")
                ? agentModel
                : `${agentModel}`;
            const resp = await openai_1.default.chat.completions.create({
                model: modelToUse,
                messages,
            });
            const content = resp.choices?.[0]?.message?.content || "";
            let text = typeof content === "string" ? content : JSON.stringify(content);
            // Clean up the text - remove markdown code blocks if present
            text = text.trim();
            if (text.startsWith("```json")) {
                text = text
                    .replace(/```json\n?/g, "")
                    .replace(/```\n?/g, "")
                    .trim();
            }
            else if (text.startsWith("```")) {
                text = text.replace(/```\n?/g, "").trim();
            }
            lastReply = text;
            // Try to parse tool call
            let decision = null;
            try {
                decision = (0, parseModelJson_1.parseModelJson)(text);
            }
            catch (err) {
                // No JSON found - this means the agent didn't call a tool
                // For scheduled runs, we need to retry with a more forceful prompt
                logger_1.logger.warn(`Agent ${agent._id} did not return a tool call. Response: ${text.substring(0, 200)}`);
                if (i < maxLoops - 1) {
                    // Retry with more explicit instruction
                    messages.push({
                        role: "assistant",
                        content: text,
                    });
                    messages.push({
                        role: "user",
                        content: "You must call a tool to complete your task. Your response must be a JSON object with type 'tool', target (tool name), and args. Do not respond with text - only JSON.",
                    });
                    continue;
                }
                // Last attempt failed
                if (onStep)
                    onStep({ status: "agent:complete", reply: text });
                return { reply: text, error: "Agent did not call any tools" };
            }
            if (decision && decision.type === "tool" && decision.target) {
                // Track if email was sent
                if (decision.target === "send_email" ||
                    decision.target === "send_gmail") {
                    emailSent = true;
                }
                // Track if data collection tools were called
                const dataCollectionTools = [
                    "list_repos",
                    "list_commits",
                    "list_pull_requests",
                    "list_issues",
                    "search_github",
                ];
                if (dataCollectionTools.includes(decision.target)) {
                    dataCollected = true;
                }
                // Execute the tool
                logger_1.logger.info(`[runIndependentAgent] Agent ${agent._id} calling tool: ${decision.target}`);
                if (onStep)
                    onStep({ status: "tool:executing", tool: decision.target });
                const toolResult = await (0, toolExecutor_1.executeTool)(decision, userId);
                logger_1.logger.info(`[runIndependentAgent] Tool ${decision.target} execution result: ${toolResult.success ? "success" : "failed"}`);
                if (!toolResult.success) {
                    messages.push({
                        role: "assistant",
                        content: text,
                    });
                    messages.push({
                        role: "user",
                        content: `Tool execution failed: ${toolResult.error}. Please try a different approach.`,
                    });
                    continue;
                }
                // Truncate large tool results to prevent token limit errors
                const truncateResult = (result, maxLength = 2000) => {
                    const str = JSON.stringify(result);
                    if (str.length <= maxLength)
                        return str;
                    // If it's an array, summarize it
                    if (Array.isArray(result)) {
                        const summary = {
                            type: "array",
                            count: result.length,
                            items: result.slice(0, 5).map((item) => {
                                // Extract key fields only
                                if (typeof item === "object" && item !== null) {
                                    const keys = Object.keys(item);
                                    const summaryItem = {};
                                    // Keep important fields
                                    [
                                        "id",
                                        "name",
                                        "title",
                                        "subject",
                                        "status",
                                        "state",
                                        "url",
                                        "html_url",
                                    ].forEach((key) => {
                                        if (item[key] !== undefined)
                                            summaryItem[key] = item[key];
                                    });
                                    // If no important fields, just keep first 3 keys
                                    if (Object.keys(summaryItem).length === 0 &&
                                        keys.length > 0) {
                                        keys.slice(0, 3).forEach((key) => {
                                            summaryItem[key] = item[key];
                                        });
                                    }
                                    return summaryItem;
                                }
                                return item;
                            }),
                            truncated: result.length > 5
                                ? `... and ${result.length - 5} more items`
                                : undefined,
                        };
                        return JSON.stringify(summary);
                    }
                    // If it's an object, summarize it
                    if (typeof result === "object" && result !== null) {
                        // If it has an items array (like GitHub search results), summarize that
                        if (result.items && Array.isArray(result.items)) {
                            const summary = {
                                ...result,
                                items: result.items.slice(0, 10).map((item) => {
                                    const summaryItem = {};
                                    [
                                        "id",
                                        "name",
                                        "title",
                                        "full_name",
                                        "html_url",
                                        "state",
                                        "status",
                                    ].forEach((key) => {
                                        if (item[key] !== undefined)
                                            summaryItem[key] = item[key];
                                    });
                                    return summaryItem;
                                }),
                                _truncated: result.items.length > 10
                                    ? `${result.items.length - 10} more items not shown`
                                    : undefined,
                            };
                            return JSON.stringify(summary);
                        }
                        // Otherwise, just truncate the string
                        return str.substring(0, maxLength) + "... (truncated)";
                    }
                    return str.substring(0, maxLength) + "... (truncated)";
                };
                // Add tool result to conversation (truncated)
                messages.push({
                    role: "assistant",
                    content: text,
                });
                const truncatedResult = truncateResult(toolResult.result, 2000);
                // If data was collected and email hasn't been sent, and task requires email, force email prompt
                const requiresEmail = hasEmailTool && systemPrompt.toLowerCase().includes("email");
                const shouldForceEmail = requiresEmail && dataCollected && !emailSent && i < maxLoops - 1;
                let nextPrompt = `Tool executed successfully. Result: ${truncatedResult}. Continue with your task.`;
                if (shouldForceEmail) {
                    nextPrompt = `Data collected successfully. Now you MUST send the email report using send_email or send_gmail tool. User email: ${userEmail || "check context"}. Compile a report from the collected data and send it. Return only the JSON tool call for send_email or send_gmail.`;
                    logger_1.logger.info(`[runIndependentAgent] Forcing email send prompt - data collected but email not sent yet`);
                }
                messages.push({
                    role: "user",
                    content: nextPrompt,
                });
                // Trim message history if it gets too long (keep system message + last N messages)
                if (messages.length > maxMessages) {
                    const systemMsg = messages[0];
                    const recentMessages = messages.slice(-maxMessages + 1);
                    messages.length = 0;
                    messages.push(systemMsg, ...recentMessages);
                }
                if (onStep)
                    onStep({ status: "tool:complete", result: toolResult.result });
            }
            else {
                // No tool call - check if agent should have sent email
                if (hasEmailTool &&
                    systemPrompt.toLowerCase().includes("email") &&
                    !text.toLowerCase().includes("send_email") &&
                    !text.toLowerCase().includes("send_gmail")) {
                    // Agent completed without sending email when it should have
                    logger_1.logger.warn(`[runIndependentAgent] Agent ${agent._id} completed without sending email when task requires it`);
                    // Add reminder and retry once more
                    if (i < maxLoops - 1) {
                        messages.push({
                            role: "assistant",
                            content: text,
                        });
                        messages.push({
                            role: "user",
                            content: `Your task requires sending an email. You MUST call send_email or send_gmail tool with the user's email address (${userEmail || "from context"}) before completing. Return only the JSON tool call.`,
                        });
                        continue;
                    }
                }
                // No tool call, agent is done
                if (onStep)
                    onStep({ status: "agent:complete", reply: text });
                return { reply: text };
            }
        }
        catch (err) {
            logger_1.logger.error(`Independent agent execution error: ${err.message}`);
            if (onStep)
                onStep({ status: "error", error: err.message });
            return { error: err.message };
        }
    }
    // Final check: if email was required but not sent, try to force it one more time
    const requiresEmail = hasEmailTool && systemPrompt.toLowerCase().includes("email");
    if (requiresEmail && !emailSent && dataCollected) {
        logger_1.logger.warn(`[runIndependentAgent] Agent ${agent._id} completed without sending email. Attempting to force send...`);
        try {
            // Helper to get tool name safely
            const getToolName = (tool) => {
                if (tool?.name)
                    return tool.name;
                if (tool?.toolName)
                    return tool.toolName;
                if (tool?.tool?.name)
                    return tool.tool.name;
                return null;
            };
            // Prefer send_gmail if Google integration is available, otherwise use send_email
            const hasGoogleIntegration = context.google && context.google.accessToken;
            const preferredTool = hasGoogleIntegration ? "send_gmail" : "send_email";
            const emailTool = availableTools.find((t) => {
                const name = getToolName(t);
                return name === preferredTool;
            });
            // Fallback to any email tool if preferred not found
            const fallbackTool = emailTool ||
                availableTools.find((t) => {
                    const name = getToolName(t);
                    return name === "send_email" || name === "send_gmail";
                });
            if (fallbackTool && userEmail) {
                const toolName = getToolName(fallbackTool);
                if (!toolName) {
                    logger_1.logger.error(`[runIndependentAgent] Cannot determine tool name for email tool`);
                    return { reply: lastReply, emailSent, dataCollected };
                }
                const emailDecision = {
                    type: "tool",
                    target: toolName,
                    args: {
                        to: userEmail,
                        subject: `GitHub Activity Report - ${new Date().toLocaleDateString()}`,
                        body: `This is an automated report from your GitHub monitoring agent.\n\nData has been collected successfully. Please check the agent logs for detailed information.\n\nGenerated at: ${new Date().toISOString()}`,
                    },
                };
                logger_1.logger.info(`[runIndependentAgent] Auto-sending email to ${userEmail} using ${toolName} as agent failed to send it`);
                const emailResult = await (0, toolExecutor_1.executeTool)(emailDecision, userId);
                if (emailResult.success) {
                    logger_1.logger.info(`[runIndependentAgent] Successfully auto-sent email to ${userEmail}`);
                    return { reply: "Email sent automatically", emailSent: true };
                }
                else {
                    logger_1.logger.error(`[runIndependentAgent] Failed to auto-send email: ${emailResult.error}`);
                }
            }
            else {
                logger_1.logger.error(`[runIndependentAgent] Cannot auto-send: email tool not found or user email missing`);
            }
        }
        catch (autoEmailErr) {
            logger_1.logger.error(`[runIndependentAgent] Error attempting auto-send email: ${autoEmailErr.message}`);
        }
    }
    return { reply: lastReply, emailSent, dataCollected };
}
/**
 * Determine if an error is transient (retriable).
 */
function isTransientError(err) {
    if (!err)
        return false;
    const msg = err.message?.toLowerCase() || "";
    // Transient: timeouts, rate limits, temporary unavailability
    return (msg.includes("timeout") ||
        msg.includes("econnrefused") ||
        msg.includes("econnreset") ||
        msg.includes("429") ||
        msg.includes("503") ||
        msg.includes("service unavailable"));
}
exports.default = {};
