"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanQueue = exports.getQueueStats = exports.enqueueExecution = exports.initQueueScheduler = exports.executionQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const logger_1 = require("../services/logger");
const QUEUE_NAME = "execution-queue";
// Queue options with retry strategies
const queueOptions = {
    connection: redis_1.redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
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
exports.executionQueue = new bullmq_1.Queue(QUEUE_NAME, queueOptions);
// Queue scheduler for delayed jobs
let queueScheduler = null;
const initQueueScheduler = async () => {
    queueScheduler = new bullmq_1.QueueScheduler(QUEUE_NAME, {
        connection: redis_1.redis
    });
    await queueScheduler.waitUntilReady();
    logger_1.logger.info("Queue scheduler initialized");
};
exports.initQueueScheduler = initQueueScheduler;
// Enqueue an execution job
const enqueueExecution = async (data, options) => {
    const job = await exports.executionQueue.add(`exec-${data.executionId}`, data, {
        delay: options?.delay,
        priority: options?.priority
    });
    logger_1.logger.info("Execution job enqueued", {
        jobId: job.id,
        executionId: data.executionId,
        agentId: data.agentId,
        triggerType: data.triggerType
    });
    return job;
};
exports.enqueueExecution = enqueueExecution;
// Get queue stats
const getQueueStats = async () => {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        exports.executionQueue.getWaitingCount(),
        exports.executionQueue.getActiveCount(),
        exports.executionQueue.getCompletedCount(),
        exports.executionQueue.getFailedCount(),
        exports.executionQueue.getDelayedCount()
    ]);
    return { waiting, active, completed, failed, delayed };
};
exports.getQueueStats = getQueueStats;
// Clean up old jobs
const cleanQueue = async (grace = 24 * 60 * 60 * 1000) => {
    await exports.executionQueue.clean(grace, 1000, "completed");
    await exports.executionQueue.clean(grace * 7, 1000, "failed"); // Keep failed for 7 days
};
exports.cleanQueue = cleanQueue;
exports.default = exports.executionQueue;
