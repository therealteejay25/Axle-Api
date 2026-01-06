"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopWorker = exports.startWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const Execution_1 = require("../models/Execution");
const agentLoader_1 = require("./agentLoader");
const SocketService_1 = require("../services/SocketService");
const contextBuilder_1 = require("./contextBuilder");
const billing_1 = require("../services/billing");
const logger_1 = require("../services/logger");
const ExecutionEventService_1 = require("../services/ExecutionEventService");
// ============================================
// WORKER
// ============================================
// Processes execution jobs one at a time.
// Complete lifecycle:
//   1. Mark execution as running
//   2. Load agent config
//   3. Load integrations
//   4. Build execution context
//   5. Call AI
//   6. Validate AI output
//   7. Execute actions
//   8. Persist results
//   9. Mark execution complete
// ============================================
const QUEUE_NAME = "execution-queue";
let worker = null;
const startWorker = () => {
    worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        return processJob(job);
    }, {
        connection: redis_1.redis,
        concurrency: 5, // Process up to 5 jobs in parallel
        limiter: {
            max: 100,
            duration: 60000, // Max 100 jobs per minute
        },
    });
    worker.on("completed", (job, result) => {
        logger_1.logger.info("Job completed", {
            jobId: job.id,
            executionId: job.data.executionId,
            success: result.success,
            actionsExecuted: result.actionsExecuted,
        });
    });
    worker.on("failed", (job, error) => {
        logger_1.logger.error("Job failed", {
            jobId: job?.id,
            executionId: job?.data.executionId,
            error: error.message,
        });
    });
    worker.on("error", (error) => {
        logger_1.logger.error("Worker error", { error: error.message });
    });
    logger_1.logger.info("Worker started");
    return worker;
};
exports.startWorker = startWorker;
// Validate actions before execution
const validateActions = (actions, loaded) => {
    const errors = [];
    // Legacy Registry
    const { getAvailableActions: getLegacyActions, validateActionParams: validateLegacyParams, } = require("../adapters/registry");
    // New Capability Executor
    const { getAction: getCapabilityAction, validateActionParams: validateCapabilityParams, } = require("../capabilities/executor");
    const legacyActions = getLegacyActions();
    const integrationNames = Array.from(loaded.integrations.keys());
    for (const action of actions) {
        // 1. Check Capability Layer (New System)
        const capabilityAction = getCapabilityAction(action.type);
        if (capabilityAction) {
            // Check integration connection
            const required = capabilityAction.metadata.requiresIntegration || [];
            if (required.length > 0) {
                const missing = required.filter((i) => !integrationNames.includes(i));
                if (missing.length > 0) {
                    errors.push(`Action "${action.type}" requires integration: ${missing.join(", ")}.`);
                    continue;
                }
            }
            // Validate params
            const validation = validateCapabilityParams(action.type, action.params);
            if (!validation.valid) {
                errors.push(`Invalid params for "${action.type}": ${validation.errors.join(", ")}`);
            }
            continue;
        }
        // 2. Check Legacy Registry (Old System)
        if (legacyActions.includes(action.type)) {
            // Check integration
            const platform = action.type.split("_")[0];
            const requiresIntegration = ![
                "http",
                "email",
                "scraper",
                "research",
            ].includes(platform);
            if (requiresIntegration && !integrationNames.includes(platform)) {
                errors.push(`Action "${action.type}" requires ${platform} integration. ` +
                    `Connected integrations: ${integrationNames.join(", ") || "none"}. ` +
                    `Please connect ${platform} in Settings.`);
                continue;
            }
            // Validate params
            const validation = validateLegacyParams(action.type, action.params);
            if (!validation.valid) {
                errors.push(`Invalid params for "${action.type}": ${validation.errors.join(", ")}`);
            }
            continue;
        }
        // 3. Unknown Action
        errors.push(`Unknown action: "${action.type}". Check action name spelling.`);
    }
    return errors;
};
// ============================================
// WORKER REFACTOR (Google ADK)
// ============================================
const adk_1 = require("@google/adk");
const MongoSessionService_1 = require("../services/MongoSessionService");
const registry_1 = require("../capabilities/registry");
const processJob = async (job) => {
    const { executionId, agentId, ownerId, triggerType, payload } = job.data;
    // 1. Mark execution as running
    const execution = await Execution_1.Execution.findById(executionId);
    if (!execution) {
        throw new Error(`Execution not found: ${executionId}`);
    }
    execution.status = "running";
    execution.startedAt = new Date();
    await execution.save();
    await ExecutionEventService_1.ExecutionEventService.log({
        executionId,
        agentId,
        userId: ownerId,
        type: "execution_started",
        level: "info",
        message: `Execution started (${triggerType})`,
        data: { triggerType, payload },
    });
    SocketService_1.SocketService.getInstance().emitToAgent(agentId, "execution:started", {
        executionId: execution._id,
        status: "running",
    });
    try {
        // 2. Load Agent & Integrations
        const loaded = await (0, agentLoader_1.loadAgent)(agentId, ownerId);
        // const llm = new GenerativeAiLlm({
        //   model: 'gemini-1.5-pro-002', // Or 'gemini-2.0-flash-exp'
        //   apiKey: process.env.GOOGLE_AI_API_KEY,
        // });
        const llm = new adk_1.Gemini({
            model: "gemini-2.0-flash",
            apiKey: process.env.GEMINI_API_KEY,
        });
        //     const llm = createConsoleLlm({
        //   apiKey: process.env.GOOGLE_AI_API_KEY as string,
        //   model: 'gemini-1.5-pro-002',
        // });
        if (loaded.agent.status === "paused") {
            logger_1.logger.info("Agent is paused", { agentId });
            execution.status = "failed";
            execution.error = "Agent is paused";
            await execution.save();
            return {
                success: false,
                actionsExecuted: 0,
                creditsUsed: 0,
                error: "Agent is paused",
            };
        }
        // 3. Initialize ADK Tools via Registry
        // CRITICAL: Must return FunctionTool[] only, no wrappers
        const tools = await registry_1.ToolRegistry.getToolsForAgent(loaded.integrations, loaded.agent.actions);
        // Validation guard: Ensure all tools are FunctionTool instances
        if (!Array.isArray(tools)) {
            throw new Error("ToolRegistry.getToolsForAgent must return an array");
        }
        if (!tools.every((t) => t && typeof t === "object" && "name" in t)) {
            throw new Error("All tools must be valid FunctionTool instances");
        }
        logger_1.logger.info("Tools loaded for agent", {
            agentId,
            toolCount: tools.length,
            toolNames: tools.map((t) => t.name).slice(0, 10), // Log first 10 tool names
        });
        let actionsCount = 0;
        let tokensUsed = 0;
        // Sanitize agent name for ADK (must be valid identifier: letters, digits, underscores only)
        const sanitizedAgentName = loaded.agent.name.replace(/[^a-zA-Z0-9_]/g, "_");
        // 4. Initialize ADK Agent
        console.log("About to call buildSystemPrompt with payload:", JSON.stringify(payload, null, 2));
        const adkAgent = new adk_1.LlmAgent({
            name: sanitizedAgentName,
            model: "gemini-2.0-flash",
            tools: tools,
            instruction: (0, contextBuilder_1.buildSystemPrompt)(loaded, (0, contextBuilder_1.buildContext)(loaded, triggerType, payload, [])), // 'instruction' instead of 'systemPrompt'
            generateContentConfig: {
                maxOutputTokens: 8096,
                temperature: 0.7,
            },
        });
        console.log(tools);
        // Callbacks for observability instead of events
        // beforeToolCallback: async (...args: any[]) => {
        //    const toolName = args[0]?.name || args[0];
        //    SocketService.getInstance().emitToAgent(agentId, "execution:action", {
        //      type: typeof toolName === 'string' ? toolName : 'unknown',
        //      status: "running"
        //    });
        // },
        // afterToolCallback: async (...args: any[]) => {
        //    actionsCount++;
        // }
        // 5. Initialize Runner with Mongo Session
        const sessionService = new MongoSessionService_1.MongoSessionService();
        sessionService.setContext(executionId); // Fix for ADK dropping context
        // Runner config: passing sessionService directly if supported
        // Based on inspection, Runner has 'sessionService'.
        const runner = new adk_1.Runner({
            agent: adkAgent,
            sessionService,
        });
        // 6. Execute (Generator Loop)
        // runAsync expects initial user message to start the conversation
        const initialUserMessage = payload?.task || "Execute the assigned task";
        console.log("INITIAL USER MESSAGE:", initialUserMessage);
        const runGenerator = await runner.runAsync(initialUserMessage, {
            sessionId: executionId,
            session: { id: executionId }, // Try alternate format
            context: { sessionId: executionId }, // Try context wrapper
        });
        console.log("runAsync completed");
        let eventCount = 0;
        const executionEvents = [];
        const executionTurns = [];
        for await (const event of runGenerator) {
            eventCount++;
            console.log(`ADK EVENT ${eventCount}:`, JSON.stringify(event, null, 2));
            // Store events for database
            executionEvents.push({
                ...event,
                timestamp: Date.now(),
                eventNumber: eventCount
            });
            // Store turns if this is a conversation turn
            if (event.content && event.author) {
                executionTurns.push(event);
            }
            // Emit real-time update via Socket.IO
            SocketService_1.SocketService.getInstance().emitToAgent(agentId, "execution:event", {
                executionId,
                event: {
                    ...event,
                    timestamp: Date.now(),
                    eventNumber: eventCount
                }
            });
        }
        console.log(`Total ADK events processed: ${eventCount}`);
        // 8. Process Result & Billing
        const finalState = (await sessionService.load(executionId));
        console.log("FINAL STATE:", JSON.stringify(finalState, null, 2));
        // Calculate credits (Mock token usage if ADK doesn't return it yet, or use result stats)
        // Assuming result has usage or we estimate.
        // We used 'tokensUsed' variable scope but currently we don't update it.
        // We'll trust finalState or just use actionsCount for now.
        const creditsUsed = (0, billing_1.calculateCredits)(tokensUsed, actionsCount);
        await (0, billing_1.deductCredits)(ownerId, creditsUsed);
        // Update Execution
        execution.status = "success";
        execution.finishedAt = new Date();
        execution.actionsExecuted =
            finalState?.history
                ?.filter((h) => h.role === "tool" || h.role === "function")
                .map((h) => ({
                type: h.parts?.[0]?.functionCall?.name || "unknown", // Adjust based on message structure
                // ... simplified mapping
                verified: true,
            })) || [];
        // Store detailed execution data
        execution.state = {
            ...execution.state,
            events: executionEvents,
            turns: executionTurns,
            finalState,
            eventCount
        };
        // Get last model response
        const lastMsg = finalState?.history?.[finalState.history.length - 1];
        execution.outputPayload = {
            result: lastMsg?.parts?.[0]?.text || "Completed",
        };
        execution.creditsUsed = creditsUsed;
        execution.aiTokensUsed = tokensUsed;
        if (execution.thoughtSignature) {
            // Ensure it's saved
        }
        await execution.save();
        await ExecutionEventService_1.ExecutionEventService.log({
            executionId,
            agentId,
            userId: ownerId,
            type: "execution_completed",
            level: "info",
            message: "Execution completed successfully",
            data: { creditsUsed, actionsCount },
        });
        SocketService_1.SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
            executionId: execution._id,
            status: "success",
            actionsCount,
        });
        return {
            success: true,
            actionsExecuted: actionsCount,
            creditsUsed,
            error: undefined,
        };
    }
    catch (error) {
        logger_1.logger.error("Execution failed", { error });
        execution.status = "failed";
        execution.error = error.message;
        execution.finishedAt = new Date();
        await execution.save();
        await ExecutionEventService_1.ExecutionEventService.log({
            executionId,
            agentId,
            userId: ownerId,
            type: "execution_failed",
            level: "error",
            message: error.message,
        });
        SocketService_1.SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
            executionId: execution._id,
            status: "failed",
            error: execution.error,
        });
        throw error;
    }
};
const stopWorker = async () => {
    if (worker) {
        await worker.close();
        worker = null;
        logger_1.logger.info("Worker stopped");
    }
};
exports.stopWorker = stopWorker;
exports.default = { startWorker: exports.startWorker, stopWorker: exports.stopWorker };
