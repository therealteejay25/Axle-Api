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
const registry_1 = require("../tools/registry");
const adk_1 = require("@google/adk");
const MongoSessionService_1 = require("../services/MongoSessionService");
// ============================================
// WORKER - ADK AGENT WITH REASONING & MEMORY
// ============================================
// Orchestrated agent execution with tools, reasoning loop, and persistent memory
// ============================================
const QUEUE_NAME = "execution-queue";
let worker = null;
const startWorker = () => {
    worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        return processJob(job);
    }, {
        connection: redis_1.redis,
        concurrency: 5,
        limiter: {
            max: 100,
            duration: 60000,
        },
    });
    worker.on("completed", (job, result) => {
        logger_1.logger.info("Job completed", {
            jobId: job.id,
            executionId: job.data.executionId,
            success: result.success,
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
        if (loaded.agent.status === "paused") {
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
        // 3. Initialize ADK Agent with tools and memory
        const agentName = loaded.agent.name.replace(/[^a-zA-Z0-9_]/g, "_");
        const adkAgent = new adk_1.LlmAgent({
            name: agentName,
            model: "gemini-2.0-flash",
            tools: registry_1.tools,
            instruction: (0, contextBuilder_1.buildSystemPrompt)(loaded, (0, contextBuilder_1.buildContext)(loaded, triggerType, payload)),
            generateContentConfig: {
                maxOutputTokens: 4096,
                temperature: 0.7,
            },
        });
        // 4. Initialize Runner with session service for memory
        const sessionService = new MongoSessionService_1.MongoSessionService();
        const runner = new adk_1.Runner({
            agent: adkAgent,
            sessionService,
            appName: "axle-agent",
        });
        // 5. Execute with reasoning loop using runAsync
        const userMessage = payload?.task || "Execute the assigned task";
        let finalResponse = "";
        let tokensUsed = 0;
        try {
            const runResult = runner.runAsync({
                userId: ownerId,
                sessionId: executionId,
                newMessage: { role: "user", parts: [{ text: userMessage }] },
            });
            // Process the event stream
            for await (const event of runResult) {
                // Handle different event types
                if (event.type === "text" && event.content) {
                    finalResponse += event.content;
                }
                // Extract token usage if available
                if (event.usage) {
                    tokensUsed = event.usage.totalTokens || tokensUsed;
                }
                // Emit real-time events
                SocketService_1.SocketService.getInstance().emitToAgent(agentId, "execution:event", {
                    executionId,
                    event: {
                        ...event,
                        timestamp: Date.now(),
                    },
                });
            }
        }
        catch (error) {
            logger_1.logger.error("ADK Runner runAsync execution failed", { error });
            throw error;
        }
        // 6. Process Result & Billing
        // Use ADK token usage if available, otherwise estimate
        const actualTokensUsed = tokensUsed > 0 ? tokensUsed : Math.ceil(finalResponse.length / 4);
        const creditsUsed = (0, billing_1.calculateCredits)(actualTokensUsed, 0);
        await (0, billing_1.deductCredits)(ownerId, creditsUsed);
        // Update Execution
        execution.status = "success";
        execution.finishedAt = new Date();
        execution.outputPayload = {
            result: finalResponse || "Task completed",
            reasoning: "Agent completed execution with reasoning",
            confidence: "high",
        };
        execution.creditsUsed = creditsUsed;
        execution.aiTokensUsed = actualTokensUsed;
        await execution.save();
        await ExecutionEventService_1.ExecutionEventService.log({
            executionId,
            agentId,
            userId: ownerId,
            type: "execution_completed",
            level: "info",
            message: "ADK Agent execution completed successfully",
            data: { creditsUsed, tokensUsed: actualTokensUsed },
        });
        SocketService_1.SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
            executionId: execution._id,
            status: "success",
        });
        return { success: true, actionsExecuted: 0, creditsUsed };
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
            error: error.message,
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
