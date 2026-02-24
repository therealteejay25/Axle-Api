import { Queue } from "bullmq";
import { redis } from "../lib/redis";
import { Trigger } from "../models/Trigger";
import { User } from "../models/User";
import { logger } from "./logger";

const QUEUE_NAME = "agent-schedule-executions";

// Create the queue for scheduled agent executions
const scheduleQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});

/**
 * Register a schedule trigger with BullMQ
 * Creates a repeatable job that will fire based on the trigger's cron expression
 */
export const registerScheduleTrigger = async (triggerId: string): Promise<void> => {
  try {
    const trigger = await Trigger.findById(triggerId);
    
    if (!trigger) {
      throw new Error(`Trigger not found: ${triggerId}`);
    }

    if (trigger.type !== "schedule") {
      throw new Error(`Trigger ${triggerId} is not a schedule trigger`);
    }

    if (!trigger.enabled) {
      logger.debug(`Skipping disabled trigger ${triggerId}`);
      return;
    }

    if (!trigger.cron) {
      throw new Error(`Trigger ${triggerId} has no cron expression`);
    }

    // Get user timezone
    const user = await User.findById(trigger.userId);
    const timezone = trigger.timezone || user?.timeZone || "UTC";

    // Remove existing repeatable job if it exists
    const repeatableJobs = await scheduleQueue.getRepeatableJobs();
    const existingJob = repeatableJobs.find(job => job.id === `schedule-${triggerId}`);
    
    if (existingJob) {
      await scheduleQueue.removeRepeatableByKey(existingJob.key);
      logger.debug(`Removed existing repeatable job for trigger ${triggerId}`);
    }

    // Add new repeatable job
    const job = await scheduleQueue.add(
      `trigger:${triggerId}`,
      {
        triggerId: trigger._id.toString(),
        agentId: trigger.agentId.toString(),
        userId: trigger.userId.toString(),
      },
      {
        repeat: {
          pattern: trigger.cron,
          tz: timezone,
        },
        jobId: `schedule-${triggerId}`,
      }
    );

    // Store the BullMQ job key for later cancellation
    if (job.opts?.repeat) {
      trigger.bullmqJobKey = `repeat:${QUEUE_NAME}:${job.id}:${trigger.cron}:${timezone}`;
    }
    await trigger.save();

    logger.info(`Registered schedule trigger ${triggerId}`, {
      cron: trigger.cron,
      timezone,
      agentId: trigger.agentId.toString(),
    });
  } catch (error: any) {
    logger.error(`Failed to register schedule trigger ${triggerId}:`, error);
    throw error;
  }
};

/**
 * Remove a schedule trigger from BullMQ
 * Removes the repeatable job associated with the trigger
 */
export const removeScheduleTrigger = async (triggerId: string): Promise<void> => {
  try {
    const trigger = await Trigger.findById(triggerId);
    
    if (trigger?.bullmqJobKey) {
      // Use stored job key if available
      await scheduleQueue.removeRepeatableByKey(trigger.bullmqJobKey);
      logger.info(`Removed schedule trigger ${triggerId} using stored key`);
    } else {
      // Fallback to searching by job ID
      const repeatableJobs = await scheduleQueue.getRepeatableJobs();
      const job = repeatableJobs.find(j => j.id === `schedule-${triggerId}`);

      if (job) {
        await scheduleQueue.removeRepeatableByKey(job.key);
        logger.info(`Removed schedule trigger ${triggerId}`);
      } else {
        logger.debug(`No repeatable job found for trigger ${triggerId}`);
      }
    }
  } catch (error: any) {
    logger.error(`Failed to remove schedule trigger ${triggerId}:`, error);
    throw error;
  }
};

/**
 * Sync all active schedule triggers with BullMQ
 * Queries all active schedule triggers and registers them
 */
export const syncAllScheduleTriggers = async (): Promise<void> => {
  try {
    logger.info("Syncing all schedule triggers...");

    // Find all enabled schedule triggers
    const triggers = await Trigger.find({
      type: "schedule",
      enabled: true,
    }).lean();

    logger.info(`Found ${triggers.length} enabled schedule triggers`);

    let successCount = 0;
    let failCount = 0;

    for (const trigger of triggers) {
      try {
        await registerScheduleTrigger(trigger._id.toString());
        successCount++;
      } catch (error: any) {
        logger.error(`Failed to sync trigger ${trigger._id}:`, error);
        failCount++;
      }
    }

    logger.info(`Schedule trigger sync complete: ${successCount} succeeded, ${failCount} failed`);
  } catch (error: any) {
    logger.error("Failed to sync schedule triggers:", error);
    throw error;
  }
};

export default {
  registerScheduleTrigger,
  removeScheduleTrigger,
  syncAllScheduleTriggers,
};
