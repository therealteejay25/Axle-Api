"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unschedule_agent = exports.schedule_agent = exports.get_agent = exports.list_agents = exports.delete_agent = exports.update_agent = exports.create_agent = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const Agent_1 = require("../models/Agent");
const bullmq_1 = require("bullmq");
const redis_1 = __importDefault(require("../lib/redis"));
const logger_1 = require("../lib/logger");
const queue = new bullmq_1.Queue("agent-run-queue", { connection: redis_1.default });
function ensureAxleCaller(ctx) {
    // Allow calls from axle system or skip if context not available (for internal tool executor)
    const caller = ctx?.context?.caller || ctx?.context?.from;
    if (caller && caller !== "axle") {
        throw new Error("Unauthorized: agent-manager tools may only be invoked by Axle");
    }
}
exports.create_agent = (0, agents_1.tool)({
    name: "axle_create_agent",
    description: "Create a new micro-agent for the user",
    parameters: zod_1.z.object({
        ownerId: zod_1.z.string(),
        name: zod_1.z.string(),
        description: zod_1.z.string().nullable().default(""),
        systemPrompt: zod_1.z.string().nullable().default(""),
        tools: zod_1.z.array(zod_1.z.string()).default([]),
        integrations: zod_1.z.array(zod_1.z.string()).default([]),
        schedule: zod_1.z.any().nullable().default(null),
    }),
    execute: async (params, ctx) => {
        console.log("[agentManager.execute] Called with params:", {
            paramType: typeof params,
            paramKeys: Object.keys(params || {}),
            paramJson: JSON.stringify(params),
        });
        try {
            ensureAxleCaller(ctx);
            const { ownerId, name, description, systemPrompt, tools: t, integrations, schedule, } = params;
            console.log("[agentManager.execute] Extracted params:", {
                ownerId,
                name,
                description,
                systemPrompt,
                t,
                integrations,
                schedule,
            });
            const a = await Agent_1.Agent.create({
                ownerId,
                name,
                description,
                systemPrompt,
                tools: t || [],
                integrations: integrations || [],
                schedule: schedule || { enabled: false },
            });
            console.log("[agentManager.execute] Agent created:", {
                agentId: a._id,
                name: a.name,
            });
            // Schedule if requested
            if (a.schedule?.enabled) {
                try {
                    const repeatOpts = {};
                    if (a.schedule.intervalMinutes)
                        repeatOpts.every = (a.schedule.intervalMinutes || 5) * 60 * 1000;
                    else if (a.schedule.cron)
                        repeatOpts.cron = a.schedule.cron;
                    await queue.add(`agent-${a._id}`, { agentId: a._id.toString(), ownerId }, { repeat: repeatOpts });
                }
                catch (err) {
                    logger_1.logger.warn("agentManager.create_agent: failed to add repeatable job", err);
                }
            }
            return { ok: true, agent: a };
        }
        catch (err) {
            console.error("[agentManager.execute] Error in create_agent:", err);
            throw err;
        }
    },
});
exports.update_agent = (0, agents_1.tool)({
    name: "axle_update_agent",
    description: "Update an existing micro-agent",
    parameters: zod_1.z.object({ agentId: zod_1.z.string(), updates: zod_1.z.any() }),
    execute: async ({ agentId, updates }, ctx) => {
        ensureAxleCaller(ctx);
        const a = await Agent_1.Agent.findByIdAndUpdate(agentId, updates, {
            new: true,
        }).lean();
        return { ok: true, agent: a };
    },
});
exports.delete_agent = (0, agents_1.tool)({
    name: "axle_delete_agent",
    description: "Delete a micro-agent and remove scheduled jobs",
    parameters: zod_1.z.object({ agentId: zod_1.z.string() }),
    execute: async ({ agentId }, ctx) => {
        ensureAxleCaller(ctx);
        await Agent_1.Agent.findByIdAndDelete(agentId);
        // remove any repeatable jobs
        try {
            const jobs = await queue.getRepeatableJobs();
            for (const j of jobs) {
                if (j.name === `agent-${agentId}` ||
                    (j.key && j.key.includes(`agent-${agentId}`))) {
                    await queue.removeRepeatableByKey(j.key);
                }
            }
        }
        catch (err) {
            logger_1.logger.warn("agentManager.delete_agent: failed to cleanup repeatable jobs", err);
        }
        return { ok: true };
    },
});
exports.list_agents = (0, agents_1.tool)({
    name: "axle_list_agents",
    description: "List agents for a user",
    parameters: zod_1.z.object({ ownerId: zod_1.z.string() }),
    execute: async ({ ownerId }, ctx) => {
        ensureAxleCaller(ctx);
        const agents = await Agent_1.Agent.find({ ownerId }).lean();
        return { agents };
    },
});
exports.get_agent = (0, agents_1.tool)({
    name: "axle_get_agent",
    description: "Get an agent by ID",
    parameters: zod_1.z.object({ agentId: zod_1.z.string() }),
    execute: async ({ agentId }, ctx) => {
        ensureAxleCaller(ctx);
        const agent = await Agent_1.Agent.findById(agentId).lean();
        return { agent };
    },
});
exports.schedule_agent = (0, agents_1.tool)({
    name: "axle_schedule_agent",
    description: "Enable scheduling for an agent (intervalMinutes or cron)",
    parameters: zod_1.z.object({
        agentId: zod_1.z.string(),
        ownerId: zod_1.z.string(),
        intervalMinutes: zod_1.z.number().nullable().default(null),
        cron: zod_1.z.string().nullable().default(null),
    }),
    execute: async ({ agentId, ownerId, intervalMinutes, cron }, ctx) => {
        ensureAxleCaller(ctx);
        const update = { "schedule.enabled": true };
        if (intervalMinutes)
            update["schedule.intervalMinutes"] = intervalMinutes;
        if (cron)
            update["schedule.cron"] = cron;
        await Agent_1.Agent.findByIdAndUpdate(agentId, update);
        const repeatOpts = {};
        if (intervalMinutes)
            repeatOpts.every = (intervalMinutes || 5) * 60 * 1000;
        else if (cron)
            repeatOpts.cron = cron;
        await queue.add(`agent-${agentId}`, { agentId, ownerId }, { repeat: repeatOpts });
        return { ok: true };
    },
});
exports.unschedule_agent = (0, agents_1.tool)({
    name: "axle_unschedule_agent",
    description: "Disable scheduling for an agent and remove repeatable jobs",
    parameters: zod_1.z.object({ agentId: zod_1.z.string() }),
    execute: async ({ agentId }, ctx) => {
        ensureAxleCaller(ctx);
        await Agent_1.Agent.findByIdAndUpdate(agentId, {
            "schedule.enabled": false,
        });
        try {
            const jobs = await queue.getRepeatableJobs();
            for (const j of jobs) {
                if (j.name === `agent-${agentId}` ||
                    (j.key && j.key.includes(`agent-${agentId}`))) {
                    await queue.removeRepeatableByKey(j.key);
                }
            }
        }
        catch (err) {
            logger_1.logger.warn("agentManager.unschedule_agent: failed to remove repeatable jobs", err);
        }
        return { ok: true };
    },
});
exports.default = {};
