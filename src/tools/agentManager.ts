import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import { Agent } from "../models/Agent";
import { Queue } from "bullmq";
import redis from "../lib/redis";
import { logger } from "../lib/logger";

const queue = new Queue("agent-run-queue", { connection: redis as any });

function ensureAxleCaller(ctx?: RunContext<any>) {
  // Allow calls from axle system or skip if context not available (for internal tool executor)
  const caller = ctx?.context?.caller || ctx?.context?.from;
  if (caller && caller !== "axle") {
    throw new Error(
      "Unauthorized: agent-manager tools may only be invoked by Axle"
    );
  }
}

export const create_agent = tool({
  name: "axle_create_agent",
  description: "Create a new micro-agent for the user",
  parameters: z.object({
    ownerId: z.string(),
    name: z.string(),
    description: z.string().nullable().default(""),
    systemPrompt: z.string().nullable().default(""),
    tools: z.array(z.string()).default([]),
    integrations: z.array(z.string()).default([]),
    schedule: z.any().nullable().default(null),
  }),
  execute: async (params, ctx?: RunContext<any>) => {
    console.log("[agentManager.execute] Called with params:", {
      paramType: typeof params,
      paramKeys: Object.keys(params || {}),
      paramJson: JSON.stringify(params),
    });
    try {
      ensureAxleCaller(ctx);
      const {
        ownerId,
        name,
        description,
        systemPrompt,
        tools: t,
        integrations,
        schedule,
      } = params as any;
      
      console.log("[agentManager.execute] Extracted params:", {
        ownerId,
        name,
        description,
        systemPrompt,
        t,
        integrations,
        schedule,
      });
      
      const a = await Agent.create({
        ownerId,
        name,
        description,
        systemPrompt,
        tools: t || [],
        integrations: integrations || [],
        schedule: schedule || { enabled: false },
      } as any);

      console.log("[agentManager.execute] Agent created:", {
        agentId: a._id,
        name: a.name,
      });

      // Schedule if requested
      if (a.schedule?.enabled) {
        try {
          const repeatOpts: any = {};
          if (a.schedule.intervalMinutes)
            repeatOpts.every = (a.schedule.intervalMinutes || 5) * 60 * 1000;
          else if (a.schedule.cron) repeatOpts.cron = a.schedule.cron;
          await queue.add(
            `agent-${a._id}`,
            { agentId: a._id.toString(), ownerId },
            { repeat: repeatOpts }
          );
        } catch (err) {
          logger.warn(
            "agentManager.create_agent: failed to add repeatable job",
            err
          );
        }
      }

      return { ok: true, agent: a };
    } catch (err) {
      console.error("[agentManager.execute] Error in create_agent:", err);
      throw err;
    }
  },
});

export const update_agent = tool({
  name: "axle_update_agent",
  description: "Update an existing micro-agent",
  parameters: z.object({ agentId: z.string(), updates: z.any() }),
  execute: async ({ agentId, updates }, ctx?: RunContext<any>) => {
    ensureAxleCaller(ctx);
    const a = await Agent.findByIdAndUpdate(agentId, updates as any, {
      new: true,
    }).lean();
    return { ok: true, agent: a };
  },
});

export const delete_agent = tool({
  name: "axle_delete_agent",
  description: "Delete a micro-agent and remove scheduled jobs",
  parameters: z.object({ agentId: z.string() }),
  execute: async ({ agentId }, ctx?: RunContext<any>) => {
    ensureAxleCaller(ctx);
    await Agent.findByIdAndDelete(agentId);
    // remove any repeatable jobs
    try {
      const jobs = await queue.getRepeatableJobs();
      for (const j of jobs) {
        if (
          j.name === `agent-${agentId}` ||
          (j.key && j.key.includes(`agent-${agentId}`))
        ) {
          await queue.removeRepeatableByKey(j.key);
        }
      }
    } catch (err) {
      logger.warn(
        "agentManager.delete_agent: failed to cleanup repeatable jobs",
        err
      );
    }
    return { ok: true };
  },
});

export const list_agents = tool({
  name: "axle_list_agents",
  description: "List agents for a user",
  parameters: z.object({ ownerId: z.string() }),
  execute: async ({ ownerId }, ctx?: RunContext<any>) => {
    ensureAxleCaller(ctx);
    const agents = await Agent.find({ ownerId }).lean();
    return { agents };
  },
});

export const get_agent = tool({
  name: "axle_get_agent",
  description: "Get an agent by ID",
  parameters: z.object({ agentId: z.string() }),
  execute: async ({ agentId }, ctx?: RunContext<any>) => {
    ensureAxleCaller(ctx);
    const agent = await Agent.findById(agentId).lean();
    return { agent };
  },
});

export const schedule_agent = tool({
  name: "axle_schedule_agent",
  description: "Enable scheduling for an agent (intervalMinutes or cron)",
  parameters: z.object({
    agentId: z.string(),
    ownerId: z.string(),
    intervalMinutes: z.number().nullable().default(null),
    cron: z.string().nullable().default(null),
  }),
  execute: async (
    { agentId, ownerId, intervalMinutes, cron },
    ctx?: RunContext<any>
  ) => {
    ensureAxleCaller(ctx);
    const update: any = { "schedule.enabled": true };
    if (intervalMinutes) update["schedule.intervalMinutes"] = intervalMinutes;
    if (cron) update["schedule.cron"] = cron;
    await Agent.findByIdAndUpdate(agentId, update as any);

    const repeatOpts: any = {};
    if (intervalMinutes) repeatOpts.every = (intervalMinutes || 5) * 60 * 1000;
    else if (cron) repeatOpts.cron = cron;
    await queue.add(
      `agent-${agentId}`,
      { agentId, ownerId },
      { repeat: repeatOpts }
    );
    return { ok: true };
  },
});

export const unschedule_agent = tool({
  name: "axle_unschedule_agent",
  description: "Disable scheduling for an agent and remove repeatable jobs",
  parameters: z.object({ agentId: z.string() }),
  execute: async ({ agentId }, ctx?: RunContext<any>) => {
    ensureAxleCaller(ctx);
    await Agent.findByIdAndUpdate(agentId, {
      "schedule.enabled": false,
    } as any);
    try {
      const jobs = await queue.getRepeatableJobs();
      for (const j of jobs) {
        if (
          j.name === `agent-${agentId}` ||
          (j.key && j.key.includes(`agent-${agentId}`))
        ) {
          await queue.removeRepeatableByKey(j.key);
        }
      }
    } catch (err) {
      logger.warn(
        "agentManager.unschedule_agent: failed to remove repeatable jobs",
        err
      );
    }
    return { ok: true };
  },
});

export default {};
