import { Worker } from "bullmq";
import { redis } from "../lib/redis";
import { logger } from "../services/logger";
import { processScheduledTrigger } from "../triggers/scheduleHandler";

const SCHEDULER_QUEUE = "scheduler-queue";

/**
 * Initialize the scheduler worker.
 * Listens for repeatable jobs and triggers execution.
 */
export const initSchedulerWorker = () => {
  logger.info("Initializing Scheduler Worker...");
  
  const worker = new Worker(
    SCHEDULER_QUEUE,
    async (job) => {
      try {
        logger.info(`Processing scheduled job ${job.id}`, job.data);
        
        const { triggerId, agentId, ownerId } = job.data;
        
        if (!triggerId || !agentId || !ownerId) {
          throw new Error("Missing required job data (triggerId, agentId, ownerId)");
        }
        
        await processScheduledTrigger(triggerId, agentId, ownerId);
        
        logger.info(`Successfully processed scheduled job ${job.id}`);
      } catch (err: any) {
        logger.error(`Failed to process scheduled job ${job.id}`, {
          error: err.message,
          stack: err.stack,
          jobData: job.data
        });
        throw err;
      }
    },
    { 
      connection: redis,
      concurrency: 10, // Allow multiple concurrent triggers
      settings: {
        stalledInterval: 30 * 1000, // 30 seconds
        maxStalledCount: 1,
      }
    }
  );
  
  worker.on("completed", (job) => {
    logger.info(`Scheduler job ${job.id} completed successfully`);
  });
  
  worker.on("failed", (job, err) => {
    logger.error(`Scheduler job ${job?.id} failed`, {
      error: err.message,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
      failedReason: job?.failedReason
    });
  });
  
  worker.on("error", (err) => {
    logger.error("Scheduler worker error", { error: err.message, stack: err.stack });
  });

  worker.on("stalled", (jobId) => {
    logger.warn(`Scheduler job ${jobId} stalled`);
  });
  
  logger.info("Scheduler Worker started");
  return worker;
};