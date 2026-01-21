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
import { SocketService } from "../services/SocketService";
import { ExecutionEventService } from "../services/ExecutionEventService";
import { AgentMemoryService } from "../services/AgentMemoryService";
import { GoogleGenerativeAI, FunctionDeclaration, FunctionCall, Part, Content } from "@google/generative-ai";
import { env } from "../config/env";

const QUEUE_NAME = "execution-queue";
let worker: Worker<ExecutionJobData, ExecutionJobResult> | null = null;

// Configure model - use smarter model for complex tasks
const SMART_MODEL = "gemini-2.5-flash-preview-05-20"; // More capable
const FAST_MODEL = "gemini-2.0-flash"; // Faster for simple tasks

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

// Detect task complexity to choose model
const isComplexTask = (message: string): boolean => {
  const complexPatterns = [
    /analyz/i, /research/i, /compare/i, /explain/i, /summarize/i,
    /create.*plan/i, /write.*code/i, /debug/i, /investigate/i,
    /multiple/i, /several/i, /steps/i, /comprehensive/i
  ];
  return complexPatterns.some(p => p.test(message)) || message.length > 100;
};

const processJob = async (
  job: Job<ExecutionJobData, ExecutionJobResult>
): Promise<ExecutionJobResult> => {
  const { executionId, agentId, ownerId, triggerType, payload } = job.data;
  const runStartedAtMs = Date.now();

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
    const loaded = await loadAgent(agentId, ownerId);
    const userMessage = payload?.input || payload?.task || "Execute the assigned task";

    const estimate = CreditManagerService.estimateTaskCredits({ userMessage });
    await CreditManagerService.assertHasCredits({ userId: ownerId, required: estimate });

    if (loaded.agent.status === "paused") {
      execution.status = "failed";
      execution.error = "Agent is paused";
      await execution.save();
      return { success: false, actionsExecuted: 0, creditsUsed: 0, error: "Agent is paused" };
    }

    const tools = createUserTools(ownerId, agentId);
    logger.info(`[WORKER] Initialized with ${tools.length} tools`, { agentId, toolCount: tools.length });

    const systemPrompt = await buildFocusedContext(loaded, payload || {});

    // ============================================
    // LOAD CONVERSATION HISTORY FROM MEMORY
    // ============================================
    const previousMessages = await AgentMemoryService.getRecentMessages(agentId, 10);
    const conversationHistory: Content[] = previousMessages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    logger.info(`[WORKER] Loaded ${conversationHistory.length} messages from memory`);

    // Detect task type
    const isSimpleGreeting = /^(hey|hi|hello|yo|sup|what's up|howdy|greetings)[\s!.,]*$/i.test(
      userMessage.trim()
    );
    const complex = isComplexTask(userMessage);
    const MAX_ITERATIONS = isSimpleGreeting ? 1 : (complex ? 25 : 15);

    // Choose model based on complexity
    const selectedModel = complex ? SMART_MODEL : FAST_MODEL;
    logger.info(`[WORKER] Using model: ${selectedModel} (complex: ${complex})`);

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
    // INITIALIZE MODEL WITH SMART CONFIGURATION
    // ============================================
    const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY || env.GEMINI_API_KEY);

    const functionDeclarations: FunctionDeclaration[] = tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    const model = genAI.getGenerativeModel({
      model: selectedModel,
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations }],
      generationConfig: {
        temperature: complex ? 0.7 : 0.5, // More creative for complex tasks
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });

    const chat = model.startChat({
      history: conversationHistory,
    });

    // Track consecutive no-tool iterations for smart completion
    let consecutiveNoToolIterations = 0;

    // ============================================
    // EXECUTION LOOP
    // ============================================
    while (!taskComplete && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      logger.info(`[EXECUTION] Iteration ${iterationCount}/${MAX_ITERATIONS}`);

      SocketService.getInstance().emitToAgent(agentId, "execution:status", {
        executionId,
        status: "running",
        message: iterationCount === 1 ? "Thinking…" : "Processing…",
        timestamp: Date.now(),
      });

      // Build contextual message for continuation
      const messageToSend = iterationCount === 1 
        ? userMessage 
        : `Based on the tool results above, continue working on the task. If the task is complete, call the complete_task tool with a summary.`;

      const result = await chat.sendMessageStream(messageToSend);

      let iterationResponse = "";
      let functionCalls: FunctionCall[] = [];
      let iterationHadTools = false;

      // Stream response
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        
        if (chunkText) {
          iterationResponse += chunkText;
          finalResponse += chunkText;

          SocketService.getInstance().emitToAgent(agentId, "execution:response_delta", {
            executionId,
            delta: chunkText,
            timestamp: Date.now(),
          });
        }

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
      }

      // ============================================
      // PARALLEL TOOL EXECUTION
      // ============================================
      if (functionCalls.length > 0) {
        iterationHadTools = true;
        consecutiveNoToolIterations = 0;

        // Filter out complete_task for special handling
        const completionCall = functionCalls.find(c => c.name === "complete_task");
        const otherCalls = functionCalls.filter(c => c.name !== "complete_task");

        if (completionCall) {
          taskComplete = true;
          const summary = completionCall.args?.summary;
          if (summary) {
            finalResponse = typeof summary === "string" ? summary : finalResponse;
          }
          logger.info("[COMPLETE_TASK] Agent signaled completion");
          break;
        }

        // Execute tools in PARALLEL for speed
        logger.info(`[TOOLS] Executing ${otherCalls.length} tools in parallel`);

        const toolPromises = otherCalls.map(async (call) => {
          const toolName = call.name;
          const tool = tools.find((t: any) => t.name === toolName);
          
          if (!tool) {
            logger.error(`[TOOL] Not found: ${toolName}`);
            return { name: toolName, result: { error: `Tool not found: ${toolName}` } };
          }

          const startTime = Date.now();

          SocketService.getInstance().emitToAgent(agentId, "execution:action", {
            executionId,
            type: toolName,
            status: "running",
            timestamp: Date.now(),
          });

          try {
            const toolResult = await (tool as any).execute(call.args, {
              userId: ownerId,
              agentId,
            });

            const endTime = Date.now();
            const durationMs = endTime - startTime;

            logger.info(`[TOOL] ${toolName} completed in ${(durationMs / 1000).toFixed(1)}s`);

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
            await CreditManagerService.deductCreditsAtomic({
              userId: ownerId,
              amount: delta,
            });
            creditsDeductedTotal += delta;

            return { name: toolName, result: toolResult };
          } catch (error: any) {
            logger.error(`[TOOL] ${toolName} failed`, { error: error.message });

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

            return { name: toolName, result: { success: false, error: error.message } };
          }
        });

        // Wait for all tools to complete
        const toolResults = await Promise.all(toolPromises);

        // Send all tool results back to model in one message
        const functionResponses: Part[] = toolResults.map(tr => ({
          functionResponse: {
            name: tr.name,
            response: tr.result,
          },
        }));

        // Continue conversation with all tool results
        const followUpResult = await chat.sendMessageStream(functionResponses);

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

          // Check for more function calls in follow-up
          const moreCalls = chunk.functionCalls();
          if (moreCalls && moreCalls.length > 0) {
            functionCalls.push(...moreCalls);
          }
        }
      } else {
        consecutiveNoToolIterations++;
      }

      // Smart auto-completion logic
      if (taskComplete) break;

      // Complete simple greetings immediately
      if (isSimpleGreeting && finalResponse.length > 5) {
        taskComplete = true;
        logger.info("[AUTO-COMPLETE] Simple greeting");
        break;
      }

      // Complete if agent gave substantial response without tools (2+ iterations)
      if (consecutiveNoToolIterations >= 2 && finalResponse.length > 50) {
        taskComplete = true;
        logger.info("[AUTO-COMPLETE] No tool activity for 2 iterations");
        break;
      }
    }

    // ============================================
    // FINALIZE EXECUTION
    // ============================================
    const actualTokensUsed = tokensUsed > 0 ? tokensUsed : Math.ceil(finalResponse.length / 4);

    execution.status = taskComplete ? "success" : "incomplete";
    execution.finishedAt = new Date();
    execution.aiResponse = finalResponse;
    execution.creditsUsed = creditsDeductedTotal;
    execution.aiTokensUsed = actualTokensUsed;
    execution.actionsExecuted = actionsExecuted;
    await execution.save();

    // Save to memory for future context
    if (userMessage) {
      await AgentMemoryService.appendMessage({
        agentId,
        role: "user",
        content: userMessage,
        metadata: { source: "worker", executionId },
      });
    }

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

    const totalTime = Date.now() - runStartedAtMs;
    logger.info(`[EXECUTION] Completed in ${(totalTime / 1000).toFixed(1)}s`, {
      iterations: iterationCount,
      toolCalls: toolCallsCompleted,
      tokens: actualTokensUsed,
    });

    return {
      success: taskComplete,
      actionsExecuted: toolCallsCompleted,
      creditsUsed: creditsDeductedTotal,
    };

  } catch (error: any) {
    logger.error("Execution failed", { error: error.message });

    execution.status = "failed";
    execution.error = error instanceof Error ? error.message : String(error);
    execution.finishedAt = new Date();
    await execution.save();

    SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
      executionId: execution._id,
      status: "failed",
      error: execution.error,
    });

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