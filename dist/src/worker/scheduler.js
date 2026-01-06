"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSchedulerWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const logger_1 = require("../services/logger");
const scheduleHandler_1 = require("../triggers/scheduleHandler");
const SCHEDULER_QUEUE = "scheduler-queue";
/**
 * Initialize the scheduler worker.
 * Listens for repeatable jobs and triggers execution.
 */
const initSchedulerWorker = () => {
    logger_1.logger.info("Initializing Scheduler Worker...");
    const worker = new bullmq_1.Worker(SCHEDULER_QUEUE, async (job) => {
        try {
            logger_1.logger.info(`Processing scheduled job ${job.id}`, job.data);
            const { triggerId, agentId, ownerId } = job.data;
            if (!triggerId || !agentId || !ownerId) {
                throw new Error("Missing required job data (triggerId, agentId, ownerId)");
            }
            await (0, scheduleHandler_1.processScheduledTrigger)(triggerId, agentId, ownerId);
            logger_1.logger.info(`Successfully processed scheduled job ${job.id}`);
        }
        catch (err) {
            logger_1.logger.error(`Failed to process scheduled job ${job.id}`, err);
            throw err;
        }
    }, {
        connection: redis_1.redis,
        concurrency: 5 // Allow multiple concurrent triggers
    });
    worker.on("failed", (job, err) => {
        logger_1.logger.error(`Scheduler job ${job?.id} failed`, err);
    });
    worker.on("error", (err) => {
        logger_1.logger.error("Scheduler worker error", err);
    });
    logger_1.logger.info("Scheduler Worker started");
    return worker;
};
exports.initSchedulerWorker = initSchedulerWorker;
