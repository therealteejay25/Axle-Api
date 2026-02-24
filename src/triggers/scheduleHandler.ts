import { Queue } from "bullmq";
import { redis } from "../lib/redis";
import { Trigger } from "../models/Trigger";
import { Agent } from "../models/Agent";
import { Execution } from "../models/Execution";
import { enqueueExecution } from "../queue/executionQueue";
import { logger } from "../services/logger";
import cronParser from "cron-parser";
import { User } from "../models/User";

// ============================================
// SCHEDULE HANDLER
// ============================================
// Uses BullMQ repeatable jobs for cron-based triggers.
// Scheduler EMITS jobs, does NOT execute agents directly.
// ============================================

const SCHEDULER_QUEUE = "scheduler-queue";

// Queue for managing repeatable jobs
const schedulerQueue = new Queue(SCHEDULER_QUEUE, { connection: redis });

/**
 * Initialize all scheduled triggers
 */
export const initScheduler = async (): Promise<void> => {
  logger.info("Initializing scheduler...");
  
  // Clear existing repeatable jobs
  const repeatableJobs = await schedulerQueue.getRepeatableJobs();
  logger.info(`Clearing ${repeatableJobs.length} existing repeatable jobs`);
  for (const job of repeatableJobs) {
    await schedulerQueue.removeRepeatableByKey(job.key);
  }

  // Find all enabled schedule triggers
  const triggers = await Trigger.find({
    type: "schedule",
    enabled: true
  }).populate("agentId");

  logger.info(`Found ${triggers.length} enabled schedule triggers`);

  let scheduledCount = 0;

  for (const trigger of triggers) {
    if (!trigger.cron) {
      logger.warn(`Schedule trigger ${trigger._id} has no cron expression`);
      continue;
    }

    const agent = await Agent.findById(trigger.agentId);
    if (!agent || agent.status !== "active") {
      logger.debug(`Skipping trigger for inactive agent ${trigger.agentId}`);
      continue;
    }

    try {
      // Validate cron expression before scheduling
      const cronParserModule = require('cron-parser');
      const user = await User.findById(trigger.userId);
      const timezone = trigger.timezone || user?.timeZone || "UTC";
      
      const interval = cronParserModule.default.parse(trigger.cron, {
        tz: timezone
      });
      const nextRun = interval.next().toDate();
      
      await schedulerQueue.add(
        `trigger-${trigger._id}`,
        {
          triggerId: trigger._id.toString(),
          agentId: agent._id.toString(),
          ownerId: agent.ownerId.toString()
        },
        {
          repeat: { 
            cron: trigger.cron,
            tz: timezone
          },
          jobId: `schedule-${trigger._id}`
        }
      );

      scheduledCount++;
      logger.info(`Scheduled trigger ${trigger._id}`, {
        cron: trigger.cron,
        timezone,
        nextRun: nextRun.toISOString(),
        agentId: agent._id
      });
    } catch (err: any) {
      logger.error(`Failed to schedule trigger ${trigger._id}:`, err);
    }
  }

  logger.info(`Scheduler initialized: ${scheduledCount} triggers scheduled`);
};

/**
 * Add a new schedule trigger
 */
export const addScheduleTrigger = async (triggerId: string): Promise<void> => {
  const trigger = await Trigger.findById(triggerId);
  if (!trigger || trigger.type !== "schedule" || !trigger.enabled) {
    return;
  }

  const agent = await Agent.findById(trigger.agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${trigger.agentId}`);
  }

  if (!trigger.cron) {
    throw new Error("Schedule trigger requires cron expression");
  }

  const user = await User.findById(trigger.userId);
  const timezone = trigger.timezone || user?.timeZone || "UTC";

  await schedulerQueue.add(
    `trigger-${trigger._id}`,
    {
      triggerId: trigger._id.toString(),
      agentId: agent._id.toString(),
      ownerId: agent.ownerId.toString()
    },
    {
      repeat: { 
        cron: trigger.cron,
        tz: timezone
      },
      jobId: `schedule-${trigger._id}`
    }
  );

  logger.info(`Added schedule trigger ${triggerId}`);
};

/**
 * Remove a schedule trigger
 */
export const removeScheduleTrigger = async (triggerId: string): Promise<void> => {
  const repeatableJobs = await schedulerQueue.getRepeatableJobs();
  const job = repeatableJobs.find(j => j.id === `schedule-${triggerId}`);

  if (job) {
    await schedulerQueue.removeRepeatableByKey(job.key);
    logger.info(`Removed schedule trigger ${triggerId}`);
  }
};

/**
 * Process a scheduled trigger (called by worker)
 */
export const processScheduledTrigger = async (
  triggerId: string,
  agentId: string,
  ownerId: string
): Promise<void> => {
  const trigger = await Trigger.findById(triggerId);
  if (!trigger || !trigger.enabled) {
    logger.debug(`Skipping disabled trigger ${triggerId}`);
    return;
  }

  const agent = await Agent.findById(agentId).lean();
  if (!agent || (agent as any).status !== "active") {
    logger.debug(`Skipping scheduled trigger for inactive agent ${agentId}`);
    return;
  }

  const scheduledAt = new Date().toISOString();

  // Create execution record
  const execution = await Execution.create({
    agentId,
    triggerId,
    triggerType: "schedule",
    status: "pending",
    inputPayload: {
      input: trigger.customInstruction,
      task: trigger.customInstruction,
      triggeredAt: scheduledAt,
      triggeredBy: ownerId,
      type: "scheduled"
    }
  });

  // Update trigger last run time
  trigger.lastRunAt = new Date();
  await trigger.save();

  // Enqueue execution job
  await enqueueExecution({
    executionId: execution._id.toString(),
    agentId,
    ownerId,
    triggerId,
    triggerType: "schedule",
    payload: {
      input: trigger.customInstruction,
      task: trigger.customInstruction,
      triggeredAt: scheduledAt,
      triggeredBy: ownerId,
      timestamp: scheduledAt
    }
  });

  logger.info(`Scheduled trigger fired`, { triggerId, agentId, executionId: execution._id });
};

export default {
  initScheduler,
  addScheduleTrigger,
  removeScheduleTrigger,
  processScheduledTrigger
};
