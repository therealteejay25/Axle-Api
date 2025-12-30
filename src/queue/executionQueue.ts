import { Queue, Worker, QueueScheduler, Job } from "bullmq";
import { redis } from "../lib/redis";
import { logger } from "../services/logger";

// ============================================
// EXECUTION QUEUE
// ============================================
// Every trigger creates a job in this queue.
// Workers process jobs one at a time.
// ============================================

export interface ExecutionJobData {
  executionId: string;
  agentId: string;
  ownerId: string;
  triggerId?: string;
  triggerType: "schedule" | "webhook" | "manual";
  payload: Record<string, any>;
}

export interface ExecutionJobResult {
  success: boolean;
  actionsExecuted: number;
  creditsUsed: number;
  error?: string;
}

const QUEUE_NAME = "execution-queue";

// Queue options with retry strategies
const queueOptions = {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 1000 // 1s, 2s, 4s
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs
      age: 24 * 60 * 60 // Keep for 24 hours
    },
    removeOnFail: {
      count: 5000 // Keep failed jobs for debugging
    }
  }
};

// Create queue
export const executionQueue = new Queue<ExecutionJobData, ExecutionJobResult>(
  QUEUE_NAME,
  queueOptions
);

// Queue scheduler for delayed jobs
let queueScheduler: QueueScheduler | null = null;

export const initQueueScheduler = async (): Promise<void> => {
  queueScheduler = new QueueScheduler(QUEUE_NAME, {
    connection: redis
  });
  await queueScheduler.waitUntilReady();
  logger.info("Queue scheduler initialized");
};

// Enqueue an execution job
export const enqueueExecution = async (
  data: ExecutionJobData,
  options?: {
    delay?: number;
    priority?: number;
  }
): Promise<Job<ExecutionJobData, ExecutionJobResult>> => {
  const job = await executionQueue.add(
    `exec-${data.executionId}`,
    data,
    {
      delay: options?.delay,
      priority: options?.priority
    }
  );
  
  logger.info("Execution job enqueued", {
    jobId: job.id,
    executionId: data.executionId,
    agentId: data.agentId,
    triggerType: data.triggerType
  });
  
  return job;
};

// Get queue stats
export const getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    executionQueue.getWaitingCount(),
    executionQueue.getActiveCount(),
    executionQueue.getCompletedCount(),
    executionQueue.getFailedCount(),
    executionQueue.getDelayedCount()
  ]);
  
  return { waiting, active, completed, failed, delayed };
};

// Clean up old jobs
export const cleanQueue = async (grace: number = 24 * 60 * 60 * 1000) => {
  await executionQueue.clean(grace, 1000, "completed");
  await executionQueue.clean(grace * 7, 1000, "failed"); // Keep failed for 7 days
};

export default executionQueue;
