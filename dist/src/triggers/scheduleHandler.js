"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processScheduledTrigger = exports.removeScheduleTrigger = exports.addScheduleTrigger = exports.initScheduler = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const Trigger_1 = require("../models/Trigger");
const Agent_1 = require("../models/Agent");
const Execution_1 = require("../models/Execution");
const executionQueue_1 = require("../queue/executionQueue");
const logger_1 = require("../services/logger");
// ============================================
// SCHEDULE HANDLER
// ============================================
// Uses BullMQ repeatable jobs for cron-based triggers.
// Scheduler EMITS jobs, does NOT execute agents directly.
// ============================================
const SCHEDULER_QUEUE = "scheduler-queue";
// Queue for managing repeatable jobs
const schedulerQueue = new bullmq_1.Queue(SCHEDULER_QUEUE, { connection: redis_1.redis });
/**
 * Initialize all scheduled triggers
 */
const initScheduler = async () => {
    // Clear existing repeatable jobs
    const repeatableJobs = await schedulerQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
        await schedulerQueue.removeRepeatableByKey(job.key);
    }
    // Find all enabled schedule triggers
    const triggers = await Trigger_1.Trigger.find({
        type: "schedule",
        enabled: true
    }).populate("agentId");
    let scheduledCount = 0;
    for (const trigger of triggers) {
        if (!trigger.config.cron) {
            logger_1.logger.warn(`Schedule trigger ${trigger._id} has no cron expression`);
            continue;
        }
        const agent = await Agent_1.Agent.findById(trigger.agentId);
        if (!agent || agent.status !== "active") {
            logger_1.logger.debug(`Skipping trigger for inactive agent ${trigger.agentId}`);
            continue;
        }
        try {
            await schedulerQueue.add(`trigger-${trigger._id}`, {
                triggerId: trigger._id.toString(),
                agentId: agent._id.toString(),
                ownerId: agent.ownerId.toString()
            }, {
                repeat: { cron: trigger.config.cron },
                jobId: `schedule-${trigger._id}`
            });
            scheduledCount++;
            logger_1.logger.info(`Scheduled trigger ${trigger._id}`, {
                cron: trigger.config.cron,
                agentId: agent._id
            });
        }
        catch (err) {
            logger_1.logger.error(`Failed to schedule trigger ${trigger._id}:`, err);
        }
    }
    logger_1.logger.info(`Scheduler initialized: ${scheduledCount} triggers scheduled`);
};
exports.initScheduler = initScheduler;
/**
 * Add a new schedule trigger
 */
const addScheduleTrigger = async (triggerId) => {
    const trigger = await Trigger_1.Trigger.findById(triggerId);
    if (!trigger || trigger.type !== "schedule" || !trigger.enabled) {
        return;
    }
    const agent = await Agent_1.Agent.findById(trigger.agentId);
    if (!agent) {
        throw new Error(`Agent not found: ${trigger.agentId}`);
    }
    if (!trigger.config.cron) {
        throw new Error("Schedule trigger requires cron expression");
    }
    await schedulerQueue.add(`trigger-${trigger._id}`, {
        triggerId: trigger._id.toString(),
        agentId: agent._id.toString(),
        ownerId: agent.ownerId.toString()
    }, {
        repeat: { cron: trigger.config.cron },
        jobId: `schedule-${trigger._id}`
    });
    logger_1.logger.info(`Added schedule trigger ${triggerId}`);
};
exports.addScheduleTrigger = addScheduleTrigger;
/**
 * Remove a schedule trigger
 */
const removeScheduleTrigger = async (triggerId) => {
    const repeatableJobs = await schedulerQueue.getRepeatableJobs();
    const job = repeatableJobs.find(j => j.id === `schedule-${triggerId}`);
    if (job) {
        await schedulerQueue.removeRepeatableByKey(job.key);
        logger_1.logger.info(`Removed schedule trigger ${triggerId}`);
    }
};
exports.removeScheduleTrigger = removeScheduleTrigger;
/**
 * Process a scheduled trigger (called by worker)
 */
const processScheduledTrigger = async (triggerId, agentId, ownerId) => {
    // Create execution record
    const execution = await Execution_1.Execution.create({
        agentId,
        triggerId,
        triggerType: "schedule",
        status: "pending",
        inputPayload: {
            timestamp: new Date().toISOString(),
            type: "scheduled"
        }
    });
    // Update trigger last triggered time
    await Trigger_1.Trigger.findByIdAndUpdate(triggerId, {
        lastTriggeredAt: new Date()
    });
    // Enqueue execution job
    await (0, executionQueue_1.enqueueExecution)({
        executionId: execution._id.toString(),
        agentId,
        ownerId,
        triggerId,
        triggerType: "schedule",
        payload: {
            timestamp: new Date().toISOString()
        }
    });
    logger_1.logger.info(`Scheduled trigger fired`, { triggerId, agentId, executionId: execution._id });
};
exports.processScheduledTrigger = processScheduledTrigger;
exports.default = {
    initScheduler: exports.initScheduler,
    addScheduleTrigger: exports.addScheduleTrigger,
    removeScheduleTrigger: exports.removeScheduleTrigger,
    processScheduledTrigger: exports.processScheduledTrigger
};
