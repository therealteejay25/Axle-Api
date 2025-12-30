"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerBatchRun = exports.triggerManualRun = void 0;
const Agent_1 = require("../models/Agent");
const Execution_1 = require("../models/Execution");
const executionQueue_1 = require("../queue/executionQueue");
const billing_1 = require("../services/billing");
const logger_1 = require("../services/logger");
/**
 * Trigger a manual agent run
 */
const triggerManualRun = async (options) => {
    const { agentId, ownerId, payload = {} } = options;
    // Verify agent exists and belongs to user
    const agent = await Agent_1.Agent.findOne({
        _id: agentId,
        ownerId
    });
    if (!agent) {
        return { success: false, error: "Agent not found" };
    }
    if (agent.status !== "active") {
        return { success: false, error: "Agent is paused" };
    }
    // Check user has credits
    const hasCreds = await (0, billing_1.hasCredits)(ownerId, 1);
    if (!hasCreds) {
        return { success: false, error: "Insufficient credits" };
    }
    // Create execution record
    const execution = await Execution_1.Execution.create({
        agentId: agent._id,
        triggerType: "manual",
        status: "pending",
        inputPayload: {
            ...payload,
            triggeredAt: new Date().toISOString(),
            triggeredBy: ownerId
        }
    });
    // Enqueue execution job
    await (0, executionQueue_1.enqueueExecution)({
        executionId: execution._id.toString(),
        agentId: agent._id.toString(),
        ownerId,
        triggerType: "manual",
        payload: {
            ...payload,
            triggeredAt: new Date().toISOString()
        }
    });
    logger_1.logger.info(`Manual run triggered`, {
        agentId,
        executionId: execution._id
    });
    return { success: true, executionId: execution._id.toString() };
};
exports.triggerManualRun = triggerManualRun;
/**
 * Trigger multiple agents at once
 */
const triggerBatchRun = async (agentIds, ownerId, payload) => {
    const results = [];
    for (const agentId of agentIds) {
        const result = await (0, exports.triggerManualRun)({ agentId, ownerId, payload });
        results.push({
            agentId,
            executionId: result.executionId,
            error: result.error
        });
    }
    return { results };
};
exports.triggerBatchRun = triggerBatchRun;
exports.default = {
    triggerManualRun: exports.triggerManualRun,
    triggerBatchRun: exports.triggerBatchRun
};
