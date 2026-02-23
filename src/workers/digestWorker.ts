import { Worker, Job } from "bullmq";
import { redis } from "../config/redis";
import { generateDailyDigest } from "../services/dailyDigest";
import { logger } from "../services/logger";

const QUEUE_NAME = "digest-generation";

interface DigestJobData {
  userId: string;
}

/**
 * Process a digest generation job
 */
const processDigestJob = async (job: Job<DigestJobData>): Promise<void> => {
  const { userId } = job.data;

  logger.info("Generating daily digest", {
    jobId: job.id,
    userId,
  });

  try {
    await generateDailyDigest(userId);

    logger.info("Daily digest generation completed", {
      jobId: job.id,
      userId,
    });
  } catch (error: any) {
    logger.error("Daily digest generation failed", {
      jobId: job.id,
      userId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Create and start the digest worker
 */
export const createDigestWorker = (): Worker<DigestJobData> => {
  const worker = new Worker<DigestJobData>(QUEUE_NAME, processDigestJob, {
    connection: redis,
    concurrency: 5,
  });

  // Worker event handlers
  worker.on("completed", (job) => {
    logger.debug(`Digest job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    logger.error(`Digest job ${job?.id} failed`, {
      jobId: job?.id,
      userId: job?.data?.userId,
      error: error.message,
      stack: error.stack,
    });
  });

  worker.on("error", (error) => {
    logger.error("Digest worker error", {
      error: error.message,
      stack: error.stack,
    });
  });

  worker.on("ready", () => {
    logger.info("Digest worker ready (concurrency: 5)");
  });

  worker.on("stalled", (jobId) => {
    logger.warn(`Digest job ${jobId} stalled`);
  });

  return worker;
};

export default createDigestWorker;
