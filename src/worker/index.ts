import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { ExecutionJobData, ExecutionJobResult } from "../queue/executionQueue";
import { Execution } from "../models/Execution";
import { loadAgent } from "./agentLoader";
import { SocketService } from "../services/SocketService";
import {
  buildContext,
  buildIterativeContext,
  buildSystemPrompt,
} from "./contextBuilder";
import { callAI, AIAction, MemoryEntry } from "./aiCaller";
import { executeActions, toExecutionActions } from "./actionExecutor";
import { deductCredits, calculateCredits } from "../services/billing";
import { logger } from "../services/logger";
import { ExecutionEventService } from "../services/ExecutionEventService";

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
        duration: 60000, // Max 100 jobs per minute
      },
    }
  );

  worker.on("completed", (job, result) => {
    logger.info("Job completed", {
      jobId: job.id,
      executionId: job.data.executionId,
      success: result.success,
      actionsExecuted: result.actionsExecuted,
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

// Validate actions before execution
const validateActions = (
  actions: AIAction[],
  loaded: LoadedAgent
): string[] => {
  const errors: string[] = [];

  // Legacy Registry
  const {
    getAvailableActions: getLegacyActions,
    validateActionParams: validateLegacyParams,
  } = require("../adapters/registry");
  // New Capability Executor
  const {
    getAction: getCapabilityAction,
    validateActionParams: validateCapabilityParams,
  } = require("../capabilities/executor");

  const legacyActions = getLegacyActions();
  const integrationNames = Array.from(loaded.integrations.keys());

  for (const action of actions) {
    // 1. Check Capability Layer (New System)
    const capabilityAction = getCapabilityAction(action.type);

    if (capabilityAction) {
      // Check integration connection
      const required = capabilityAction.metadata.requiresIntegration || [];
      if (required.length > 0) {
        const missing = required.filter(
          (i: string) => !integrationNames.includes(i)
        );
        if (missing.length > 0) {
          errors.push(
            `Action "${action.type}" requires integration: ${missing.join(
              ", "
            )}.`
          );
          continue;
        }
      }

      // Validate params
      const validation = validateCapabilityParams(action.type, action.params);
      if (!validation.valid) {
        errors.push(
          `Invalid params for "${action.type}": ${validation.errors.join(", ")}`
        );
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
        errors.push(
          `Action "${action.type}" requires ${platform} integration. ` +
            `Connected integrations: ${
              integrationNames.join(", ") || "none"
            }. ` +
            `Please connect ${platform} in Settings.`
        );
        continue;
      }

      // Validate params
      const validation = validateLegacyParams(action.type, action.params);
      if (!validation.valid) {
        errors.push(
          `Invalid params for "${action.type}": ${validation.errors.join(", ")}`
        );
      }
      continue;
    }

    // 3. Unknown Action
    errors.push(
      `Unknown action: "${action.type}". Check action name spelling.`
    );
  }

  return errors;
};

// ============================================
// WORKER REFACTOR (Google ADK)
// ============================================

import { LlmAgent, Runner, Gemini } from "@google/adk";
import { MongoSessionService } from "../services/MongoSessionService";
import { ToolRegistry } from "../capabilities/registry";
import { LoadedAgent } from "./agentLoader"; // Ensure type is exported
import * as agentLoader from "./agentLoader";

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
    // 2. Load Agent & Integrations
    const loaded = await loadAgent(agentId, ownerId);

    // const llm = new GenerativeAiLlm({
    //   model: 'gemini-1.5-pro-002', // Or 'gemini-2.0-flash-exp'
    //   apiKey: process.env.GOOGLE_AI_API_KEY,
    // });

    const llm = new Gemini({
      model: "gemini-2.0-flash",
      apiKey: process.env.GEMINI_API_KEY,
    });

    //     const llm = createConsoleLlm({
    //   apiKey: process.env.GOOGLE_AI_API_KEY as string,
    //   model: 'gemini-1.5-pro-002',
    // });

    if (loaded.agent.status === "paused") {
      logger.info("Agent is paused", { agentId });
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
    const tools = await ToolRegistry.getToolsForAgent(
      loaded.integrations,
      loaded.agent.actions
    );

    // Validation guard: Ensure all tools are FunctionTool instances
    if (!Array.isArray(tools)) {
      throw new Error("ToolRegistry.getToolsForAgent must return an array");
    }

    if (!tools.every((t) => t && typeof t === "object" && "name" in t)) {
      throw new Error("All tools must be valid FunctionTool instances");
    }

    logger.info("Tools loaded for agent", {
      agentId,
      toolCount: tools.length,
      toolNames: tools.map((t) => t.name).slice(0, 10), // Log first 10 tool names
    });

    let actionsCount = 0;
    let tokensUsed = 0;

    // Sanitize agent name for ADK (must be valid identifier: letters, digits, underscores only)
    const sanitizedAgentName = loaded.agent.name.replace(/[^a-zA-Z0-9_]/g, "_");

    // 4. Initialize ADK Agent
    console.log(
      "About to call buildSystemPrompt with payload:",
      JSON.stringify(payload, null, 2)
    );
    const adkAgent = new LlmAgent({
      name: sanitizedAgentName,
      model: "gemini-2.0-flash",
      tools: tools,
      instruction: buildSystemPrompt(
        loaded,
        buildContext(loaded, triggerType, payload, [])
      ), // 'instruction' instead of 'systemPrompt'
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
    const sessionService = new MongoSessionService();
    sessionService.setContext(executionId); // Fix for ADK dropping context

    // Runner config: passing sessionService directly if supported
    // Based on inspection, Runner has 'sessionService'.
    const runner = new Runner({
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
    } as any);
    console.log("runAsync completed");

    let eventCount = 0;
    for await (const event of runGenerator) {
      eventCount++;
      console.log(`ADK EVENT ${eventCount}:`, JSON.stringify(event, null, 2));
      // We can process events here if needed, e.g. streaming thoughts
      // logging thoughts is handled by LlmAgent callbacks or here if event type matches
    }
    console.log(`Total ADK events processed: ${eventCount}`);

    // 8. Process Result & Billing
    const finalState = (await sessionService.load(executionId)) as any;
    console.log("FINAL STATE:", JSON.stringify(finalState, null, 2));

    // Calculate credits (Mock token usage if ADK doesn't return it yet, or use result stats)
    // Assuming result has usage or we estimate.
    // We used 'tokensUsed' variable scope but currently we don't update it.
    // We'll trust finalState or just use actionsCount for now.

    const creditsUsed = calculateCredits(tokensUsed, actionsCount);

    await deductCredits(ownerId, creditsUsed);

    // Update Execution
    execution.status = "success";
    execution.finishedAt = new Date();
    execution.actionsExecuted =
      (finalState?.history
        ?.filter((h: any) => h.role === "tool" || h.role === "function")
        .map((h: any) => ({
          type: h.parts?.[0]?.functionCall?.name || "unknown", // Adjust based on message structure
          // ... simplified mapping
          verified: true,
        })) as any) || [];

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

    await ExecutionEventService.log({
      executionId,
      agentId,
      userId: ownerId,
      type: "execution_completed",
      level: "info",
      message: "Execution completed successfully",
      data: { creditsUsed, actionsCount },
    });

    SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
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
  } catch (error) {
    logger.error("Execution failed", { error });
    execution.status = "failed";
    execution.error = error.message;
    execution.finishedAt = new Date();
    await execution.save();

    await ExecutionEventService.log({
      executionId,
      agentId,
      userId: ownerId,
      type: "execution_failed",
      level: "error",
      message: error.message,
    });

    SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
      executionId: execution._id,
      status: "failed",
      error: execution.error,
    });

    throw error;
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
