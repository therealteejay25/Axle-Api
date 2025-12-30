"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.central_ai = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const Agent_1 = require("../models/Agent");
const Integration_1 = require("../models/Integration");
const crypto_1 = require("../lib/crypto");
const agentRunner_1 = require("../services/agentRunner");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
const connection = new ioredis_1.default(env_1.env.REDIS_URL || "redis://127.0.0.1:6379");
const queue = new bullmq_1.Queue("agent-run-queue", { connection });
exports.central_ai = (0, agents_1.tool)({
    name: "central_ai",
    description: "Central administrative AI with app-wide actions (create agents, inspect integrations, run/schedule agents)",
    parameters: zod_1.z.object({ action: zod_1.z.string(), payload: zod_1.z.any().nullable().default(null) }),
    execute: async ({ action, payload }, ctx) => {
        switch (action) {
            case "create_agent": {
                const { name, description, systemPrompt, tools, integrations, ownerId, } = payload || {};
                if (!name || !ownerId)
                    throw new Error("create_agent requires name and ownerId");
                const a = await Agent_1.Agent.create({
                    name,
                    description,
                    systemPrompt,
                    tools,
                    integrations,
                    ownerId,
                });
                return { ok: true, agent: a };
            }
            case "list_agents_for_user": {
                const { ownerId } = payload || {};
                if (!ownerId)
                    throw new Error("ownerId required");
                const agents = await Agent_1.Agent.find({ ownerId }).lean();
                return { agents };
            }
            case "list_integrations": {
                const { userId } = payload || {};
                if (!userId)
                    throw new Error("userId required");
                const integrations = await Integration_1.Integration.find({ userId }).lean();
                return { integrations };
            }
            case "check_integration": {
                const { userId, name } = payload || {};
                if (!userId || !name)
                    throw new Error("userId and name required");
                const i = await Integration_1.Integration.findOne({ userId, name }).lean();
                if (!i)
                    return { ok: false, found: false };
                return {
                    ok: true,
                    found: true,
                    integration: {
                        ...i,
                        accessToken: i.accessToken ? (0, crypto_1.decrypt)(i.accessToken) : undefined,
                    },
                };
            }
            case "run_agent": {
                const { agentId, userId, input } = payload || {};
                if (!agentId || !userId)
                    throw new Error("agentId and userId required");
                const result = await (0, agentRunner_1.runAgentById)(userId, agentId, input);
                return { ok: true, result };
            }
            case "schedule_agent": {
                const { agentId, ownerId, intervalMinutes, cron } = payload || {};
                if (!agentId || !ownerId)
                    throw new Error("agentId and ownerId required");
                const update = { "schedule.enabled": true };
                if (intervalMinutes)
                    update["schedule.intervalMinutes"] = intervalMinutes;
                if (cron)
                    update["schedule.cron"] = cron;
                await Agent_1.Agent.findByIdAndUpdate(agentId, update);
                // add repeatable job
                const repeatOpts = {};
                if (intervalMinutes)
                    repeatOpts.every = (intervalMinutes || 5) * 60 * 1000;
                else if (cron)
                    repeatOpts.cron = cron;
                await queue.add(`agent-${agentId}`, { agentId, ownerId }, { repeat: repeatOpts });
                return { ok: true };
            }
            case "unschedule_agent": {
                const { agentId } = payload || {};
                if (!agentId)
                    throw new Error("agentId required");
                await Agent_1.Agent.findByIdAndUpdate(agentId, { "schedule.enabled": false });
                // remove repeatable jobs that match the name
                const jobs = await queue.getRepeatableJobs();
                for (const j of jobs) {
                    if (j.name === `agent-${agentId}`) {
                        await queue.removeRepeatableByKey(j.key);
                    }
                }
                return { ok: true };
            }
            default:
                throw new Error(`Unknown central_ai action: ${action}`);
        }
    },
});
exports.default = {};
