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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainAgentController = exports.delegateTaskController = exports.runAgentController = exports.deleteAgentController = exports.getAgentStatusController = exports.getAgentController = exports.listAgentsController = exports.createAgentController = void 0;
const Agent_1 = require("../models/Agent");
const agentRunner_1 = require("../services/agentRunner");
const realtime_1 = require("../services/realtime");
const router_1 = require("../agent/router");
const bullmq_1 = require("bullmq");
const redis_1 = __importDefault(require("../lib/redis"));
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const schemas_1 = require("../lib/schemas");
const main_1 = require("../agent/main");
const agentRunner_2 = require("../services/agentRunner");
const queue = new bullmq_1.Queue("agent-run-queue", { connection: redis_1.default });
const createAgentController = async (req, res) => {
    const userId = req.userId || req.body.ownerId;
    const correlationId = req.correlationId;
    try {
        // Validate input
        const validated = schemas_1.CreateAgentSchema.parse(req.body);
        const { name, description, systemPrompt, tools, integrations, schedule, model, } = validated;
        if (!userId) {
            return res.status(401).json({ error: "User ID required" });
        }
        // Default to 24/7 running if no schedule provided
        const defaultSchedule = schedule || {
            enabled: true,
            intervalMinutes: 5, // Run every 5 minutes for continuous operation
        };
        const agent = await Agent_1.Agent.create({
            name,
            description,
            systemPrompt,
            tools: tools || [],
            integrations: integrations || [],
            ownerId: userId,
            model: model || "gpt-4o",
            schedule: defaultSchedule,
        });
        // If scheduling enabled, add repeatable job to queue
        if (agent.schedule?.enabled) {
            try {
                const repeatOpts = {};
                if (agent.schedule.intervalMinutes)
                    repeatOpts.every = (agent.schedule.intervalMinutes || 5) * 60 * 1000;
                else if (agent.schedule.cron)
                    repeatOpts.cron = agent.schedule.cron;
                await queue.add(`agent-${agent._id.toString()}`, { agentId: agent._id.toString(), ownerId: userId }, { repeat: repeatOpts });
            }
            catch (sErr) {
                logger_1.logger.error(`[${correlationId}] Failed to schedule agent ${agent._id}`, sErr);
            }
        }
        (0, realtime_1.emitToAgent)(agent._id.toString(), "agent:created", { agent });
        logger_1.logger.info(`[${correlationId}] Agent created: ${agent._id}`);
        res.status(201).json({ agent });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Create agent failed`, err);
        if (err?.name === "ZodError") {
            return res
                .status(400)
                .json({ error: "Validation error", details: err?.errors });
        }
        res.status(500).json({ error: "Unable to create agent" });
    }
};
exports.createAgentController = createAgentController;
const listAgentsController = async (req, res) => {
    const userId = req.userId;
    const correlationId = req.correlationId;
    try {
        const agents = await Agent_1.Agent.find({ ownerId: userId }).lean();
        res.json({ agents });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] List agents failed`, err);
        res.status(500).json({ error: "Unable to list agents" });
    }
};
exports.listAgentsController = listAgentsController;
const getAgentController = async (req, res) => {
    const { id } = req.params;
    const correlationId = req.correlationId;
    try {
        const agent = await Agent_1.Agent.findById(id).lean();
        if (!agent)
            return res.status(404).json({ error: "Agent not found" });
        res.json({ agent });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Get agent failed`, err);
        res.status(500).json({ error: "Unable to get agent" });
    }
};
exports.getAgentController = getAgentController;
const getAgentStatusController = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const correlationId = req.correlationId;
    try {
        const agent = await Agent_1.Agent.findById(id).lean();
        if (!agent)
            return res.status(404).json({ error: "Agent not found" });
        if (agent.ownerId !== userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        // Get recent logs (last 10)
        const recentLogs = (agent.logs || []).slice(-10).reverse();
        // Check if agent is scheduled
        const schedule = agent.schedule || {};
        const isScheduled = schedule.enabled === true;
        // Calculate next run time if scheduled
        let nextRunAt = null;
        if (isScheduled && schedule.intervalMinutes) {
            const lastRun = agent.lastRunAt;
            if (lastRun) {
                nextRunAt = new Date(new Date(lastRun).getTime() + schedule.intervalMinutes * 60 * 1000);
            }
            else {
                nextRunAt = new Date(); // Should run immediately
            }
        }
        res.json({
            agent: {
                id: agent._id,
                name: agent.name,
                description: agent.description,
                model: agent.model || "gpt-4o",
                schedule: {
                    enabled: isScheduled,
                    intervalMinutes: schedule.intervalMinutes,
                    cron: schedule.cron,
                },
                lastRunAt: agent.lastRunAt,
                nextRunAt,
                isRunning: false, // Could be enhanced with a running state tracker
                totalRuns: (agent.logs || []).length,
            },
            recentLogs,
            status: isScheduled ? "scheduled" : "disabled",
        });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Get agent status failed`, err);
        res.status(500).json({ error: "Unable to get agent status" });
    }
};
exports.getAgentStatusController = getAgentStatusController;
const deleteAgentController = async (req, res) => {
    const { id } = req.params;
    const correlationId = req.correlationId;
    try {
        // Remove any repeatable jobs associated with this agent
        try {
            const repeatableJobs = await queue.getRepeatableJobs();
            for (const job of repeatableJobs) {
                // job.name contains the name used when adding (e.g., `agent-<id>`)
                if (job.name === `agent-${id}` ||
                    (job.key && job.key.includes(`agent-${id}`))) {
                    try {
                        await queue.removeRepeatableByKey(job.key);
                        logger_1.logger.info(`[${correlationId}] Removed repeatable job for agent ${id}: ${job.key}`);
                    }
                    catch (remErr) {
                        logger_1.logger.warn(`[${correlationId}] Failed to remove repeatable job ${job.key} for agent ${id}`, remErr);
                    }
                }
            }
        }
        catch (qErr) {
            logger_1.logger.warn(`[${correlationId}] Failed to list/remove repeatable jobs for agent ${id}`, qErr);
        }
        await Agent_1.Agent.findByIdAndDelete(id);
        logger_1.logger.info(`[${correlationId}] Agent deleted: ${id}`);
        res.json({
            message: "Agent deleted and scheduled jobs cleaned up if present.",
        });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Delete agent failed`, err);
        res.status(500).json({ error: "Unable to delete agent" });
    }
};
exports.deleteAgentController = deleteAgentController;
const runAgentController = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId || "";
    const correlationId = req.correlationId;
    try {
        const validated = schemas_1.RunAgentSchema.parse(req.body);
        const { input } = validated;
        const result = await (0, agentRunner_1.runAgentById)(userId, id, input);
        logger_1.logger.info(`[${correlationId}] Agent run completed: ${id}`);
        res.json({ result });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Run agent failed`, err);
        if (err?.name === "ZodError") {
            return res.status(400).json({ error: "Validation error" });
        }
        res.status(500).json({ error: "Unable to run agent" });
    }
};
exports.runAgentController = runAgentController;
/**
 * Delegate task to multiple micro agents (main agent coordinator).
 */
const delegateTaskController = async (req, res) => {
    const userId = req.userId;
    const correlationId = req.correlationId;
    try {
        const validated = schemas_1.DelegateTaskSchema.parse(req.body);
        const result = await (0, router_1.delegateToMicroAgents)({
            userId,
            instruction: validated.instruction,
            preferredAgents: validated.preferredAgents,
            timeout: validated.timeout || env_1.env.AGENT_TIMEOUT_MS,
        });
        logger_1.logger.info(`[${correlationId}] Task delegated with status: ${result.status}`);
        res.json({ result });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Delegate task failed`, err);
        if (err?.name === "ZodError") {
            return res.status(400).json({ error: "Validation error" });
        }
        res.status(500).json({ error: "Unable to delegate task" });
    }
};
exports.delegateTaskController = delegateTaskController;
/**
 * Main agent chat endpoint: let the main agent decide which tools or micro-agents to run.
 */
const mainAgentController = async (req, res) => {
    const userId = req.userId;
    const correlationId = req.correlationId;
    try {
        const validated = schemas_1.DelegateTaskSchema.parse(req.body);
        // Build integration context and available agents
        const context = await (0, agentRunner_2.buildIntegrationContext)(userId);
        const agentDocs = await Agent_1.Agent.find({ ownerId: userId }).lean();
        const availableAgents = agentDocs.map((a) => ({
            id: String(a._id),
            name: a.name,
            description: a.description,
        }));
        const runner = main_1.axleAgent;
        if (!runner || typeof runner.run !== "function") {
            return res.status(500).json({ error: "Main agent runner not available" });
        }
        const result = await runner.run({
            input: validated.instruction,
            context: { ...context, userId },
            availableAgents,
            userId,
            onStep: (step) => {
                (0, realtime_1.emitToAgent)("main", "agent:run:step", step);
            },
        });
        // If agent returned a decision, execute it
        if (result.decision) {
            console.log("[mainAgentController] Agent generated decision, executing...");
            const { executeDecision } = await Promise.resolve().then(() => __importStar(require("../lib/toolExecutor")));
            const executionResult = await executeDecision(result.decision, userId);
            console.log("[mainAgentController] Execution result:", {
                success: executionResult.success,
                hasError: !!executionResult.error,
            });
            // Return both the agent's natural language response and the execution result
            return res.json({
                result: {
                    ...result,
                    execution: executionResult,
                },
            });
        }
        logger_1.logger.info(`[${correlationId}] Main agent run completed`);
        res.json({ result });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Main agent failed`, err);
        if (err?.name === "ZodError") {
            return res.status(400).json({ error: "Validation error" });
        }
        res.status(500).json({ error: "Unable to process instruction" });
    }
};
exports.mainAgentController = mainAgentController;
exports.default = {};
