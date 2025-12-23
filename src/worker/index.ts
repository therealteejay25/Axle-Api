import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { ExecutionJobData, ExecutionJobResult } from "../queue/executionQueue";
import { Execution } from "../models/Execution";
import { loadAgent } from "./agentLoader";
import { SocketService } from "../services/SocketService";
import { buildContext, buildSystemPrompt } from "./contextBuilder";
import { callAI } from "./aiCaller";
import { executeActions, toExecutionActions } from "./actionExecutor";
import { deductCredits, calculateCredits } from "../services/billing";
import { logger } from "../services/logger";

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

let worker: Worker<ExecutionJobData, ExecutionJobResult> | null = null;

export const startWorker = (): Worker<ExecutionJobData, ExecutionJobResult> => {
  worker = new Worker<ExecutionJobData, ExecutionJobResult>(
    QUEUE_NAME,
    async (job: Job<ExecutionJobData, ExecutionJobResult>) => {
      return processJob(job);
    },
    {
      connection: redis,
      concurrency: 5, // Process up to 5 jobs in parallel
      limiter: {
        max: 100,
        duration: 60000 // Max 100 jobs per minute
      }
    }
  );
  
  worker.on("completed", (job, result) => {
    logger.info("Job completed", {
      jobId: job.id,
      executionId: job.data.executionId,
      success: result.success,
      actionsExecuted: result.actionsExecuted
    });
  });
  
  worker.on("failed", (job, error) => {
    logger.error("Job failed", {
      jobId: job?.id,
      executionId: job?.data.executionId,
      error: error.message
    });
  });
  
  worker.on("error", (error) => {
    logger.error("Worker error", { error: error.message });
  });
  
  logger.info("Worker started");
  return worker;
};

const processJob = async (
  job: Job<ExecutionJobData, ExecutionJobResult>
): Promise<ExecutionJobResult> => {
  const { executionId, agentId, ownerId, triggerType, payload } = job.data;
  
  // 1. Mark execution as running
  const execution = await Execution.findById(executionId);
  if (!execution) {
    throw new Error(`Execution not found: ${executionId}`);
  }
  
  execution.status = "running";
  execution.startedAt = new Date();
  await execution.save();
  
  // Emit live update
  SocketService.getInstance().emitToAgent(agentId, "execution:started", {
    executionId: execution._id,
    status: "running"
  });
  
  try {
    // 2-3. Load agent and integrations
    const loaded = await loadAgent(agentId, ownerId);
    
    // Check if agent is paused
    if (loaded.agent.status === "paused") {
      logger.info("Agent is paused, skipping execution", { agentId });
      execution.status = "failed";
      execution.error = "Agent is paused";
      await execution.save();
      return { success: false, actionsExecuted: 0, creditsUsed: 0, error: "Agent is paused" };
    }

    // 4. Build execution context
    const context = buildContext(loaded, triggerType, payload);
    const systemPrompt = buildSystemPrompt(loaded, context);
    
    // Store prompt for debugging
    execution.aiPrompt = systemPrompt;
    
    // 5. Call AI
    // Ensure sufficient tokens for complex outputs (e.g. HTML emails)
    const maxTokens = Math.max(loaded.agent.brain.maxTokens || 4096, 4096);
    
    const aiResponse = await callAI(
      systemPrompt,
      loaded.agent.brain.model,
      loaded.agent.brain.temperature,
      maxTokens
    );
    
    // Store AI response
    execution.aiResponse = aiResponse.rawResponse;
    execution.aiTokensUsed = aiResponse.tokensUsed;
    
    if (aiResponse.executionName) {
      execution.name = aiResponse.executionName;
      await execution.save();
    }
    
    // 6-7. Execute actions
    const actionResults = await executeActions(
      aiResponse.actions,
      loaded,
      loaded.agent.actions
    );
    
    // 8. Calculate and deduct credits
    const creditsUsed = calculateCredits(aiResponse.tokensUsed, actionResults.length);
    const creditDeducted = await deductCredits(ownerId, creditsUsed);
    
    if (!creditDeducted) {
      logger.warn("Insufficient credits", { ownerId, required: creditsUsed });
    }
    
    // 9. Persist results
    execution.actionsExecuted = toExecutionActions(actionResults);
    execution.creditsUsed = creditsUsed;
    execution.status = "success";
    execution.finishedAt = new Date();
    execution.outputPayload = {
      actionsCount: actionResults.length,
      tokensUsed: aiResponse.tokensUsed,
      creditsUsed
    };
    
    // Check for high-risk actions requiring approval
    if (loaded.agent.settings.approvalRequired) {
      const highRiskPrefixes = ["delete", "remove", "archive", "un"];
      const needsApproval = actionResults.some(r => 
        highRiskPrefixes.some(p => r.type.toLowerCase().includes(p))
      );

      if (needsApproval) {
        execution.status = "pending";
        execution.approvalStatus = "pending";
        await execution.save();
        return { success: true, actionsExecuted: actionResults.length, creditsUsed };
      }
    }

    // Check if any action failed
    const hasErrors = actionResults.some(r => r.error);
    if (hasErrors) {
      execution.status = "failed";
      execution.error = "One or more actions failed";
    }
    
    await execution.save();

    // Emit live update
    SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
      executionId: execution._id,
      status: execution.status,
      name: execution.name,
      actionsCount: actionResults.length
    });
    
    return {
      success: !hasErrors,
      actionsExecuted: actionResults.length,
      creditsUsed,
      error: hasErrors ? "One or more actions failed" : undefined
    };
    
  } catch (error: any) {
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

export const stopWorker = async (): Promise<void> => {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("Worker stopped");
  }
};

export default { startWorker, stopWorker };
