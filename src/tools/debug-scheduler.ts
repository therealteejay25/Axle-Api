import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { Trigger } from "../models/Trigger";
import { Agent } from "../models/Agent";
import { redis } from "../lib/redis";
import { Queue } from "bullmq";
import { logger } from "../services/logger";

export const createSchedulerDebugTool = (userId: string) => {
  return new FunctionTool({
    name: "debug_scheduler",
    description: "Debug the scheduler system to check why schedules might not be working",
    parameters: z.object({
      checkType: z.enum(["overview", "triggers", "redis", "jobs"]).default("overview")
        .describe("Type of check to perform: overview, triggers, redis, or jobs")
    }),
    execute: async (params) => {
      try {
        const results: any = {
          timestamp: new Date().toISOString(),
          checkType: params.checkType
        };

        if (params.checkType === "overview" || params.checkType === "triggers") {
          // Check database triggers
          const totalTriggers = await Trigger.countDocuments({ type: "schedule" });
          const enabledTriggers = await Trigger.countDocuments({ 
            type: "schedule", 
            enabled: true 
          });
          
          const userTriggers = await Trigger.find({ type: "schedule" })
            .populate("agentId", "name status ownerId")
            .lean();
          
          const userScheduleTriggers = userTriggers.filter(
            (t: any) => t.agentId?.ownerId?.toString() === userId
          );

          results.database = {
            totalScheduleTriggers: totalTriggers,
            enabledScheduleTriggers: enabledTriggers,
            userScheduleTriggers: userScheduleTriggers.length,
            userTriggerDetails: userScheduleTriggers.map((t: any) => ({
              id: t._id,
              agentName: t.agentId?.name,
              agentStatus: t.agentId?.status,
              enabled: t.enabled,
              cron: t.config?.cron,
              timezone: t.config?.timezone || "UTC",
              lastTriggered: t.lastTriggeredAt
            }))
          };
        }

        if (params.checkType === "overview" || params.checkType === "redis") {
          // Check Redis connection
          try {
            const pingResult = await redis.ping();
            results.redis = {
              connected: pingResult === "PONG",
              status: "healthy"
            };
          } catch (error: any) {
            results.redis = {
              connected: false,
              status: "error",
              error: error.message
            };
          }
        }

        if (params.checkType === "overview" || params.checkType === "jobs") {
          // Check BullMQ scheduler queue
          try {
            const schedulerQueue = new Queue("scheduler-queue", { connection: redis });
            
            const repeatableJobs = await schedulerQueue.getRepeatableJobs();
            const failedJobs = await schedulerQueue.getFailed();
            const waitingJobs = await schedulerQueue.getWaiting();
            const activeJobs = await schedulerQueue.getActive();

            results.bullmq = {
              repeatableJobs: repeatableJobs.length,
              failedJobs: failedJobs.length,
              waitingJobs: waitingJobs.length,
              activeJobs: activeJobs.length,
              jobDetails: repeatableJobs.slice(0, 5).map(job => ({
                id: job.id,
                cron: job.cron,
                nextRun: new Date(job.next).toISOString(),
                timezone: job.tz
              })),
              recentFailures: failedJobs.slice(0, 3).map(job => ({
                id: job.id,
                reason: job.failedReason,
                data: job.data
              }))
            };

            await schedulerQueue.close();
          } catch (error: any) {
            results.bullmq = {
              error: error.message,
              status: "failed"
            };
          }
        }

        // Add recommendations
        results.recommendations = [];
        
        if (results.redis && !results.redis.connected) {
          results.recommendations.push("Redis is not connected. Check Redis server status and connection string.");
        }
        
        if (results.database && results.database.userScheduleTriggers === 0) {
          results.recommendations.push("No schedule triggers found for your agents. Create a schedule trigger first.");
        }
        
        if (results.database && results.database.userTriggerDetails) {
          const inactiveAgents = results.database.userTriggerDetails.filter(
            (t: any) => t.agentStatus !== "active"
          );
          if (inactiveAgents.length > 0) {
            results.recommendations.push(`${inactiveAgents.length} schedule(s) have inactive agents. Only active agents can be scheduled.`);
          }
          
          const disabledTriggers = results.database.userTriggerDetails.filter(
            (t: any) => !t.enabled
          );
          if (disabledTriggers.length > 0) {
            results.recommendations.push(`${disabledTriggers.length} schedule trigger(s) are disabled.`);
          }
        }
        
        if (results.bullmq && results.bullmq.failedJobs > 0) {
          results.recommendations.push(`${results.bullmq.failedJobs} scheduler jobs have failed. Check the failure reasons.`);
        }

        logger.info("Scheduler debug completed", { userId, results });

        return {
          success: true,
          results,
          summary: `Scheduler Debug Complete:
- Database: ${results.database?.userScheduleTriggers || 0} user schedule triggers
- Redis: ${results.redis?.connected ? 'Connected' : 'Disconnected'}
- BullMQ: ${results.bullmq?.repeatableJobs || 0} repeatable jobs
- Recommendations: ${results.recommendations.length} issues found`
        };

      } catch (error: any) {
        logger.error("Scheduler debug failed", { userId, error: error.message });
        return {
          success: false,
          error: error.message
        };
      }
    }
  });
};