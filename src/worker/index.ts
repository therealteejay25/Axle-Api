import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { ExecutionJobData, ExecutionJobResult } from "../queue/executionQueue";
import { Execution } from "../models/Execution";
import { loadAgent } from "./agentLoader";
import { createUserTools } from "../tools/registry";
import { buildFocusedContext } from "./contextBuilder";
import {
  CreditManagerService,
  InsufficientCreditsError,
  logger,
} from "../services";
import { PLAN_LIMITS, PlanType } from "../models/User";
import { SocketService } from "../services/SocketService";
import { ExecutionEventService } from "../services/ExecutionEventService";
import { AgentMemoryService } from "../services/AgentMemoryService";
import { User } from "../models/User";
import { GoogleGenerativeAI, FunctionDeclaration, FunctionCall, Part } from "@google/generative-ai";
import { env } from "../config/env";

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
      concurrency: 5,
      limiter: { max: 100, duration: 60000 },
    }
  );

  worker.on("completed", (job, result) => {
    logger.info("Job completed", {
      jobId: job.id,
      executionId: job.data.executionId,
      success: result.success,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("Job failed", {
      jobId: job?.id,
      executionId: job?.data.executionId,
      error: error.message,
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
  const runStartedAtMs = Date.now();

  // CRITICAL: Declare all variables at function scope
  let taskComplete = false;
  let iterationCount = 0;
  let finalResponse = "";
  let tokensUsed = 0;
  let creditsDeductedTotal = 0;
  let toolCallsCompleted = 0;
  const actionsExecuted: Array<{
    type: string;
    params?: any;
    result?: any;
    startedAt?: Date;
    finishedAt?: Date;
    durationMs?: number;
  }> = [];

  // Mark execution as running
  const execution = await Execution.findById(executionId);
  if (!execution) {
    throw new Error(`Execution not found: ${executionId}`);
  }

  execution.status = "running";
  execution.startedAt = new Date();
  await execution.save();

  await ExecutionEventService.log({
    executionId,
    agentId,
    userId: ownerId,
    type: "execution_started",
    level: "info",
    message: `Execution started (${triggerType})`,
    data: { triggerType, payload },
  });

  SocketService.getInstance().emitToAgent(agentId, "execution:started", {
    executionId: execution._id,
    status: "running",
  });

  try {
    // Load agent and build context
    const loaded = await loadAgent(agentId, ownerId);
    const userMessage = payload?.input || payload?.task || "Execute the assigned task";

    // Credit check
    const estimate = CreditManagerService.estimateTaskCredits({ userMessage });
    await CreditManagerService.assertHasCredits({ userId: ownerId, required: estimate });

    if (loaded.agent.status === "paused") {
      execution.status = "failed";
      execution.error = "Agent is paused";
      await execution.save();
      return { success: false, actionsExecuted: 0, creditsUsed: 0, error: "Agent is paused" };
    }

    // Create tools
    const tools = createUserTools(ownerId, agentId);
    logger.info(`[WORKER] Initialized with ${tools.length} tools`, { agentId, toolCount: tools.length });

    // Build system prompt
    const systemPrompt = await buildFocusedContext(loaded, payload || {});

    // Detect greeting vs task
    const isSimpleGreeting = /^(hey|hi|hello|yo|sup|what's up|howdy|greetings)[\s!.,]*$/i.test(
      userMessage.trim()
    );
    const MAX_ITERATIONS = isSimpleGreeting ? 2 : 20;

    // Deduct base credits
    const baseRes = await CreditManagerService.deductCreditsAtomic({
      userId: ownerId,
      amount: CreditManagerService.BASE_TASK_WEIGHT,
    });
    if (!baseRes.ok) {
      throw new InsufficientCreditsError({
        available: await CreditManagerService.getUserCredits(ownerId),
        required: CreditManagerService.BASE_TASK_WEIGHT,
      });
    }
    creditsDeductedTotal += CreditManagerService.BASE_TASK_WEIGHT;

    // ============================================
    // STREAMING EXECUTION WITH GEMINI SDK DIRECTLY
    // ============================================

    const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY || env.GEMINI_API_KEY);

    // Convert tools to Gemini function declarations
    const functionDeclarations: FunctionDeclaration[] = tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp-0111",
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations }],
    });

    const chat = model.startChat({
      history: [],
    });

    // Execution loop with TRUE STREAMING
    while (!taskComplete && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      logger.info(`[EXECUTION] Starting iteration ${iterationCount}/${MAX_ITERATIONS}`);

      SocketService.getInstance().emitToAgent(agentId, "execution:status", {
        executionId,
        status: "running",
        message: iterationCount === 1 ? "Starting…" : "Continuing…",
        timestamp: Date.now(),
      });

      // Send message with streaming enabled
      const result = await chat.sendMessageStream(
        iterationCount === 1 ? userMessage : "Continue with the task"
      );

      let iterationResponse = "";
      let functionCalls: FunctionCall[] = [];
      let iterationHadTools = false;

      // REAL STREAMING - word by word as it's generated
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        
        // Stream text immediately - TRUE word-by-word streaming
        if (chunkText) {
          iterationResponse += chunkText;
          finalResponse += chunkText;

          // IMMEDIATE emit - no buffering
          SocketService.getInstance().emitToAgent(agentId, "execution:response_delta", {
            executionId,
            delta: chunkText,
            timestamp: Date.now(),
          });

          logger.debug(`[STREAMING] ${chunkText.substring(0, 30)}...`);
        }

        // Collect function calls
        const calls = chunk.functionCalls();
        if (calls && calls.length > 0) {
          functionCalls.push(...calls);
        }
      }

      // Update token usage
      const response = await result.response;
      const usage = response.usageMetadata;
      if (usage) {
        tokensUsed = usage.totalTokenCount || tokensUsed;
        logger.info(`[TOKENS] Used ${tokensUsed} tokens so far`);
      }

      // Process function calls
      if (functionCalls.length > 0) {
        iterationHadTools = true;

        for (const call of functionCalls) {
          const toolName = call.name;

          // Check for completion signal
          if (toolName === "complete_task") {
            taskComplete = true;
            const summary = call.args?.summary;
            if (summary) {
              finalResponse = summary;
            }
            logger.info("[COMPLETE_TASK] Agent signaled completion", {
              executionId,
              summary,
            });
            break;
          }

          logger.info(`[TOOL CALL] Executing ${toolName}`, { args: call.args });

          // Find and execute the tool
          const tool = tools.find((t: any) => t.name === toolName);
          if (!tool) {
            logger.error(`[TOOL] Not found: ${toolName}`);
            continue;
          }

          const startTime = Date.now();

          SocketService.getInstance().emitToAgent(agentId, "execution:action", {
            executionId,
            type: toolName,
            status: "running",
            timestamp: Date.now(),
          });

          try {
            // Execute the tool
            const toolResult = await (tool as any).execute(call.args, {
              userId: ownerId,
              agentId,
            });

            const endTime = Date.now();
            const durationMs = endTime - startTime;

            logger.info(`[TOOL] ${toolName} completed in ${(durationMs / 1000).toFixed(1)}s`, {
              result: toolResult,
            });

            // Track action
            actionsExecuted.push({
              type: toolName,
              params: call.args,
              result: toolResult,
              startedAt: new Date(startTime),
              finishedAt: new Date(endTime),
              durationMs,
            });

            SocketService.getInstance().emitToAgent(agentId, "execution:action", {
              executionId,
              type: toolName,
              status: "completed",
              result: toolResult,
              durationMs,
              timestamp: Date.now(),
            });

            // Deduct tool credits
            toolCallsCompleted++;
            const delta = CreditManagerService.TOOL_TASK_WEIGHT;
            const res = await CreditManagerService.deductCreditsAtomic({
              userId: ownerId,
              amount: delta,
            });
            if (!res.ok) {
              throw new InsufficientCreditsError({
                available: await CreditManagerService.getUserCredits(ownerId),
                required: delta,
              });
            }
            creditsDeductedTotal += delta;

            // Send tool result back to model
            const functionResponse: Part = {
              functionResponse: {
                name: toolName,
                response: toolResult,
              },
            };

            // Continue the conversation with tool result
            const followUpResult = await chat.sendMessageStream([functionResponse]);

            // Stream the follow-up response
            for await (const chunk of followUpResult.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                finalResponse += chunkText;

                SocketService.getInstance().emitToAgent(agentId, "execution:response_delta", {
                  executionId,
                  delta: chunkText,
                  timestamp: Date.now(),
                });
              }
            }

          } catch (error) {
            logger.error(`[TOOL] ${toolName} failed`, { error });

            actionsExecuted.push({
              type: toolName,
              params: call.args,
              result: { error: error.message },
              startedAt: new Date(startTime),
              finishedAt: new Date(),
            });

            SocketService.getInstance().emitToAgent(agentId, "execution:action", {
              executionId,
              type: toolName,
              status: "failed",
              error: error.message,
              timestamp: Date.now(),
            });
          }
        }
      }

      // Auto-completion logic
      if (taskComplete) {
        logger.info("[EXECUTION] Task marked complete by agent");
        break;
      }

      // Auto-complete for simple greetings after first response
      if (isSimpleGreeting && iterationCount >= 1 && finalResponse.length > 5) {
        taskComplete = true;
        logger.info("[AUTO-COMPLETE] Simple greeting completed", {
          iterationCount,
          responseLength: finalResponse.length,
        });
        break;
      }

      // Auto-complete if agent responded without tools
      if (!iterationHadTools && finalResponse.length > 20 && iterationCount >= 1) {
        taskComplete = true;
        logger.info("[AUTO-COMPLETE] Text-only response, completing", {
          iterationCount,
          responseLength: finalResponse.length,
        });
        break;
      }
    }

    // Finalize execution
    const actualTokensUsed = tokensUsed > 0 ? tokensUsed : Math.ceil(finalResponse.length / 4);

    execution.status = taskComplete ? "success" : "incomplete";
    execution.finishedAt = new Date();
    execution.aiResponse = finalResponse;
    execution.creditsUsed = creditsDeductedTotal;
    execution.aiTokensUsed = actualTokensUsed;
    execution.actionsExecuted = actionsExecuted;
    await execution.save();

    // Save assistant message to memory
    if (finalResponse && typeof finalResponse === "string") {
      await AgentMemoryService.appendMessage({
        agentId,
        role: "assistant",
        content: finalResponse,
        metadata: {
          source: "worker",
          executionId,
          tokensUsed: actualTokensUsed,
        },
      });
    }

    await ExecutionEventService.log({
      executionId,
      agentId,
      userId: ownerId,
      type: "execution_completed",
      level: "info",
      message: "Execution completed successfully",
      data: { creditsUsed: creditsDeductedTotal, tokensUsed: actualTokensUsed },
    });

    SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
      executionId: execution._id,
      status: taskComplete ? "success" : "incomplete",
    });

    return {
      success: taskComplete,
      actionsExecuted: toolCallsCompleted,
      creditsUsed: creditsDeductedTotal,
    };

  } catch (error) {
    logger.error("Execution failed", { error });

    execution.status = "failed";
    execution.error = error instanceof Error ? error.message : String(error);
    execution.finishedAt = new Date();
    await execution.save();

    SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
      executionId: execution._id,
      status: "failed",
      error: execution.error,
    });

    // Don't throw - return failure to prevent retries
    return {
      success: false,
      actionsExecuted: toolCallsCompleted,
      creditsUsed: creditsDeductedTotal,
      error: execution.error,
    };
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