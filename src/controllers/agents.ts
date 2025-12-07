import { Request, Response } from "express";
import { Agent } from "../models/Agent";
import { runAgentById } from "../services/agentRunner";
import { emitToAgent } from "../services/realtime";
import { delegateToMicroAgents } from "../agent/router";
import { Queue } from "bullmq";
import redis from "../lib/redis";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import {
  CreateAgentSchema,
  RunAgentSchema,
  DelegateTaskSchema,
} from "../lib/schemas";
import { axleAgent } from "../agent/main";
import { buildIntegrationContext } from "../services/agentRunner";

const queue = new Queue("agent-run-queue", { connection: redis as any });

export const createAgentController = async (req: Request, res: Response) => {
  const userId = (req as any).userId || req.body.ownerId;
  const correlationId = (req as any).correlationId;

  try {
    // Validate input
    const validated = CreateAgentSchema.parse(req.body);
    const {
      name,
      description,
      systemPrompt,
      tools,
      integrations,
      schedule,
      model,
    } = validated;

    if (!userId) {
      return res.status(401).json({ error: "User ID required" });
    }

    // Default to 24/7 running if no schedule provided
    const defaultSchedule = schedule || {
      enabled: true,
      intervalMinutes: 5, // Run every 5 minutes for continuous operation
    };

    const agent = await Agent.create({
      name,
      description,
      systemPrompt,
      tools: tools || [],
      integrations: integrations || [],
      ownerId: userId,
      model: model || "gpt-4o",
      schedule: defaultSchedule,
    });

    // If scheduling enabled, add repeatable job to queue
    if (agent.schedule?.enabled) {
      try {
        const repeatOpts: any = {};
        if (agent.schedule.intervalMinutes)
          repeatOpts.every = (agent.schedule.intervalMinutes || 5) * 60 * 1000;
        else if (agent.schedule.cron) repeatOpts.cron = agent.schedule.cron;
        await queue.add(
          `agent-${agent._id.toString()}`,
          { agentId: agent._id.toString(), ownerId: userId },
          { repeat: repeatOpts }
        );
      } catch (sErr) {
        logger.error(
          `[${correlationId}] Failed to schedule agent ${agent._id}`,
          sErr
        );
      }
    }

    emitToAgent(agent._id.toString(), "agent:created", { agent });
    logger.info(`[${correlationId}] Agent created: ${agent._id}`);

    res.status(201).json({ agent });
  } catch (err) {
    logger.error(`[${correlationId}] Create agent failed`, err);
    if ((err as any)?.name === "ZodError") {
      return res
        .status(400)
        .json({ error: "Validation error", details: (err as any)?.errors });
    }
    res.status(500).json({ error: "Unable to create agent" });
  }
};

export const listAgentsController = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;

  try {
    const agents = await Agent.find({ ownerId: userId }).lean();
    res.json({ agents });
  } catch (err) {
    logger.error(`[${correlationId}] List agents failed`, err);
    res.status(500).json({ error: "Unable to list agents" });
  }
};

export const getAgentController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const correlationId = (req as any).correlationId;

  try {
    const agent = await Agent.findById(id).lean();
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json({ agent });
  } catch (err) {
    logger.error(`[${correlationId}] Get agent failed`, err);
    res.status(500).json({ error: "Unable to get agent" });
  }
};

export const getAgentStatusController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;

  try {
    const agent = await Agent.findById(id).lean();
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    if ((agent as any).ownerId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Get recent logs (last 10)
    const recentLogs = (agent.logs || []).slice(-10).reverse();

    // Check if agent is scheduled
    const schedule = (agent as any).schedule || {};
    const isScheduled = schedule.enabled === true;

    // Calculate next run time if scheduled
    let nextRunAt = null;
    if (isScheduled && schedule.intervalMinutes) {
      const lastRun = (agent as any).lastRunAt;
      if (lastRun) {
        nextRunAt = new Date(
          new Date(lastRun).getTime() + schedule.intervalMinutes * 60 * 1000
        );
      } else {
        nextRunAt = new Date(); // Should run immediately
      }
    }

    res.json({
      agent: {
        id: agent._id,
        name: (agent as any).name,
        description: (agent as any).description,
        model: (agent as any).model || "gpt-4o",
        schedule: {
          enabled: isScheduled,
          intervalMinutes: schedule.intervalMinutes,
          cron: schedule.cron,
        },
        lastRunAt: (agent as any).lastRunAt,
        nextRunAt,
        isRunning: false, // Could be enhanced with a running state tracker
        totalRuns: (agent.logs || []).length,
      },
      recentLogs,
      status: isScheduled ? "scheduled" : "disabled",
    });
  } catch (err) {
    logger.error(`[${correlationId}] Get agent status failed`, err);
    res.status(500).json({ error: "Unable to get agent status" });
  }
};

export const deleteAgentController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const correlationId = (req as any).correlationId;

  try {
    // Remove any repeatable jobs associated with this agent
    try {
      const repeatableJobs = await queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        // job.name contains the name used when adding (e.g., `agent-<id>`)
        if (
          job.name === `agent-${id}` ||
          (job.key && job.key.includes(`agent-${id}`))
        ) {
          try {
            await queue.removeRepeatableByKey(job.key);
            logger.info(
              `[${correlationId}] Removed repeatable job for agent ${id}: ${job.key}`
            );
          } catch (remErr) {
            logger.warn(
              `[${correlationId}] Failed to remove repeatable job ${job.key} for agent ${id}`,
              remErr
            );
          }
        }
      }
    } catch (qErr) {
      logger.warn(
        `[${correlationId}] Failed to list/remove repeatable jobs for agent ${id}`,
        qErr
      );
    }

    await Agent.findByIdAndDelete(id);
    logger.info(`[${correlationId}] Agent deleted: ${id}`);
    res.json({
      message: "Agent deleted and scheduled jobs cleaned up if present.",
    });
  } catch (err) {
    logger.error(`[${correlationId}] Delete agent failed`, err);
    res.status(500).json({ error: "Unable to delete agent" });
  }
};

export const runAgentController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).userId || "";
  const correlationId = (req as any).correlationId;

  try {
    const validated = RunAgentSchema.parse(req.body);
    const { input } = validated;

    const result = await runAgentById(userId, id, input);
    logger.info(`[${correlationId}] Agent run completed: ${id}`);
    res.json({ result });
  } catch (err) {
    logger.error(`[${correlationId}] Run agent failed`, err);
    if ((err as any)?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error" });
    }
    res.status(500).json({ error: "Unable to run agent" });
  }
};

/**
 * Delegate task to multiple micro agents (main agent coordinator).
 */
export const delegateTaskController = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;

  try {
    const validated = DelegateTaskSchema.parse(req.body);
    const result = await delegateToMicroAgents({
      userId,
      instruction: validated.instruction,
      preferredAgents: validated.preferredAgents,
      timeout: validated.timeout || env.AGENT_TIMEOUT_MS,
    });

    logger.info(
      `[${correlationId}] Task delegated with status: ${result.status}`
    );
    res.json({ result });
  } catch (err) {
    logger.error(`[${correlationId}] Delegate task failed`, err);
    if ((err as any)?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error" });
    }
    res.status(500).json({ error: "Unable to delegate task" });
  }
};

/**
 * Main agent chat endpoint: let the main agent decide which tools or micro-agents to run.
 */
export const mainAgentController = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;

  try {
    const validated = DelegateTaskSchema.parse(req.body);

    // Build integration context and available agents
    const context = await buildIntegrationContext(userId);
    const agentDocs = await Agent.find({ ownerId: userId }).lean();
    const availableAgents = agentDocs.map((a: any) => ({
      id: String(a._id),
      name: a.name,
      description: a.description,
    }));

    const runner = axleAgent as any;
    if (!runner || typeof runner.run !== "function") {
      return res.status(500).json({ error: "Main agent runner not available" });
    }

    const result = await runner.run({
      input: validated.instruction,
      context: { ...context, userId },
      availableAgents,
      userId,
      onStep: (step: any) => {
        emitToAgent("main", "agent:run:step", step);
      },
    });

    // If agent returned a decision, execute it
    if (result.decision) {
      console.log(
        "[mainAgentController] Agent generated decision, executing..."
      );
      const { executeDecision } = await import("../lib/toolExecutor");
      const executionResult = await executeDecision(result.decision, userId);

      console.log("[mainAgentController] Execution result:", {
        success: executionResult.success,
        hasError: !!executionResult.error,
      });

      // Return both the agent's natural language response and the execution result
      return res.json({
        result: {
          ...result,
          execution: executionResult,
        },
      });
    }

    logger.info(`[${correlationId}] Main agent run completed`);
    res.json({ result });
  } catch (err) {
    logger.error(`[${correlationId}] Main agent failed`, err);
    if ((err as any)?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error" });
    }
    res.status(500).json({ error: "Unable to process instruction" });
  }
};

export default {};
