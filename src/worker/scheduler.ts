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
        logger.error(`Failed to process scheduled job ${job.id}`, err);
        throw err;
      }
    },
    { 
      connection: redis,
      concurrency: 5 // Allow multiple concurrent triggers
    }
  );
  
  worker.on("failed", (job, err) => {
    logger.error(`Scheduler job ${job?.id} failed`, err);
  });
  
  worker.on("error", (err) => {
    logger.error("Scheduler worker error", err);
  });
  
  logger.info("Scheduler Worker started");
  return worker;
};
