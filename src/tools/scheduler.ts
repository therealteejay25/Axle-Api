
import { z } from "zod";
import { logger } from "../services/logger";
import { FunctionTool } from "@google/adk";
import { Trigger } from "../models/Trigger";
import { User } from "../models/User";
import { addScheduleTrigger } from "../triggers/scheduleHandler";
import { v4 as uuidv4 } from "uuid";

export const createScheduleSelfTool = (userId: string, agentId: string) => {
  return new FunctionTool({
    name: "schedule_self",
    description: "Schedule this agent to run automatically at specific times. Use standard cron syntax. Example: '0 10 * * *' for daily at 10 AM.",
    parameters: z.object({
      cron: z.string().min(5, "Valid cron expression required").describe("Cron expression (e.g. '0 10 * * *' for daily 10am)"),
      active: z.boolean().default(true),
    }),
    execute: async ({ cron, active }) => {
      try {
        logger.info(`[SCHEDULER] Scheduling agent ${agentId} with cron: ${cron}`);
        
        // Get user timezone
        const user = await User.findById(userId);
        const timezone = user?.timeZone || "UTC";
        
        // Create trigger in DB
        const trigger = await Trigger.create({
          type: "schedule",
          user: userId,
          agent: agentId,
          name: `Schedule: ${cron}`,
          active: active,
          cronExpression: cron,
        });

        // Add to BullMQ
        await addScheduleTrigger(trigger._id.toString());

        return {
          success: true,
          message: `Agent scheduled successfully with cron: ${cron} (timezone: ${timezone})`,
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
