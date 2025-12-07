import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import { Agent } from "../models/Agent";
import { Integration } from "../models/Integration";
import { decrypt } from "../lib/crypto";
import { runAgentById } from "../services/agentRunner";
import { Queue } from "bullmq";
import redis from "../lib/redis";
import { env } from "../config/env";

const queue = new Queue("agent-run-queue", { connection: redis as any });

export const central_ai = tool({
  name: "central_ai",
  description:
    "Central administrative AI with app-wide actions (create agents, inspect integrations, run/schedule agents)",
  parameters: z.object({
    action: z.string(),
    payload: z.any().nullable().default(null),
  }),
  execute: async ({ action, payload }, ctx?: RunContext<any>) => {
    switch (action) {
      case "create_agent": {
        const {
          name,
          description,
          systemPrompt,
          tools,
          integrations,
          ownerId,
        } = payload || {};
        if (!name || !ownerId)
          throw new Error("create_agent requires name and ownerId");
        const a = await Agent.create({
          name,
          description,
          systemPrompt,
          tools,
          integrations,
          ownerId,
        } as any);
        return { ok: true, agent: a };
      }
      case "list_agents_for_user": {
        const { ownerId } = payload || {};
        if (!ownerId) throw new Error("ownerId required");
        const agents = await Agent.find({ ownerId }).lean();
        return { agents };
      }
      case "list_integrations": {
        const { userId } = payload || {};
        if (!userId) throw new Error("userId required");
        const integrations = await Integration.find({ userId }).lean();
        return { integrations };
      }
      case "check_integration": {
        const { userId, name } = payload || {};
        if (!userId || !name) throw new Error("userId and name required");
        const i = await Integration.findOne({ userId, name }).lean();
        if (!i) return { ok: false, found: false };
        return {
          ok: true,
          found: true,
          integration: {
            ...i,
            accessToken: i.accessToken ? decrypt(i.accessToken) : undefined,
          },
        };
      }
      case "run_agent": {
        const { agentId, userId, input } = payload || {};
        if (!agentId || !userId) throw new Error("agentId and userId required");
        const result = await runAgentById(userId, agentId, input);
        return { ok: true, result };
      }
      case "schedule_agent": {
        const { agentId, ownerId, intervalMinutes, cron } = payload || {};
        if (!agentId || !ownerId)
          throw new Error("agentId and ownerId required");
        const update: any = { "schedule.enabled": true };
        if (intervalMinutes)
          update["schedule.intervalMinutes"] = intervalMinutes;
        if (cron) update["schedule.cron"] = cron;
        await Agent.findByIdAndUpdate(agentId, update);

        // add repeatable job
        const repeatOpts: any = {};
        if (intervalMinutes)
          repeatOpts.every = (intervalMinutes || 5) * 60 * 1000;
        else if (cron) repeatOpts.cron = cron;
        await queue.add(
          `agent-${agentId}`,
          { agentId, ownerId },
          { repeat: repeatOpts }
        );
        return { ok: true };
      }
      case "unschedule_agent": {
        const { agentId } = payload || {};
        if (!agentId) throw new Error("agentId required");
        await Agent.findByIdAndUpdate(agentId, { "schedule.enabled": false });
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

export default {};
