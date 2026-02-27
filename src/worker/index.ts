import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { ExecutionJobData, ExecutionJobResult } from "../queue/executionQueue";
import { Execution } from "../models/Execution";
import { Types } from "mongoose";
import { loadAgentOptimized } from "./agentLoaderOptimized";
import { createAllUserTools } from "../tools/registry/masterToolList";
import { buildFocusedContext } from "./contextBuilder";
import {
  CreditManagerService,
  InsufficientCreditsError,
  logger,
} from "../services";
import { PLAN_LIMITS, PlanType } from "../models/User";
import { SocketService } from "../services/SocketService";
import { ExecutionEventService } from "../services/ExecutionEventService";
import { MongoSessionService } from "../services/MongoSessionService";
import { AgentMemoryService } from "../services/AgentMemoryService";
import { ContextManagerService } from "../services/ContextManagerService";
import { UiMappingService } from "../services/UiMappingService";
import { messageEmitter } from "../services/messageEmitter";
import { REQUIRES_APPROVAL } from "../types/messages";
import { User } from "../models/User";
import { Thread } from "../models/Thread";
import { LlmAgent, Runner } from "@google/adk";
import { createPerformanceTimer } from "../utils/performance";

// ============================================
// WORKER - ADK AGENT WITH REASONING & MEMORY
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
      concurrency: 20,
      limiter: {
        max: 100,
        duration: 60000,
      },
    },
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

// ============================================
// HELPERS
// ============================================

const extractConversationText = (msgs: any, maxChars: number): string => {
  if (!Array.isArray(msgs) || msgs.length === 0) return "";
  const lines: string[] = [];
  for (const m of msgs) {
    const role = typeof m?.role === "string" ? m.role : "";
    const content = typeof m?.content === "string" ? m.content : "";
    if (!role || !content) continue;
    lines.push(`${role.toUpperCase()}: ${content}`);
  }
  const joined = lines.join("\n\n");
  return joined.length <= maxChars ? joined : joined.slice(joined.length - maxChars);
};

const getLatestUserInput = (msgs: any): string | null => {
  if (!Array.isArray(msgs) || msgs.length === 0) return null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === "user" && typeof m?.content === "string" && m.content.trim()) {
      return m.content;
    }
  }
  return null;
};

const getFirstMeaningfulUserInput = (msgs: any): string | null => {
  if (!Array.isArray(msgs) || msgs.length === 0) return null;
  for (const m of msgs) {
    if (m?.role !== "user") continue;
    const text = typeof m?.content === "string" ? m.content.trim() : "";
    if (!text) continue;
    const isGreeting = /^(hey|hi|hello|greetings|sup|what's up|howdy)[\s!.,]*$/i.test(text);
    if (isGreeting || text.length < 12) continue;
    return text;
  }
  return null;
};

const normalizeTitleCandidate = (text: string): string => {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[`*_#>\[\]()-]/g, " ")
    .trim();
  return cleaned.split(" ").filter(Boolean).slice(0, 8).join(" ");
};

const shouldReplaceThreadTitle = (title: any): boolean => {
  const t = typeof title === "string" ? title.trim() : "";
  if (!t) return true;
  if (/^(hey|hi|hello|greetings)[\s!.,]*$/i.test(t)) return true;
  if (t.length <= 10) return true;
  return false;
};

const normalizeToolInput = (input: any): Record<string, any> => {
  if (input && typeof input === "object" && !Array.isArray(input)) return input;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return { input };
};

// ============================================
// MAIN JOB PROCESSOR
// ============================================

const processJob = async (
  job: Job<ExecutionJobData, ExecutionJobResult>,
): Promise<ExecutionJobResult> => {
  const { executionId, agentId, ownerId, triggerType, payload, triggerId } = job.data;
  const perf = createPerformanceTimer();
  const runStartedAtMs = Date.now();

  const effectivePayload: Record<string, any> = { ...(payload || {}) };

  // ── Trigger loading ──────────────────────────────────────────────────────────
  let trigger = null;
  if (triggerId) {
    try {
      const { Trigger } = await import("../models/Trigger");
      trigger = await Trigger.findById(triggerId);

      if (!trigger) {
        return { success: false, actionsExecuted: 0, creditsUsed: 0, error: "Trigger not found" };
      }
      if (!trigger.enabled) {
        return { success: false, actionsExecuted: 0, creditsUsed: 0, error: "Trigger is disabled" };
      }

      trigger.lastRunAt = new Date();
      await trigger.save();
      effectivePayload.input = trigger.customInstruction;

      logger.info("Processing trigger-based execution", { executionId, agentId, triggerId });
    } catch (error: any) {
      logger.error(`Error loading trigger ${triggerId}:`, error);
      return { success: false, actionsExecuted: 0, creditsUsed: 0, error: `Failed to load trigger: ${error.message}` };
    }
  }

  // ── Thread context pre-load ──────────────────────────────────────────────────
  if (effectivePayload.threadId && !effectivePayload.githubRepo) {
    try {
      const thread = await ContextManagerService.getThread({ ownerId, threadId: effectivePayload.threadId });
      const threadGithubRepo = (thread as any)?.metadata?.githubRepo;
      const threadCurrentContext = (thread as any)?.metadata?.currentContext;

      if (threadGithubRepo?.owner && threadGithubRepo?.repo) {
        effectivePayload.githubRepo = { owner: threadGithubRepo.owner, repo: threadGithubRepo.repo, ref: threadGithubRepo.ref };
      }
      if (!effectivePayload.requestedFiles && Array.isArray(threadGithubRepo?.requestedFiles)) {
        effectivePayload.requestedFiles = threadGithubRepo.requestedFiles;
      }
      if (threadCurrentContext && !effectivePayload.currentContext) {
        effectivePayload.currentContext = threadCurrentContext;
      }
    } catch { /* continue without thread context */ }
  }

  // ── Shared telemetry state (accessible in catch/finally) ────────────────────
  let finalResponse = "";
  let reasoningText = "";
  let responseText = "";
  let tokensUsed = 0;
  const traces: any[] = [];
  let traceSeq = 0;
  let adkEventSeq = 0;
  const adkEventStream: any[] = [];
  const candidatePartsStream: Array<{ seq: number; timestamp: number; parts: any[] }> = [];
  let latestUsageMetadata: any = null;
  let latestGroundingMetadata: any = null;
  const groundingSources: Array<{ uri?: string; title?: string }> = [];
  let executionSucceeded = false;
  let toolCallsCompleted = 0;
  let creditsDeductedTotal = 0;
  const actionsExecuted: Array<{
    type: string;
    params?: Record<string, unknown>;
    result?: unknown;
    error?: string;
    startedAt?: Date;
    finishedAt?: Date;
    durationMs?: number;
  }> = [];

  // ── Mark execution as running ────────────────────────────────────────────────
  const execution = await Execution.findById(executionId);
  if (!execution) throw new Error(`Execution not found: ${executionId}`);

  if (triggerId && !execution.triggerId) {
    execution.triggerId = new Types.ObjectId(triggerId);
  }
  execution.status = "running";
  execution.startedAt = new Date();
  await execution.save();

  await ExecutionEventService.log({
    executionId, agentId, userId: ownerId,
    type: "execution_started", level: "info",
    message: `Execution started (${triggerType})`,
    data: { triggerType, payload },
  });

  SocketService.getInstance().emitToAgent(agentId, "execution:started", {
    executionId: execution._id,
    status: "running",
  });

  // ── Helpers scoped to this job ───────────────────────────────────────────────
  const emitAxleLog = async (
    level: "debug" | "info" | "warn" | "error",
    line: string,
    data?: Record<string, any>,
  ) => {
    SocketService.getInstance().emitToAgent(agentId, "execution:event", {
      executionId,
      event: { type: "axle_log", level, line, data, timestamp: Date.now() },
    });
    await ExecutionEventService.log({
      executionId, agentId, userId: ownerId,
      type: "axle_log", level, message: line, data,
    });
  };

  const emitTrace = async (trace: any) => {
    const enriched = { seq: ++traceSeq, timestamp: Date.now(), ...trace };
    traces.push(enriched);
    SocketService.getInstance().emitToAgent(agentId, "execution:trace", { executionId, trace: enriched });
  };

  try {
    messageEmitter.emitThinking(executionId, "Processing your request...", "init");

    // ── Parallel DB loads ──────────────────────────────────────────────────────
    perf.mark("start_parallel_loads");

    const [loaded, threadContext] = await Promise.all([
      loadAgentOptimized(agentId, ownerId),
      effectivePayload.threadId
        ? ContextManagerService.getThread({ ownerId, threadId: effectivePayload.threadId }).catch(() => null)
        : Promise.resolve(null),
    ]);

    perf.mark("db_loads_complete");

    // Apply thread context if loaded
    if (threadContext) {
      const threadGithubRepo = (threadContext as any)?.metadata?.githubRepo;
      const threadCurrentContext = (threadContext as any)?.metadata?.currentContext;

      if (threadGithubRepo?.owner && threadGithubRepo?.repo && !effectivePayload.githubRepo) {
        effectivePayload.githubRepo = { owner: threadGithubRepo.owner, repo: threadGithubRepo.repo, ref: threadGithubRepo.ref };
      }
      if (!effectivePayload.requestedFiles && Array.isArray(threadGithubRepo?.requestedFiles)) {
        effectivePayload.requestedFiles = threadGithubRepo.requestedFiles;
      }
      if (threadCurrentContext && !effectivePayload.currentContext) {
        effectivePayload.currentContext = threadCurrentContext;
      }
    }

    const userMessageForEstimate =
      effectivePayload?.input ||
      effectivePayload?.task ||
      "Execute the assigned task";

    // ── Fire-and-forget thread title update ───────────────────────────────────
    if (effectivePayload.threadId) {
      Thread.findOne({ _id: effectivePayload.threadId, ownerId })
        .then(thread => {
          if (!thread || !shouldReplaceThreadTitle(thread.title)) return;
          const baseText =
            getFirstMeaningfulUserInput(effectivePayload?.messages) ||
            (typeof effectivePayload?.input === "string" ? effectivePayload.input : "") ||
            (typeof effectivePayload?.task === "string" ? effectivePayload.task : "") ||
            "Conversation";
          const nextTitle = normalizeTitleCandidate(baseText);
          if (nextTitle && nextTitle !== thread.title) {
            thread.title = nextTitle;
            thread.save().catch(err => logger.error("Failed to update thread title:", err));
          }
        })
        .catch(() => { /* ignore */ });
    }

    // ── Pre-flight credit check ────────────────────────────────────────────────
    const preflightEstimate = CreditManagerService.estimateTaskCredits({ userMessage: userMessageForEstimate });
    await CreditManagerService.assertHasCredits({ userId: ownerId, required: preflightEstimate });

    if (loaded.agent.status === "paused") {
      execution.status = "failed";
      execution.error = "Agent is paused";
      await execution.save();
      return { success: false, actionsExecuted: 0, creditsUsed: 0, error: "Agent is paused" };
    }

    // ── Build tools ────────────────────────────────────────────────────────────
    const agentName = loaded.agent.name.replace(/[^a-zA-Z0-9_]/g, "_");
    const tools = createAllUserTools(ownerId, agentId);

    perf.mark("tools_loaded");
    messageEmitter.emitThinking(executionId, `Loaded ${(tools as any[])?.length ?? 0} tools`, "tools");

    // ── Wrap tools: emit events + approval gating ──────────────────────────────
    const toolStartTimes = new Map<string, number>();

    for (const t of tools as any[]) {
      const toolName = (t as any)?.name;
      const originalExecute = (t as any)?.execute;
      if (!toolName || typeof originalExecute !== "function") continue;

      (t as any).execute = async (input: any, context: any) => {
        const toolInput = normalizeToolInput(input);

        messageEmitter.emitToolCall(executionId, toolName, toolInput);

        // Approval gate (skip for scheduled triggers)
        if ((REQUIRES_APPROVAL as readonly string[]).includes(toolName) && !triggerId) {
          const approved = await messageEmitter.emitApprovalRequest(
            executionId, ownerId.toString(), toolName, toolInput,
          );
          if (!approved) {
            const skippedResult = { success: false, error: "User rejected approval", toolName };
            messageEmitter.emitToolResult(executionId, toolName, skippedResult, true);
            return skippedResult;
          }
        }

        try {
          const toolResult = await originalExecute(input, context);
          messageEmitter.emitToolResult(executionId, toolName, toolResult, true);
          return toolResult;
        } catch (error: any) {
          messageEmitter.emitError(executionId, error?.message || error);
          throw error;
        }
      };
    }

    // ── GitHub repo scoping ────────────────────────────────────────────────────
    const selectedRepo = effectivePayload?.githubRepo;
    if (selectedRepo?.owner && selectedRepo?.repo) {
      const githubToolsNeedingRepo = new Set<string>([
        "create_issue", "list_pull_requests", "get_file_contents",
        "create_or_update_file", "github_get_readme", "github_list_issues",
        "github_add_issue_comment", "github_update_file", "github_delete_file",
      ]);

      for (const t of tools as any[]) {
        const toolName = (t as any)?.name;
        if (!toolName || !githubToolsNeedingRepo.has(toolName)) continue;

        const originalExecute = (t as any).execute;
        if (typeof originalExecute !== "function") continue;

        (t as any).execute = async (input: any, context: any) => {
          let params: any = input;
          if (typeof input === "string") {
            try { params = JSON.parse(input); } catch { params = input; }
          }

          if (params && typeof params === "object") {
            if (!(typeof params.owner === "string" && params.owner.trim())) params.owner = selectedRepo.owner;
            if (!(typeof params.repo === "string" && params.repo.trim())) params.repo = selectedRepo.repo;

            if (params.owner !== selectedRepo.owner || params.repo !== selectedRepo.repo) {
              throw new Error(
                `GitHub tool blocked: ${toolName} attempted ${params.owner}/${params.repo} but thread is scoped to ${selectedRepo.owner}/${selectedRepo.repo}`,
              );
            }
          }

          return originalExecute(params, context);
        };
      }
    }

    logger.info(`[WORKER] Initializing agent with ${tools.length} tools`, { agentId, toolCount: tools.length });

    // ── Build system prompt ────────────────────────────────────────────────────
    const systemPrompt = await buildFocusedContext(loaded, effectivePayload);

    perf.mark("context_built");

    const cleanSystemPrompt = systemPrompt
      .replace(/\$\{agentId\}/g, agentId)
      .replace(/\$\{userId\}/g, ownerId.toString())
      .replace(/\$\{executionId\}/g, executionId);

    // ── Resolve model ──────────────────────────────────────────────────────────
    const brainModelRaw = typeof loaded?.agent?.brain?.model === "string"
      ? loaded.agent.brain.model.trim()
      : "";
    const brainModel = brainModelRaw.includes("/")
      ? brainModelRaw.split("/").pop() || ""
      : brainModelRaw;
    const agentModelId =
      brainModel && /^gemini[\w\-\.]*$/i.test(brainModel)
        ? brainModel
        : "gemini-2.5-pro";

    // ── Initialize ADK Agent ───────────────────────────────────────────────────
    let adkAgent: LlmAgent;
    try {
      adkAgent = new LlmAgent({
        name: agentName,
        model: "gemini-2.5-pro",
        tools: tools,
        instruction: cleanSystemPrompt,
        generateContentConfig: {
          maxOutputTokens: 18000,
          // Lower temperature for reliable reasoning and tool use.
          // 1.0 provides creativity while maintaining coherence.
          // gemini-2.5-pro handles thinking internally — no need to push randomness.
          temperature: 1.2,
        },
        context: {
          agentId,
          userId: ownerId.toString(),
          executionId,
        },
      });
    } catch (error: any) {
      logger.error("Failed to initialize ADK agent", { error: error.message, agentId, agentName });
      throw new Error(`Failed to initialize agent: ${error.message}`);
    }

    perf.mark("agent_initialized");

    // ── Initialize Runner ──────────────────────────────────────────────────────
    const sessionService = new MongoSessionService();
    const runner = new Runner({
      agent: adkAgent,
      sessionService,
      appName: "axle",
    });

    // ── Persist user message to memory ─────────────────────────────────────────
    await AgentMemoryService.appendMessage({
      agentId,
      role: "user",
      content: userMessageForEstimate,
      metadata: { source: "worker", executionId },
    });

    // ── Deduct base execution cost up-front ────────────────────────────────────
    const userStartCredits = loaded.user.credits;
    const userPlan = (loaded.user.plan as PlanType) || "free";
    const planLimit = PLAN_LIMITS[userPlan]?.monthlyCredits || PLAN_LIMITS.free.monthlyCredits;
    let tokenCreditsCharged = 0;

    const emitCreditsUpdated = async (params: {
      reason: "estimate" | "tool" | "tokens" | "final";
      delta: number;
      creditsRemaining: number;
      creditsUsed: number;
      tokensUsed?: number;
      toolCallsCompleted?: number;
    }) => {
      SocketService.getInstance().emitToAgent(agentId, "credits-updated", {
        executionId,
        ...params,
        creditsLimit: planLimit,
        timestamp: Date.now(),
      });
    };

    {
      const baseRes = await CreditManagerService.deductCreditsAtomic({
        userId: ownerId,
        amount: CreditManagerService.BASE_TASK_WEIGHT,
      });
      if (!baseRes.ok) {
        const available = await CreditManagerService.getUserCredits(ownerId);
        throw new InsufficientCreditsError({ available, required: CreditManagerService.BASE_TASK_WEIGHT });
      }
      creditsDeductedTotal += CreditManagerService.BASE_TASK_WEIGHT;
      await emitCreditsUpdated({
        reason: "estimate",
        delta: CreditManagerService.BASE_TASK_WEIGHT,
        creditsRemaining: baseRes.credits ?? Math.max(0, userStartCredits - creditsDeductedTotal),
        creditsUsed: creditsDeductedTotal,
        toolCallsCompleted,
      });
    }

    // ============================================================
    // SINGLE-PASS ADK EXECUTION
    // ============================================================
    // ADK's runner.runAsync() handles the COMPLETE agentic loop:
    //   user message → model thinks → calls tool → gets result →
    //   model thinks again → calls next tool → ... → final response
    //
    // DO NOT loop externally or re-inject tool outputs as messages.
    // All events (text deltas, function calls, function responses)
    // arrive in one contiguous async-iterable stream.
    // ============================================================

    SocketService.getInstance().emitToAgent(agentId, "execution:status", {
      executionId,
      status: "running",
      message: "Starting…",
      timestamp: Date.now(),
    });

    const toolOutputs: Array<{ tool: string; output: any; timestamp: number }> = [];

    try {
      const runResult = runner.runAsync({
        userId: ownerId,
        sessionId: executionId,
        newMessage: {
          role: "user",
          parts: [{ text: userMessageForEstimate }],
        },
      });

      for await (const event of runResult) {
        const eventSeq = ++adkEventSeq;
        const eventTs = Date.now();
        adkEventStream.push({ seq: eventSeq, timestamp: eventTs, event });

        // ── Capture candidate parts for debugging ──────────────────────────
        const partsFromCandidate =
          (event as any)?.candidate?.content?.parts ||
          (event as any)?.candidates?.[0]?.content?.parts ||
          (event as any)?.content?.parts ||
          null;
        if (Array.isArray(partsFromCandidate) && partsFromCandidate.length) {
          candidatePartsStream.push({ seq: eventSeq, timestamp: eventTs, parts: partsFromCandidate });
        }

        // ── Capture metadata ───────────────────────────────────────────────
        const usageMetadata =
          (event as any).usageMetadata ||
          (event as any).content?.usageMetadata ||
          (event as any).response?.usageMetadata ||
          null;

        const groundingMetadata =
          (event as any).groundingMetadata ||
          (event as any).content?.groundingMetadata ||
          (event as any)?.candidate?.groundingMetadata ||
          (event as any)?.candidates?.[0]?.groundingMetadata ||
          null;

        if (usageMetadata) latestUsageMetadata = usageMetadata;

        if (groundingMetadata) {
          latestGroundingMetadata = groundingMetadata;
          const chunks = (groundingMetadata as any)?.groundingChunks || (groundingMetadata as any)?.grounding_chunks || [];
          if (Array.isArray(chunks)) {
            for (const ch of chunks) {
              const web = (ch as any)?.web || (ch as any)?.webChunk || (ch as any)?.source;
              const uri = web?.uri || web?.url;
              const title = web?.title;
              if (uri && !groundingSources.some(s => s.uri === uri)) {
                groundingSources.push({ uri, title });
              }
            }
          }
        }

        const finishReason = (event as any).finishReason || (event as any).content?.finishReason;
        if (usageMetadata || finishReason) {
          await emitTrace({ kind: "model_metadata", usageMetadata, finishReason, groundingMetadata, rawEvent: event });
        }

        // ── Text streaming ─────────────────────────────────────────────────
        // ADK emits text in content.parts[].text — stream each delta immediately.
        let textDelta: string | null = null;

        if ((event as any).type === "text" && typeof (event as any).content === "string") {
          textDelta = (event as any).content;
        } else if (Array.isArray((event as any).content?.parts)) {
          for (const part of (event as any).content.parts) {
            if (part?.thought === true && typeof part?.text === "string") {
              // Gemini 2.5 thinking traces — route to reasoning channel
              reasoningText += part.text;
              SocketService.getInstance().emitToAgent(agentId, "execution:reasoning_delta", {
                executionId,
                delta: part.text,
                timestamp: Date.now(),
              });
            } else if (typeof part?.text === "string") {
              textDelta = (textDelta || "") + part.text;
            }
          }
        }

        if (textDelta) {
          finalResponse += textDelta;
          responseText += textDelta;
          SocketService.getInstance().emitToAgent(agentId, "execution:response_delta", {
            executionId,
            delta: textDelta,
            timestamp: Date.now(),
          });
        }

        // ── Function call (tool invocation) ───────────────────────────────
        const functionCall =
          (event as any).content?.parts?.find?.((p: any) => p?.functionCall)?.functionCall ||
          (event as any).functionCall ||
          null;

        if (functionCall) {
          const toolName = functionCall.name;
          const toolArgs = functionCall.args || {};

          SocketService.getInstance().emitToAgent(agentId, "execution:status", {
            executionId,
            status: "tool_calling",
            message: `Running ${toolName}…`,
            toolName,
            timestamp: Date.now(),
          });

          const startTime = Date.now();
          toolStartTimes.set(toolName, startTime);
          actionsExecuted.push({ type: toolName, params: toolArgs, startedAt: new Date(startTime) });

          messageEmitter.emitThinking(executionId, `Running ${toolName}…`, "tool");

          SocketService.getInstance().emitToAgent(agentId, "execution:action", {
            executionId,
            type: toolName,
            status: "running",
            functionCall,
          });

          await emitTrace({ kind: "function_call", toolName, functionCall, rawEvent: event });
        }

        // ── Function response (tool result) ───────────────────────────────
        const functionResponse =
          (event as any).content?.parts?.find?.((p: any) => p?.functionResponse)?.functionResponse ||
          (event as any).functionResponse ||
          null;

        if (functionResponse) {
          const toolName = functionResponse.name;
          const raw = (functionResponse as any).response;

          let parsedResult: any = raw;
          if (typeof raw === "string") {
            try { parsedResult = JSON.parse(raw); } catch { parsedResult = raw; }
          }

          const uiWrapped = UiMappingService.wrap({ toolName, output: parsedResult });
          toolOutputs.push({ tool: toolName, output: uiWrapped, timestamp: Date.now() });

          // Finalize action record
          if (toolStartTimes.has(toolName)) {
            const startedAt = toolStartTimes.get(toolName)!;
            const finishedAt = Date.now();
            const durationMs = finishedAt - startedAt;
            toolStartTimes.delete(toolName);

            await emitAxleLog("info", `[TOOL] ${toolName} completed in ${(durationMs / 1000).toFixed(1)}s`, { tool: toolName, durationMs });

            const actionIndex = actionsExecuted.findLastIndex(a => a.type === toolName && !a.finishedAt);
            if (actionIndex >= 0) {
              actionsExecuted[actionIndex].finishedAt = new Date(finishedAt);
              actionsExecuted[actionIndex].durationMs = durationMs;
              actionsExecuted[actionIndex].result = parsedResult;
            }
          }

          // Emit research logs if present
          const maybeLogs = parsedResult?.researchLogs;
          if (Array.isArray(maybeLogs)) {
            for (const l of maybeLogs) {
              if (typeof l === "string" && l.startsWith("[RESEARCH]")) {
                await emitAxleLog("info", l);
              }
            }
          }

          SocketService.getInstance().emitToAgent(agentId, "execution:action", {
            executionId,
            type: toolName,
            status: "completed",
            result: parsedResult,
            output: uiWrapped,
            ...(uiWrapped ? { toolOutput: uiWrapped } : {}),
          });

          await emitTrace({ kind: "function_response", toolName, functionResponse, rawEvent: event });

          // Charge per-tool credit
          toolCallsCompleted += 1;
          const toolDelta = CreditManagerService.TOOL_TASK_WEIGHT;
          const toolRes = await CreditManagerService.deductCreditsAtomic({ userId: ownerId, amount: toolDelta });
          if (!toolRes.ok) {
            const available = await CreditManagerService.getUserCredits(ownerId);
            throw new InsufficientCreditsError({ available, required: toolDelta });
          }
          creditsDeductedTotal += toolDelta;
          await emitCreditsUpdated({
            reason: "tool",
            delta: toolDelta,
            creditsRemaining: toolRes.credits ?? Math.max(0, userStartCredits - creditsDeductedTotal),
            creditsUsed: creditsDeductedTotal,
            tokensUsed,
            toolCallsCompleted,
          });
        }

        // ── Token usage billing (delta-billed) ────────────────────────────
        const eventUsage = (event as any).usage || usageMetadata;
        if (eventUsage) {
          const newTokensUsed = eventUsage.totalTokens || eventUsage.total_tokens || tokensUsed;
          if (newTokensUsed > tokensUsed) {
            tokensUsed = newTokensUsed;
          }

          const tokenCreditsTotal = CreditManagerService.calculateTokenCredits(tokensUsed);
          const tokenDelta = Math.max(0, tokenCreditsTotal - tokenCreditsCharged);
          if (tokenDelta > 0) {
            const tokenRes = await CreditManagerService.deductCreditsAtomic({ userId: ownerId, amount: tokenDelta });
            if (!tokenRes.ok) {
              const available = await CreditManagerService.getUserCredits(ownerId);
              throw new InsufficientCreditsError({ available, required: tokenDelta });
            }
            tokenCreditsCharged = tokenCreditsTotal;
            creditsDeductedTotal += tokenDelta;
            await emitCreditsUpdated({
              reason: "tokens",
              delta: tokenDelta,
              creditsRemaining: tokenRes.credits ?? Math.max(0, userStartCredits - creditsDeductedTotal),
              creditsUsed: creditsDeductedTotal,
              tokensUsed,
              toolCallsCompleted,
            });
          }

          await emitAxleLog("debug", `[BILLING] ${tokensUsed} tokens used. Balance: ${Math.max(0, userStartCredits - creditsDeductedTotal)}/${planLimit}`, {
            tokensUsed,
            creditsSoFar: creditsDeductedTotal,
            creditsRemaining: Math.max(0, userStartCredits - creditsDeductedTotal),
            creditsLimit: planLimit,
          });
        }

        // Forward raw event to client for debugging
        SocketService.getInstance().emitToAgent(agentId, "execution:event", {
          executionId,
          event: { ...event, timestamp: Date.now() },
        });
      }

      // ADK completed the full agentic loop
      executionSucceeded = true;

    } catch (error) {
      logger.error("ADK Runner failed", { error });
      throw error;
    }

    // Strip any leftover task-done markers
    if (finalResponse.includes("<TASK_DONE/>")) {
      finalResponse = finalResponse.replaceAll("<TASK_DONE/>", "");
    }

    SocketService.getInstance().emitToAgent(agentId, "execution:status", {
      executionId,
      status: "completed",
      message: "Done.",
      timestamp: Date.now(),
    });

    // ── Final billing reconciliation ───────────────────────────────────────────
    const actualTokensUsed = tokensUsed > 0 ? tokensUsed : Math.ceil(finalResponse.length / 4);
    const tokenCreditsTotal = CreditManagerService.calculateTokenCredits(actualTokensUsed);
    const targetTotalCredits =
      CreditManagerService.BASE_TASK_WEIGHT +
      toolCallsCompleted * CreditManagerService.TOOL_TASK_WEIGHT +
      tokenCreditsTotal;

    const finalDelta = Math.max(0, targetTotalCredits - creditsDeductedTotal);
    if (finalDelta > 0) {
      const res = await CreditManagerService.deductCreditsAtomic({ userId: ownerId, amount: finalDelta });
      if (!res.ok) {
        const available = await CreditManagerService.getUserCredits(ownerId);
        throw new InsufficientCreditsError({ available, required: finalDelta });
      }
      creditsDeductedTotal += finalDelta;
      await emitCreditsUpdated({
        reason: "final",
        delta: finalDelta,
        creditsRemaining: res.credits ?? Math.max(0, userStartCredits - creditsDeductedTotal),
        creditsUsed: creditsDeductedTotal,
        tokensUsed: actualTokensUsed,
        toolCallsCompleted,
      });
    }

    const creditsUsed = creditsDeductedTotal;

    const refreshedUser = await User.findById(ownerId).select("plan credits").lean();
    if (refreshedUser) {
      const refreshedPlan = (refreshedUser.plan as PlanType) || "free";
      const refreshedLimit = PLAN_LIMITS[refreshedPlan]?.monthlyCredits || PLAN_LIMITS.free.monthlyCredits;
      await emitAxleLog("info", `[BILLING] ${actualTokensUsed} tokens used. Balance: ${refreshedUser.credits}/${refreshedLimit}`, {
        tokensUsed: actualTokensUsed,
        creditsDeducted: creditsUsed,
        creditsRemaining: refreshedUser.credits,
        creditsLimit: refreshedLimit,
      });
    }

    // ── Return result immediately, fire-and-forget post-processing ─────────────
    const result: ExecutionJobResult = { success: true, actionsExecuted: toolCallsCompleted, creditsUsed };

    Promise.all([
      (async () => {
        execution.status = "success";
        execution.finishedAt = new Date();
        execution.executionResult = {
          version: 1,
          run: {
            startedAt: execution.startedAt || new Date(runStartedAtMs),
            finishedAt: execution.finishedAt,
            executionTimeMs: Date.now() - runStartedAtMs,
          },
          adk: {
            eventStream: adkEventStream,
            candidateParts: candidatePartsStream,
            usageMetadata: latestUsageMetadata,
            groundingMetadata: latestGroundingMetadata,
            groundingSources,
          },
        };
        execution.outputPayload = {
          result: responseText || finalResponse || "Task completed",
          reasoning: reasoningText,
          confidence: "high",
          toolOutputs,
        };
        execution.creditsUsed = creditsUsed;
        execution.aiTokensUsed = actualTokensUsed;
        execution.aiResponse = responseText || finalResponse;
        execution.reasoning = reasoningText;
        execution.traces = traces;
        execution.actionsExecuted = actionsExecuted;
        await execution.save();
      })(),

      (async () => {
        const assistantMessage = responseText || finalResponse;
        if (assistantMessage) {
          await AgentMemoryService.appendMessage({
            agentId,
            role: "assistant",
            content: assistantMessage,
            metadata: { source: "worker", executionId, tokensUsed: actualTokensUsed },
          });
        }
      })(),

      (async () => {
        if (triggerId && trigger) {
          try {
            await AgentMemoryService.appendMessage({
              agentId, role: "user",
              content: trigger.customInstruction,
              metadata: { source: "scheduled", triggerId, executionId },
            });
            const assistantMessage = responseText || finalResponse;
            if (assistantMessage) {
              await AgentMemoryService.appendMessage({
                agentId, role: "assistant",
                content: assistantMessage,
                metadata: { source: "scheduled", triggerId, executionId, tokensUsed: actualTokensUsed },
              });
            }
          } catch (error: any) {
            logger.error("Failed to save trigger execution to memory:", error);
          }
        }
      })(),

      (async () => {
        const latestUserText =
          getLatestUserInput(effectivePayload?.messages) ||
          (typeof effectivePayload?.input === "string" ? effectivePayload.input : "") ||
          (typeof effectivePayload?.task === "string" ? effectivePayload.task : "");

        if (latestUserText && (responseText || finalResponse)) {
          await AgentMemoryService.extractAndLearn({
            userId: ownerId.toString(),
            agentId,
            execution: {
              task: latestUserText,
              response: responseText || finalResponse,
              toolsUsed: actionsExecuted.map(a => a.type),
              duration: Date.now() - runStartedAtMs,
              userFeedback: undefined,
            },
          }).catch(err => logger.error("extractAndLearn failed (non-blocking)", { error: err }));
        }
      })(),

      ExecutionEventService.log({
        executionId, agentId, userId: ownerId,
        type: "execution_completed", level: "info",
        message: "ADK Agent execution completed successfully",
        data: { creditsUsed, tokensUsed: actualTokensUsed },
      }),
    ]).catch(err => logger.error("Post-execution tasks failed (non-blocking):", err));

    messageEmitter.emitText(executionId, responseText || finalResponse, "assistant");
    SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
      executionId: execution._id,
      status: "success",
    });

    perf.mark("execution_complete");
    perf.logBreakdown(executionId);

    return result;

  } catch (error: any) {
    logger.error("Execution failed", { error });

    execution.status = "failed";
    execution.error = error instanceof Error ? error.message : String(error);
    execution.finishedAt = new Date();
    execution.executionResult = {
      version: 1,
      run: {
        startedAt: execution.startedAt || new Date(runStartedAtMs),
        finishedAt: execution.finishedAt,
        executionTimeMs: Date.now() - runStartedAtMs,
      },
      adk: {
        eventStream: adkEventStream,
        candidateParts: candidatePartsStream,
        usageMetadata: latestUsageMetadata,
        groundingMetadata: latestGroundingMetadata,
        groundingSources,
      },
    };
    execution.aiResponse = responseText || finalResponse;
    execution.reasoning = reasoningText;
    execution.traces = traces;
    await execution.save();

    await ExecutionEventService.log({
      executionId, agentId, userId: ownerId,
      type: "execution_failed", level: "error",
      message: error.message,
    });

    SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
      executionId: execution._id,
      status: "failed",
      error: execution.error,
      ...(error?.code === "INSUFFICIENT_CREDITS" ? { required: error.required, available: error.available } : {}),
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