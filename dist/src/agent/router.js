"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.delegateToMicroAgents = void 0;
const Agent_1 = require("../models/Agent");
const logger_1 = require("../lib/logger");
/**
 * Delegate task to appropriate micro agents.
 */
const delegateToMicroAgents = async (task) => {
    const startTime = Date.now();
    const results = [];
    try {
        // Step 1: Identify candidate micro agents
        let agents = [];
        if (task.preferredAgents && task.preferredAgents.length > 0) {
            // Use specified agents
            agents = await Agent_1.Agent.find({
                _id: { $in: task.preferredAgents },
                ownerId: task.userId,
            }).lean();
        }
        else {
            // Auto-discover: find agents that might handle this task
            // For MVP, return all agents for the user; a smarter impl would analyze tools needed
            agents = await Agent_1.Agent.find({ ownerId: task.userId }).lean();
        }
        if (agents.length === 0) {
            logger_1.logger.warn(`No agents found for user ${task.userId}`);
            return {
                status: "failed",
                results: [],
                summary: "No agents configured for this user.",
                totalTime: Date.now() - startTime,
            };
        }
        // Step 2: Execute micro agents in parallel
        // Use Promise.allSettled to isolate failures
        const executionPromises = agents.map((agent) => executeAgentWithTimeout(agent, task.userId, task.instruction, task.timeout || 30000 // 30s default
        ));
        const settlements = await Promise.allSettled(executionPromises);
        // Step 3: Aggregate results
        let successCount = 0;
        for (let i = 0; i < settlements.length; i++) {
            const settlement = settlements[i];
            const agent = agents[i];
            const agentStartTime = Date.now();
            if (settlement.status === "fulfilled") {
                const result = settlement.value;
                successCount++;
                results.push({
                    agentId: agent._id.toString(),
                    agentName: agent.name,
                    status: "completed",
                    result: result.data,
                    executionTime: result.executionTime,
                });
                logger_1.logger.info(`Agent ${agent.name} completed successfully in ${result.executionTime}ms`);
            }
            else {
                const error = settlement.reason;
                results.push({
                    agentId: agent._id.toString(),
                    agentName: agent.name,
                    status: error.message === "TIMEOUT" ? "timeout" : "failed",
                    error: error.message,
                    executionTime: Date.now() - agentStartTime,
                });
                logger_1.logger.error(`Agent ${agent.name} failed: ${error.message}`, error.stack);
            }
        }
        const finalStatus = successCount === agents.length
            ? "success"
            : successCount > 0
                ? "partial"
                : "failed";
        return {
            status: finalStatus,
            results,
            summary: `Executed ${agents.length} agents: ${successCount} successful, ${agents.length - successCount} failed.`,
            totalTime: Date.now() - startTime,
        };
    }
    catch (err) {
        logger_1.logger.error("Delegation error", err);
        return {
            status: "failed",
            results,
            summary: `Unexpected error: ${err.message}`,
            totalTime: Date.now() - startTime,
        };
    }
};
exports.delegateToMicroAgents = delegateToMicroAgents;
/**
 * Execute a single agent with timeout and retry logic.
 */
async function executeAgentWithTimeout(agent, userId, instruction, timeout) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("TIMEOUT"));
        }, timeout);
        // Import here to avoid circular deps
        Promise.resolve().then(() => __importStar(require("../services/agentRunner"))).then(({ runAgentById }) => {
            runAgentById(userId, agent._id.toString(), instruction)
                .then((result) => {
                clearTimeout(timer);
                resolve({
                    data: result,
                    executionTime: Date.now() - startTime,
                });
            })
                .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    });
}
exports.default = { delegateToMicroAgents: exports.delegateToMicroAgents };
