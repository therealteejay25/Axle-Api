import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { ExecutionJobData, ExecutionJobResult } from "../queue/executionQueue";
import { Execution } from "../models/Execution";
import { loadAgent } from "./agentLoader";
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
import { GithubContextProvider } from "../services/GithubContextProvider";
import { ContextManagerService } from "../services/ContextManagerService";
import { UiMappingService } from "../services/UiMappingService";
import { messageEmitter } from "../services/messageEmitter";
import { REQUIRES_APPROVAL } from "../types/messages";
import { User } from "../models/User";
import { Thread } from "../models/Thread";
import { LlmAgent, Runner } from "@google/adk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

// ============================================
// WORKER - ADK AGENT WITH REASONING & MEMORY
// ============================================
// Orchestrated agent execution with tools, reasoning loop, and persistent memory
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
      concurrency: 5,
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

const processJob = async (
  job: Job<ExecutionJobData, ExecutionJobResult>,
): Promise<ExecutionJobResult> => {
  const { executionId, agentId, ownerId, triggerType, payload } = job.data;

  const runStartedAtMs = Date.now();

  const effectivePayload: Record<string, any> = { ...(payload || {}) };

  const extractConversationText = (msgs: any, maxChars: number): string => {
    if (!Array.isArray(msgs) || msgs.length === 0) return "";

    const lines: string[] = [];
    for (const m of msgs) {
      const role = typeof m?.role === "string" ? m.role : "";
      const content = typeof m?.content === "string" ? m.content : "";
      if (!role || !content) continue;
      // Keep tool messages too, but label them clearly.
      lines.push(`${role.toUpperCase()}: ${content}`);
    }

    const joined = lines.join("\n\n");
    if (joined.length <= maxChars) return joined;
    return joined.slice(joined.length - maxChars);
  };

  const getLatestUserInput = (msgs: any): string | null => {
    if (!Array.isArray(msgs) || msgs.length === 0) return null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (
        m?.role === "user" &&
        typeof m?.content === "string" &&
        m.content.trim()
      ) {
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
      const isGreeting = /^(hey|hi|hello|greetings|sup|what's up|howdy)[\s!.,]*$/i.test(
        text,
      );
      if (isGreeting) continue;
      if (text.length < 12) continue;
      return text;
    }
    return null;
  };

  const normalizeTitleCandidate = (text: string): string => {
    const cleaned = String(text || "")
      .replace(/\s+/g, " ")
      .replace(/[`*_#>\[\]()-]/g, " ")
      .trim();
    const words = cleaned.split(" ").filter(Boolean);
    return words.slice(0, 8).join(" ");
  };

  const shouldReplaceThreadTitle = (title: any): boolean => {
    const t = typeof title === "string" ? title.trim() : "";
    if (!t) return true;
    const looksGreeting = /^(hey|hi|hello|greetings)[\s!.,]*$/i.test(t);
    if (looksGreeting) return true;
    if (t.length <= 10) return true;
    return false;
  };

  // If a thread is provided, load cached repo context unless the caller explicitly overrides.
  if (effectivePayload.threadId && !effectivePayload.githubRepo) {
    try {
      const thread = await ContextManagerService.getThread({
        ownerId,
        threadId: effectivePayload.threadId,
      });

      const threadGithubRepo = (thread as any)?.metadata?.githubRepo;
      const threadCurrentContext = (thread as any)?.metadata?.currentContext;

      if (threadGithubRepo?.owner && threadGithubRepo?.repo) {
        effectivePayload.githubRepo = {
          owner: threadGithubRepo.owner,
          repo: threadGithubRepo.repo,
          ref: threadGithubRepo.ref,
        };
      }

      if (
        !effectivePayload.requestedFiles &&
        Array.isArray(threadGithubRepo?.requestedFiles)
      ) {
        effectivePayload.requestedFiles = threadGithubRepo.requestedFiles;
      }

      if (threadCurrentContext && !effectivePayload.currentContext) {
        effectivePayload.currentContext = threadCurrentContext;
      }
    } catch {
      // If thread context fails to load, continue without it.
    }
  }

  // Planning client removed - no planning phase needed

  const emitAxleLog = async (
    level: "debug" | "info" | "warn" | "error",
    line: string,
    data?: Record<string, any>,
  ) => {
    SocketService.getInstance().emitToAgent(agentId, "execution:event", {
      executionId,
      event: {
        type: "axle_log",
        level,
        line,
        data,
        timestamp: Date.now(),
      },
    });

    await ExecutionEventService.log({
      executionId,
      agentId,
      userId: ownerId,
      type: "axle_log",
      level,
      message: line,
      data,
    });
  };

  // Error conversion removed - use real errors for transparency

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

  let finalResponse = "";
  let reasoningText = "";
  let responseText = "";
  let tokensUsed = 0;
  const traces: any[] = [];
  let traceSeq = 0;
  let inThoughtBlock = false;
  let adkEventSeq = 0;
  const adkEventStream: any[] = [];
  const candidatePartsStream: Array<{
    seq: number;
    timestamp: number;
    parts: any[];
  }> = [];
  let latestUsageMetadata: any = null;
  let latestGroundingMetadata: any = null;
  const groundingSources: Array<{ uri?: string; title?: string }> = [];

  // IMPORTANT: Declare these at function scope so they're accessible in finally/catch
  let taskComplete = false;
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

  try {
    messageEmitter.emitThinking(
      executionId,
      "Processing your request...",
      "init",
    );

    // 2. Load Agent & Integrations
    const loaded = await loadAgent(agentId, ownerId);

    const userMessageForEstimate =
      effectivePayload?.input ||
      effectivePayload?.task ||
      "Execute the assigned task";

    if (effectivePayload.threadId) {
      try {
        const thread = await Thread.findOne({
          _id: effectivePayload.threadId,
          ownerId,
        });
        if (thread && shouldReplaceThreadTitle(thread.title)) {
          const baseText =
            getFirstMeaningfulUserInput(effectivePayload?.messages) ||
            (typeof effectivePayload?.input === "string"
              ? effectivePayload.input
              : "") ||
            (typeof effectivePayload?.task === "string"
              ? effectivePayload.task
              : "") ||
            "Conversation";
          const nextTitle = normalizeTitleCandidate(baseText);
          if (nextTitle && nextTitle !== thread.title) {
            thread.title = nextTitle;
            await thread.save();
          }
        }
      } catch {
        // ignore thread title updates
      }
    }

    // Pre-flight credit guardrail (before planning / runner)
    const preflightEstimate = CreditManagerService.estimateTaskCredits({
      userMessage: userMessageForEstimate,
    });
    await CreditManagerService.assertHasCredits({
      userId: ownerId,
      required: preflightEstimate,
    });

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

    // Create user-specific tools - each tool gets the userId embedded
    const allTools = createAllUserTools(ownerId, agentId);

    // Always use all tools - context should not restrict tool availability
    const tools = allTools;

    messageEmitter.emitThinking(
      executionId,
      `Loaded ${(tools as any[])?.length ?? 0} tools`,
      "tools",
    );

    const normalizeToolInput = (input: any): Record<string, any> => {
      if (input && typeof input === "object" && !Array.isArray(input)) return input;
      if (typeof input === "string") {
        try {
          const parsed = JSON.parse(input);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
          }
        } catch {
          // ignore
        }
      }
      return { input };
    };

    // Wrap ALL tools to emit tool-call/tool-result messages and enforce approval gating.
    // This preserves ADK execution flow while enabling human-in-the-loop controls.
    for (const t of tools as any[]) {
      const toolName = (t as any)?.name;
      const originalExecute = (t as any)?.execute;
      if (!toolName || typeof originalExecute !== "function") continue;

      (t as any).execute = async (input: any, context: any) => {
        const toolInput = normalizeToolInput(input);

        // Emit tool call status
        messageEmitter.emitToolCall(executionId, toolName, toolInput);

        // Gate sensitive tools
        if ((REQUIRES_APPROVAL as readonly string[]).includes(toolName)) {
          const shouldExecute = await messageEmitter.emitApprovalRequest(
            executionId,
            ownerId.toString(),
            toolName,
            toolInput,
          );

          if (!shouldExecute) {
            const skippedResult = {
              success: false,
              error: "User rejected approval",
              toolName,
            };

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

    // Repo scoping: if a thread-selected repo exists, default missing owner/repo
    // and block any GitHub tool call attempting to target a different repo.
    const selectedRepo = effectivePayload?.githubRepo;
    if (selectedRepo?.owner && selectedRepo?.repo) {
      const githubToolsNeedingRepo = new Set<string>([
        "create_issue",
        "list_pull_requests",
        "get_file_contents",
        "create_or_update_file",
        "github_get_readme",
        "github_list_issues",
        "github_add_issue_comment",
        "github_update_file",
        "github_delete_file",
      ]);

      for (const t of tools as any[]) {
        const toolName = (t as any)?.name;
        if (!toolName || !githubToolsNeedingRepo.has(toolName)) continue;

        const originalExecute = (t as any).execute;
        if (typeof originalExecute !== "function") continue;

        (t as any).execute = async (input: any, context: any) => {
          let params: any = input;
          if (typeof input === "string") {
            try {
              params = JSON.parse(input);
            } catch {
              params = input;
            }
          }

          if (params && typeof params === "object") {
            const hasOwner =
              typeof params.owner === "string" && params.owner.trim();
            const hasRepo =
              typeof params.repo === "string" && params.repo.trim();

            if (!hasOwner) params.owner = selectedRepo.owner;
            if (!hasRepo) params.repo = selectedRepo.repo;

            if (
              params.owner !== selectedRepo.owner ||
              params.repo !== selectedRepo.repo
            ) {
              throw new Error(
                `GitHub tool call blocked: ${toolName} attempted to access ${params.owner}/${params.repo} but thread is scoped to ${selectedRepo.owner}/${selectedRepo.repo}`,
              );
            }
          }

          return originalExecute(params, context);
        };
      }
    }

    logger.info(`[WORKER] Initializing agent with ${tools.length} tools:`, {
      agentId,
      toolCount: tools.length,
    });

    // Build focused context with semantic memory search (no overwhelming dumps)
    // Context builder now handles memory search and GitHub context internally
    const systemPrompt = await buildFocusedContext(loaded, effectivePayload);

    // Get agent model
    const brainModelRaw =
      typeof loaded?.agent?.brain?.model === "string"
        ? loaded.agent.brain.model.trim()
        : "";
    const brainModel = brainModelRaw.includes("/")
      ? brainModelRaw.split("/").pop() || ""
      : brainModelRaw;
    const agentModelId =
      brainModel && /^gemini[\w\-\.]*$/i.test(brainModel)
        ? brainModel
        : "gemini-2.0-flash-001";

    // ============================================
    // AUTONOMOUS EXECUTION - NO PLANNING PHASE
    // ============================================
    // Agent starts working immediately, uses tools freely
    // ============================================

    const adkAgent = new LlmAgent({
      name: agentName,
      model: "gemini-2.5-pro",
      tools: tools,
      instruction: systemPrompt,
      generateContentConfig: {
        maxOutputTokens: 18000,
        temperature: 2.0, // Balanced creativity (max is 2.0)
      },
    });

    // 4. Initialize Runner with session service for memory
    const sessionService = new MongoSessionService();
    const runner = new Runner({
      agent: adkAgent,
      sessionService,
      appName: "axle-agent",
    });

    // 5. Execute withy reasoning loop using runAsync
    const userMessage = userMessageForEstimate;

    // Persist user message into agent-scoped Messages collection
    await AgentMemoryService.appendMessage({
      agentId,
      role: "user",
      content: userMessage,
      metadata: { source: "worker", executionId },
    });

    finalResponse = "";
    reasoningText = "";
    responseText = "";
    tokensUsed = 0;
    traces.length = 0;
    traceSeq = 0;
    inThoughtBlock = false;
    adkEventSeq = 0;
    adkEventStream.length = 0;
    candidatePartsStream.length = 0;
    latestUsageMetadata = null;
    latestGroundingMetadata = null;
    groundingSources.length = 0;

    const emitTrace = async (trace: any) => {
      const enriched = { seq: ++traceSeq, timestamp: Date.now(), ...trace };
      traces.push(enriched);
      SocketService.getInstance().emitToAgent(agentId, "execution:trace", {
        executionId,
        trace: enriched,
      });
    };

    const parseAndEmitTextDelta = async (delta: string) => {
      if (!delta) return;

      // Heuristic separation:
      // - If the model emits a "Thought:" block, treat it as reasoning until a "Response:" marker appears.
      // - Otherwise treat as response.
      let remaining = delta;
      while (remaining.length) {
        if (!inThoughtBlock) {
          const thoughtIdx = remaining.search(/\bThought\s*:/i);
          if (thoughtIdx === -1) {
            responseText += remaining;
            SocketService.getInstance().emitToAgent(
              agentId,
              "execution:response_delta",
              {
                executionId,
                delta: remaining,
              },
            );
            return;
          }

          const before = remaining.slice(0, thoughtIdx);
          if (before) {
            responseText += before;
            SocketService.getInstance().emitToAgent(
              agentId,
              "execution:response_delta",
              {
                executionId,
                delta: before,
              },
            );
          }

          // Skip the marker and enter thought mode
          const afterMarker = remaining
            .slice(thoughtIdx)
            .replace(/\bThought\s*:/i, "");
          inThoughtBlock = true;
          remaining = afterMarker;
          continue;
        }

        // inThoughtBlock
        const responseIdx = remaining.search(/\bResponse\s*:/i);
        if (responseIdx === -1) {
          reasoningText += remaining;
          SocketService.getInstance().emitToAgent(
            agentId,
            "execution:reasoning_delta",
            {
              executionId,
              delta: remaining,
            },
          );
          return;
        }

        const thoughtPart = remaining.slice(0, responseIdx);
        if (thoughtPart) {
          reasoningText += thoughtPart;
          SocketService.getInstance().emitToAgent(
            agentId,
            "execution:reasoning_delta",
            {
              executionId,
              delta: thoughtPart,
            },
          );
        }

        const afterMarker = remaining
          .slice(responseIdx)
          .replace(/\bResponse\s*:/i, "");
        inThoughtBlock = false;
        remaining = afterMarker;
      }
    };
    const toolStartTimes = new Map<string, number>();
    const userStartCredits = loaded.user.credits;
    // Safely get plan limit with fallback to free plan if plan is invalid
    const userPlan = (loaded.user.plan as PlanType) || "free";
    const planLimit =
      PLAN_LIMITS[userPlan]?.monthlyCredits || PLAN_LIMITS.free.monthlyCredits;
    const toolOutputs: Array<{
      tool: string;
      output: any;
      timestamp: number;
    }> = [];
    // actionsExecuted, toolCallsCompleted, creditsDeductedTotal are declared at function scope

    // Real-time credit tracking
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

    try {
      // Simple credit check before execution
      const simpleEstimate = CreditManagerService.estimateTaskCredits({
        userMessage: userMessageForEstimate,
      });
      await CreditManagerService.assertHasCredits({
        userId: ownerId,
        required: simpleEstimate,
      });

      // Deduct base execution cost up-front (enables immediate roll-down UX)
      {
        const baseRes = await CreditManagerService.deductCreditsAtomic({
          userId: ownerId,
          amount: CreditManagerService.BASE_TASK_WEIGHT,
        });
        if (!baseRes.ok) {
          const available = await CreditManagerService.getUserCredits(ownerId);
          throw new InsufficientCreditsError({
            available,
            required: CreditManagerService.BASE_TASK_WEIGHT,
          });
        }
        creditsDeductedTotal += CreditManagerService.BASE_TASK_WEIGHT;
        await emitCreditsUpdated({
          reason: "estimate",
          delta: CreditManagerService.BASE_TASK_WEIGHT,
          creditsRemaining:
            baseRes.credits ??
            Math.max(0, userStartCredits - creditsDeductedTotal),
          creditsUsed: creditsDeductedTotal,
          toolCallsCompleted,
        });
      }

      // UNIFIED EXECUTION - No special-casing for greetings vs tasks
      // Let the agent figure out what to do based on the prompt
      const MAX_ITERATIONS = 10; // Reasonable limit for all conversations

      let iterationCount = 0;
      // taskComplete already declared at function scope
      
      // Initialize with user's input
      let nextMessage: any = { role: "user", parts: [{ text: userMessageForEstimate }] };
      
      let lastIterationHadTools = false;
      let lastIterationTextLength = 0;

      while (!taskComplete && iterationCount < MAX_ITERATIONS) {
        iterationCount++;

        const prevFinalResponseLength = finalResponse.length;

        SocketService.getInstance().emitToAgent(agentId, "execution:status", {
          executionId,
          status: "running",
          message: iterationCount === 1 ? "Starting…" : "Continuing…",
          timestamp: Date.now(),
        });

        // Loop uses `nextMessage` which is updated at the end of loop if tools are used

        const runResult = runner.runAsync({
          userId: ownerId,
          sessionId: executionId,
          newMessage: nextMessage,
        });

        // Track this iteration's activity
        let iterationHadTools = false;
        let iterationTextLength = finalResponse.length;

        // Process the event stream - handle reasoning and tool execution
        for await (const event of runResult) {
          const eventSeq = ++adkEventSeq;
          const eventTs = Date.now();
          adkEventStream.push({ seq: eventSeq, timestamp: eventTs, event });

          const partsFromCandidate =
            (event as any)?.candidate?.content?.parts ||
            (event as any)?.candidates?.[0]?.content?.parts ||
            (event as any)?.content?.parts ||
            null;
          if (Array.isArray(partsFromCandidate) && partsFromCandidate.length) {
            candidatePartsStream.push({
              seq: eventSeq,
              timestamp: eventTs,
              parts: partsFromCandidate,
            });
          }

          // Capture deep metadata (usage/finishReason/grounding) if present on any event
          const usageMetadata =
            (event as any).usageMetadata ||
            (event as any).content?.usageMetadata ||
            (event as any).response?.usageMetadata ||
            null;
          const finishReason =
            (event as any).finishReason || (event as any).content?.finishReason;
          const groundingMetadata =
            (event as any).groundingMetadata ||
            (event as any).content?.groundingMetadata ||
            (event as any)?.candidate?.groundingMetadata ||
            (event as any)?.candidates?.[0]?.groundingMetadata ||
            null;

          if (usageMetadata) {
            latestUsageMetadata = usageMetadata;
          }

          if (groundingMetadata) {
            latestGroundingMetadata = groundingMetadata;
            const chunks =
              (groundingMetadata as any)?.groundingChunks ||
              (groundingMetadata as any)?.grounding_chunks ||
              [];
            if (Array.isArray(chunks)) {
              for (const ch of chunks) {
                const web =
                  (ch as any)?.web ||
                  (ch as any)?.webChunk ||
                  (ch as any)?.source;
                const uri = web?.uri || web?.url;
                const title = web?.title;
                if (uri && !groundingSources.some((s) => s.uri === uri)) {
                  groundingSources.push({ uri, title });
                }
              }
            }
          }

          if (usageMetadata || finishReason) {
            await emitTrace({
              kind: "model_metadata",
              usageMetadata,
              finishReason,
              groundingMetadata,
              rawEvent: event,
            });
          }

          // Handle different event types - text responses
          // Check for direct text content or text in parts
          let textDelta: string | null = null;

          if ((event as any).type === "text" && (event as any).content) {
            textDelta =
              typeof (event as any).content === "string"
                ? (event as any).content
                : null;
          } else if ((event as any).content?.parts) {
            // Handle ADK format: content.parts[].text
            const parts = (event as any).content.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (part?.text && typeof part.text === "string") {
                  textDelta = (textDelta || "") + part.text;
                }
              }
            }
          }

          if (textDelta) {
            // IMMEDIATE streaming - emit each delta as it arrives
            finalResponse += textDelta;
            responseText += textDelta;

            // Stream immediately to UI (don't buffer)
            SocketService.getInstance().emitToAgent(
              agentId,
              "execution:response_delta",
              {
                executionId,
                delta: textDelta,
                timestamp: Date.now(),
              },
            );
          }

          // Handle tool calls - check for 'call' event type and function calls
          if (
            (event as any).type === "tool_call" ||
            (event as any).type === "call" ||
            ((event as any).content?.parts &&
              (event as any).content.parts[0]?.functionCall)
          ) {
            const functionCall = (event as any).content?.parts?.[0]
              ?.functionCall;
            const functionCallId =
              functionCall?.id ||
              functionCall?.callId ||
              (event as any).functionCallId ||
              (event as any).callId;
            const toolName =
              functionCall?.name ||
              (event as any).toolName ||
              (event as any).name ||
              (event as any).function?.name;

            // AUTONOMOUS MODE: No tool restrictions
            // Check for task completion signal
            if (toolName === "complete_task") {
              taskComplete = true;
              const completeArgs = functionCall?.args || {};
              if (
                completeArgs.summary &&
                typeof completeArgs.summary === "string"
              ) {
                finalResponse = completeArgs.summary;
              }
              logger.info("Agent signaled task completion", {
                executionId,
                summary: completeArgs.summary,
              });
              // Will exit loop after event processing completes
            }

            if (toolName) {
              iterationHadTools = true;
              SocketService.getInstance().emitToAgent(
                agentId,
                "execution:status",
                {
                  executionId,
                  status: "tool_calling",
                  message: `Running ${toolName}…`,
                  toolName,
                  timestamp: Date.now(),
                },
              );
              const startTime = Date.now();
              toolStartTimes.set(toolName, startTime);

              // Track tool call start
              actionsExecuted.push({
                type: toolName,
                params: functionCall?.args || {},
                startedAt: new Date(startTime),
              });
            }

            if (toolName) {
              messageEmitter.emitThinking(
                executionId,
                `Running ${toolName}…`,
                "tool",
              );
            }

            SocketService.getInstance().emitToAgent(
              agentId,
              "execution:action",
              {
                executionId,
                type: toolName || "tool_call",
                status: "running",
                toolCall: event,
                functionCall: functionCall,
              },
            );

            await emitTrace({
              kind: "function_call",
              toolName,
              functionCallId,
              functionCall,
              rawEvent: event,
            });
          }

          // Handle tool responses and step events
          if (
            (event as any).type === "tool_response" ||
            (event as any).type === "tool_result" ||
            (event as any).type === "step" ||
            ((event as any).content?.parts &&
              (event as any).content.parts[0]?.functionResponse)
          ) {
            const functionResponse = (event as any).content?.parts?.[0]
              ?.functionResponse;

            const functionCallId =
              functionResponse?.id ||
              functionResponse?.callId ||
              (event as any).functionCallId ||
              (event as any).callId;

            const toolName =
              functionResponse?.name ||
              (event as any).toolName ||
              (event as any).name ||
              (event as any).function?.name;

            if (toolName && toolStartTimes.has(toolName)) {
              const startedAt = toolStartTimes.get(toolName)!;
              const finishedAt = Date.now();
              const durationMs = finishedAt - startedAt;
              toolStartTimes.delete(toolName);
              await emitAxleLog(
                "info",
                `[TOOL] ${toolName} completed in ${(durationMs / 1000).toFixed(
                  1,
                )}s`,
                { tool: toolName, durationMs },
              );

              // Update the action with completion info
              const actionIndex = actionsExecuted.findIndex(
                (a) => a.type === toolName && !a.finishedAt,
              );
              if (actionIndex >= 0) {
                actionsExecuted[actionIndex].finishedAt = new Date(finishedAt);
                actionsExecuted[actionIndex].durationMs = durationMs;
              }
            }

            let uiWrapped: any = null;
            let parsedResult: any = null;

            // Best-effort: capture tool output and emit any research logs.
            if (toolName && functionResponse) {
              const raw = (functionResponse as any).response;
              parsedResult = raw;
              if (typeof raw === "string") {
                try {
                  parsedResult = JSON.parse(raw);
                } catch {
                  parsedResult = raw;
                }
              }

              uiWrapped = UiMappingService.wrap({
                toolName,
                output: parsedResult,
              });

              toolOutputs.push({
                tool: toolName,
                output: uiWrapped,
                timestamp: Date.now(),
              });

              // Update the action with result
              const actionIndex = actionsExecuted.findIndex(
                (a) => a.type === toolName && !a.result,
              );
              if (actionIndex >= 0) {
                actionsExecuted[actionIndex].result = parsedResult;
              }

              // Store raw functionResponse (entire object) for trace/debug
              await emitTrace({
                kind: "function_response",
                toolName,
                functionCallId,
                functionResponse,
                rawEvent: event,
              });

              const maybeLogs = parsedResult?.researchLogs;
              if (Array.isArray(maybeLogs)) {
                for (const l of maybeLogs) {
                  if (typeof l === "string" && l.startsWith("[RESEARCH]")) {
                    await emitAxleLog("info", l);
                  }
                }
              }
            }

            SocketService.getInstance().emitToAgent(
              agentId,
              "execution:action",
              {
                executionId,
                type: toolName || (event as any).type || "tool_result",
                status: "completed",
                result: parsedResult || functionResponse,
                output: uiWrapped,
                functionResponse: functionResponse,
                durationMs:
                  toolName && toolStartTimes.has(toolName)
                    ? Date.now() - toolStartTimes.get(toolName)!
                    : undefined,
                ...(uiWrapped ? { toolOutput: uiWrapped } : {}),
              },
            );

            if (toolName) {
              toolCallsCompleted += 1;
              const delta = CreditManagerService.TOOL_TASK_WEIGHT;
              const res = await CreditManagerService.deductCreditsAtomic({
                userId: ownerId,
                amount: delta,
              });
              if (!res.ok) {
                const available = await CreditManagerService.getUserCredits(
                  ownerId,
                );
                throw new InsufficientCreditsError({
                  available,
                  required: delta,
                });
              }
              creditsDeductedTotal += delta;
              await emitCreditsUpdated({
                reason: "tool",
                delta,
                creditsRemaining:
                  res.credits ??
                  Math.max(0, userStartCredits - creditsDeductedTotal),
                creditsUsed: creditsDeductedTotal,
                tokensUsed,
                toolCallsCompleted,
              });
            }
          }

          // Extract token usage if available
          if ((event as any).usage) {
            tokensUsed = (event as any).usage.totalTokens || tokensUsed;

            // Token credits are charged based on *total tokens so far* (delta-billed)
            const tokenCreditsTotal = CreditManagerService.calculateTokenCredits(
              tokensUsed,
            );
            const delta = Math.max(0, tokenCreditsTotal - tokenCreditsCharged);
            if (delta > 0) {
              const res = await CreditManagerService.deductCreditsAtomic({
                userId: ownerId,
                amount: delta,
              });
              if (!res.ok) {
                const available = await CreditManagerService.getUserCredits(
                  ownerId,
                );
                throw new InsufficientCreditsError({
                  available,
                  required: delta,
                });
              }
              tokenCreditsCharged = tokenCreditsTotal;
              creditsDeductedTotal += delta;
              await emitCreditsUpdated({
                reason: "tokens",
                delta,
                creditsRemaining:
                  res.credits ??
                  Math.max(0, userStartCredits - creditsDeductedTotal),
                creditsUsed: creditsDeductedTotal,
                tokensUsed,
                toolCallsCompleted,
              });
            }

            const creditsSoFar = creditsDeductedTotal;
            const remaining = Math.max(0, userStartCredits - creditsSoFar);
            await emitAxleLog(
              "debug",
              `[BILLING] ${tokensUsed} tokens used. Balance: ${remaining}/${planLimit}`,
              {
                tokensUsed,
                creditsSoFar,
                creditsRemaining: remaining,
                creditsLimit: planLimit,
              },
            );
          }

          // Emit real-time events for all event types
          SocketService.getInstance().emitToAgent(agentId, "execution:event", {
            executionId,
            event: {
              ...event,
              timestamp: Date.now(),
            },
          });
        }

        // After processing events, check if we should auto-complete

        // Update iteration tracking
        lastIterationHadTools = iterationHadTools;
        iterationTextLength = finalResponse.length;

        // Emit accumulated agent text for this iteration (avoids per-delta spam)
        if (finalResponse.length > prevFinalResponseLength) {
          const newText = finalResponse.slice(prevFinalResponseLength);
          if (newText && newText.trim()) {
            messageEmitter.emitText(executionId, newText, "assistant");
          }
        }

        lastIterationTextLength = finalResponse.length;

        // If tools were executed, the next message is the tool response
        if (iterationHadTools && toolOutputs.length > 0) {
          nextMessage = {
            role: "user",
            parts: toolOutputs.map((t) => ({
              functionResponse: {
                name: t.tool,
                response: {
                  name: t.tool,
                  content: t.output,
                },
              },
            })),
          };
        } else {
           // No tools used - if we have a response, we might be done, or we pause.
           // In this autonomous execution one-shot optimization, if the agent didn't use tools 
           // and produced a response, we assume it's turning control back to the user.
           if (finalResponse.length > 0) {
              taskComplete = true; 
              break; 
           }
        }

        // Check completion signal
        if (taskComplete) {
          break;
        }
      }

      // Cleanup marker from any surfaced text
      if (finalResponse.includes("<TASK_DONE/>")) {
        finalResponse = finalResponse.replaceAll("<TASK_DONE/>", "");
      }

      SocketService.getInstance().emitToAgent(agentId, "execution:status", {
        executionId,
        status: "completed",
        message: taskComplete
          ? "Done."
          : `Stopped (max iterations: ${MAX_ITERATIONS}).`,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("ADK Runner runAsync execution failed", { error });
      throw error;
    }

    // 6. Process Result & Billing
    // Use ADK token usage if available, otherwise estimate
    const actualTokensUsed =
      tokensUsed > 0 ? tokensUsed : Math.ceil(finalResponse.length / 4);

    const tokenCreditsTotal = CreditManagerService.calculateTokenCredits(
      actualTokensUsed,
    );
    const targetTotalCredits =
      CreditManagerService.BASE_TASK_WEIGHT +
      toolCallsCompleted * CreditManagerService.TOOL_TASK_WEIGHT +
      tokenCreditsTotal;

    const finalDelta = Math.max(0, targetTotalCredits - creditsDeductedTotal);
    if (finalDelta > 0) {
      const res = await CreditManagerService.deductCreditsAtomic({
        userId: ownerId,
        amount: finalDelta,
      });
      if (!res.ok) {
        const available = await CreditManagerService.getUserCredits(ownerId);
        throw new InsufficientCreditsError({ available, required: finalDelta });
      }
      creditsDeductedTotal += finalDelta;
      await emitCreditsUpdated({
        reason: "final",
        delta: finalDelta,
        creditsRemaining:
          res.credits ?? Math.max(0, userStartCredits - creditsDeductedTotal),
        creditsUsed: creditsDeductedTotal,
        tokensUsed: actualTokensUsed,
        toolCallsCompleted,
      });
    }

    const creditsUsed = creditsDeductedTotal;

    const refreshedUser = await User.findById(ownerId).lean();
    if (refreshedUser) {
      const refreshedPlan = (refreshedUser.plan as PlanType) || "free";
      const refreshedLimit =
        PLAN_LIMITS[refreshedPlan]?.monthlyCredits ||
        PLAN_LIMITS.free.monthlyCredits;
      await emitAxleLog(
        "info",
        `[BILLING] ${actualTokensUsed} tokens used. Balance: ${refreshedUser.credits}/${refreshedLimit}`,
        {
          tokensUsed: actualTokensUsed,
          creditsDeducted: creditsUsed,
          creditsRemaining: refreshedUser.credits,
          creditsLimit: refreshedLimit,
        },
      );
    }

    // Update Execution
    execution.status = taskComplete ? "success" : "success";
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

    messageEmitter.emitText(executionId, "Task completed successfully! ✓", "system");
    execution.creditsUsed = creditsUsed;
    execution.aiTokensUsed = actualTokensUsed;
    execution.aiResponse = responseText || finalResponse;
    execution.reasoning = reasoningText;
    execution.traces = traces;
    execution.actionsExecuted = actionsExecuted;
    await execution.save();

    // Persist assistant response into agent-scoped Messages collection
    const assistantMessage = responseText || finalResponse;
    if (assistantMessage && typeof assistantMessage === "string") {
      await AgentMemoryService.appendMessage({
        agentId,
        role: "assistant",
        content: assistantMessage,
        metadata: {
          source: "worker",
          executionId,
          tokensUsed: actualTokensUsed,
        },
      });
    }

    try {
      const latestUserText =
        getLatestUserInput(effectivePayload?.messages) ||
        (typeof effectivePayload?.input === "string"
          ? effectivePayload.input
          : "") ||
        (typeof effectivePayload?.task === "string"
          ? effectivePayload.task
          : "");

      if (
        latestUserText &&
        assistantMessage &&
        typeof assistantMessage === "string"
      ) {
        const existingMemory =
          (await AgentMemoryService.getLongTermMemory(agentId)) || "";

        // Memory is now handled via remember/recall tools, not automatic updates
        // Agents can explicitly store memories using the remember tool
      }
    } catch {
      // ignore memory update failures
    }

    await ExecutionEventService.log({
      executionId,
      agentId,
      userId: ownerId,
      type: "execution_completed",
      level: "info",
      message: "ADK Agent execution completed successfully",
      data: { creditsUsed, tokensUsed: actualTokensUsed },
    });

    SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
      executionId: execution._id,
      status: "success",
    });

    return {
      success: taskComplete,
      actionsExecuted: toolCallsCompleted,
      creditsUsed,
    };
  } catch (error) {
    logger.error("Execution failed", { error });
    execution.status = "failed";
    const err: any = error;
    const errorCode = err?.code;
    // Use real error instead of converted
    const errorMessage = error instanceof Error ? error.message : String(error);
    execution.error = errorMessage;
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
    // Preserve partial model telemetry on failures
    execution.aiResponse = responseText || finalResponse;
    execution.reasoning = reasoningText;
    execution.traces = traces;
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
      error: errorMessage,
      ...(errorCode === "INSUFFICIENT_CREDITS"
        ? {
            required: err?.required,
            available: err?.available,
          }
        : {}),
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
