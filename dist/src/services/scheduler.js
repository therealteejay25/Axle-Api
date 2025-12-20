"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = __importDefault(require("../lib/redis"));
const Agent_1 = require("../models/Agent");
const agentRunner_1 = require("./agentRunner");
const pollingService_1 = require("./pollingService");
const logger_1 = require("../lib/logger");
const queueName = "agent-run-queue";
const queue = new bullmq_1.Queue(queueName, { connection: redis_1.default });
const queueScheduler = new bullmq_1.QueueScheduler(queueName, {
    connection: redis_1.default,
});
const startScheduler = async () => {
    // initialize scheduler
    await queueScheduler.waitUntilReady();
    // create worker to process agent runs
    const worker = new bullmq_1.Worker(queueName, async (job) => {
        const { agentId, ownerId } = job.data;
        try {
            await (0, agentRunner_1.runAgentById)(ownerId, agentId);
            return { ok: true };
        }
        catch (err) {
            console.error("Worker failed to run agent", agentId, err);
            throw err;
        }
    }, { connection: redis_1.default });
    worker.on("failed", (job, err) => {
        console.error("Agent run job failed", job.id, err);
    });
    // Enable scheduling for all agents that don't have it explicitly disabled
    // This ensures all agents run 24/7 by default
    const allAgents = await Agent_1.Agent.find({}).lean();
    let scheduledCount = 0;
    let enabledCount = 0;
    for (const a of allAgents) {
        try {
            // Determine if we should enable scheduling (default to enabled)
            const currentSchedule = a.schedule || {};
            const shouldEnable = currentSchedule.enabled === undefined ||
                currentSchedule.enabled === false;
            let finalSchedule = currentSchedule;
            if (shouldEnable) {
                // Update agent to enable scheduling with default 5min interval
                const updateData = {
                    "schedule.enabled": true,
                };
                if (!currentSchedule.intervalMinutes && !currentSchedule.cron) {
                    updateData["schedule.intervalMinutes"] = 1;
                }
                await Agent_1.Agent.findByIdAndUpdate(a._id, updateData);
                enabledCount++;
                // Update finalSchedule to reflect the changes
                finalSchedule = {
                    enabled: true,
                    intervalMinutes: currentSchedule.intervalMinutes || 1,
                    cron: currentSchedule.cron,
                };
            }
            // Schedule the agent if it's enabled
            if (finalSchedule.enabled !== false) {
                const intervalMinutes = finalSchedule.intervalMinutes || 1;
                const repeatOpts = {};
                if (finalSchedule.cron) {
                    repeatOpts.cron = finalSchedule.cron;
                }
                else {
                    repeatOpts.every = intervalMinutes * 60 * 1000;
                }
                await queue.add(`agent-${a._id}`, { agentId: a._id.toString(), ownerId: a.ownerId }, { repeat: repeatOpts });
                scheduledCount++;
                logger_1.logger.info(`Scheduled agent ${a._id} (${a.name}) - every ${intervalMinutes} minutes`);
            }
        }
        catch (err) {
            logger_1.logger.error(`Scheduler: failed to schedule agent ${a._id}`, err);
        }
    }
    logger_1.logger.info(`Scheduler started: ${enabledCount} agents enabled, ${scheduledCount} agents scheduled for execution`);
    // Start polling service for continuous monitoring
    startPollingService();
};
exports.startScheduler = startScheduler;
/**
 * Start polling service for agents that need continuous monitoring.
 * Runs every 10 minutes to check for new messages/events.
 */
const startPollingService = async () => {
    const pollingQueue = new bullmq_1.Queue("polling-queue", {
        connection: redis_1.default,
    });
    // Create worker for polling jobs
    const pollingWorker = new bullmq_1.Worker("polling-queue", async (job) => {
        const { agentId, ownerId, source, config } = job.data;
        try {
            await (0, pollingService_1.executePollingJob)({ agentId, ownerId, source, config });
            return { ok: true };
        }
        catch (err) {
            logger_1.logger.error("Polling job failed", err);
            throw err;
        }
    }, { connection: redis_1.default });
    pollingWorker.on("failed", (job, err) => {
        logger_1.logger.error("Polling job failed", job?.id, err);
    });
    // Schedule polling jobs for agents that need it
    const pollingJobs = await (0, pollingService_1.findPollingAgents)();
    for (const job of pollingJobs) {
        try {
            await pollingQueue.add(`polling-${job.agentId}`, job, {
                repeat: {
                    every: (job.config.intervalMinutes || 10) * 60 * 1000,
                },
            });
            logger_1.logger.info(`Scheduled polling for agent ${job.agentId}, channel: ${job.config.channel}`);
        }
        catch (err) {
            logger_1.logger.error(`Failed to schedule polling for agent ${job.agentId}`, err);
        }
    }
    // Also run a periodic job to discover new polling agents
    await pollingQueue.add("discover-polling-agents", {}, {
        repeat: {
            every: 60 * 60 * 1000, // Every hour, check for new polling agents
        },
    });
    logger_1.logger.info(`Polling service started with ${pollingJobs.length} polling jobs`);
};
exports.default = { startScheduler: exports.startScheduler };
