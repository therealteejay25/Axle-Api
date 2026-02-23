import { Worker, Job } from "bullmq";
import { redis } from "../config/redis";
import { executeAgent } from "../services/agentExecutor";
import { logger } from "../services/logger";

const QUEUE_NAME = "agent-schedule-executions";
const CONCURRENCY = 10;

interface ScheduleJobData {
  triggerId: string;
  agentId: string;
  userId: string;
}

/**
 * Process a scheduled agent execution job
 */
const processScheduleJob = async (job: Job<ScheduleJobData>): Promise<void> => {
  const { triggerId, agentId, userId } = job.data;

  logger.info("Schedule trigger fired", {
    jobId: job.id,
    triggerId,
    agentId,
    userId,
  });

  try {
    await executeAgent({
      agentId,
      userId,
      triggerId,
      triggerType: "schedule",
      input: {
        triggeredAt: new Date().toISOString(),
      },
    });

    logger.info("Schedule trigger execution completed", {
      jobId: job.id,
      triggerId,
      agentId,
    });
  } catch (error: any) {
    logger.error("Schedule trigger execution failed", {
      jobId: job.id,
      triggerId,
      agentId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Create and start the schedule worker
 */
export const createScheduleWorker = (): Worker<ScheduleJobData> => {
  const worker = new Worker<ScheduleJobData>(
    QUEUE_NAME,
    processScheduleJob,
    {
      connection: redis,
      concurrency: CONCURRENCY,
    }
  );

  // Worker event handlers
  worker.on("completed", (job) => {
    logger.debug(`Schedule job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    logger.error(`Schedule job ${job?.id} failed`, {
      jobId: job?.id,
      triggerId: job?.data?.triggerId,
      agentId: job?.data?.agentId,
      error: error.message,
      stack: error.stack,
    });
  });

  worker.on("error", (error) => {
    logger.error("Schedule worker error", {
      error: error.message,
      stack: error.stack,
    });
  });

  worker.on("ready", () => {
    logger.info(`Schedule worker ready (concurrency: ${CONCURRENCY})`);
  });

  worker.on("stalled", (jobId) => {
    logger.warn(`Schedule job ${jobId} stalled`);
  });

  return worker;
};

export default createScheduleWorker;
