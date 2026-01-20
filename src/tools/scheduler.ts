
import { z } from "zod";
import { logger } from "../services/logger";
import { FunctionTool } from "@google/adk";
import { Trigger } from "../models/Trigger";
import { addScheduleTrigger } from "../triggers/scheduleHandler";

export const createScheduleSelfTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "schedule_self",
    description: "Schedule this agent to run automatically at specific times. Use standard cron syntax. Example: '0 10 * * *' for daily at 10 AM.",
    parameters: z.object({
      cron: z.string().min(5, "Valid cron expression required").describe("Cron expression (e.g. '0 10 * * *' for daily 10am)"),
      timezone: z.string().default("UTC").describe("Timezone (e.g. 'Africa/Lagos', 'UTC', 'America/New_York')"),
      enabled: z.boolean().default(true),
    }),
    execute: async ({ cron, timezone, enabled }) => {
      try {
        logger.info(`[SCHEDULER] Scheduling agent ${agentId} with cron: ${cron} (${timezone})`);
        
        // Create trigger in DB
        const trigger = await Trigger.create({
          type: "schedule",
          agentId: agentId,
          enabled: enabled,
          config: {
            cron: cron,
            timezone: timezone
          }
        });

        // Add to BullMQ
        await addScheduleTrigger(trigger._id.toString());

        return {
          success: true,
          message: `Agent scheduled successfully with cron: ${cron}`,
          triggerId: trigger._id
        };
      } catch (error: any) {
        logger.error("[SCHEDULER] Failed to schedule:", error);
        return {
          success: false,
          error: `Failed to schedule: ${error.message}`
        };
      }
    }
  });
};
