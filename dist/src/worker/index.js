"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopWorker = exports.startWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const Execution_1 = require("../models/Execution");
const agentLoader_1 = require("./agentLoader");
const contextBuilder_1 = require("./contextBuilder");
const aiCaller_1 = require("./aiCaller");
const actionExecutor_1 = require("./actionExecutor");
const billing_1 = require("../services/billing");
const logger_1 = require("../services/logger");
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
            duration: 60000 // Max 100 jobs per minute
        }
    });
    worker.on("completed", (job, result) => {
        logger_1.logger.info("Job completed", {
            jobId: job.id,
            executionId: job.data.executionId,
            success: result.success,
            actionsExecuted: result.actionsExecuted
        });
    });
    worker.on("failed", (job, error) => {
        logger_1.logger.error("Job failed", {
            jobId: job?.id,
            executionId: job?.data.executionId,
            error: error.message
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
    try {
        // 2-3. Load agent and integrations
        const loaded = await (0, agentLoader_1.loadAgent)(agentId, ownerId);
        // 4. Build execution context
        const context = (0, contextBuilder_1.buildContext)(loaded, triggerType, payload);
        const systemPrompt = (0, contextBuilder_1.buildSystemPrompt)(loaded, context);
        // Store prompt for debugging
        execution.aiPrompt = systemPrompt;
        // 5. Call AI
        const aiResponse = await (0, aiCaller_1.callAI)(systemPrompt, loaded.agent.brain.model, loaded.agent.brain.temperature, loaded.agent.brain.maxTokens);
        // Store AI response
        execution.aiResponse = aiResponse.rawResponse;
        execution.aiTokensUsed = aiResponse.tokensUsed;
        // 6-7. Execute actions
        const actionResults = await (0, actionExecutor_1.executeActions)(aiResponse.actions, loaded, loaded.agent.actions);
        // 8. Calculate and deduct credits
        const creditsUsed = (0, billing_1.calculateCredits)(aiResponse.tokensUsed, actionResults.length);
        const creditDeducted = await (0, billing_1.deductCredits)(ownerId, creditsUsed);
        if (!creditDeducted) {
            logger_1.logger.warn("Insufficient credits", { ownerId, required: creditsUsed });
        }
        // 9. Persist results
        execution.actionsExecuted = (0, actionExecutor_1.toExecutionActions)(actionResults);
        execution.creditsUsed = creditsUsed;
        execution.status = "success";
        execution.finishedAt = new Date();
        execution.outputPayload = {
            actionsCount: actionResults.length,
            tokensUsed: aiResponse.tokensUsed,
            creditsUsed
        };
        // Check if any action failed
        const hasErrors = actionResults.some(r => r.error);
        if (hasErrors) {
            execution.status = "failed";
            execution.error = "One or more actions failed";
        }
        await execution.save();
        return {
            success: !hasErrors,
            actionsExecuted: actionResults.length,
            creditsUsed,
            error: hasErrors ? "One or more actions failed" : undefined
        };
    }
    catch (error) {
        // Handle failures
        execution.status = "failed";
        execution.error = error.message;
        execution.errorStack = error.stack;
        execution.finishedAt = new Date();
        execution.retryCount = (execution.retryCount || 0) + 1;
        await execution.save();
        throw error; // Re-throw for BullMQ retry logic
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
