import { Trigger } from "../models/Trigger";
import { Agent } from "../models/Agent";
import { Execution } from "../models/Execution";
import parser from "cron-parser";

export interface ScheduledRun {
  triggerId: string;
  agentId: string;
  agentName: string;
  nextRun: Date;
  cronExpression: string;
}

/**
 * Get the next scheduled runs for a user's agents
 */
export const getNextScheduledRuns = async (
  userId: string, 
  limit: number = 5
): Promise<ScheduledRun[]> => {
  
  // 1. Get all user's agents
  const agents = await Agent.find({ ownerId: userId }).lean();
  const agentMap = new Map(agents.map(a => [a._id.toString(), a.name]));
  const agentIds = agents.map(a => a._id);

  // 2. Get active schedule triggers
  const triggers = await Trigger.find({
    agentId: { $in: agentIds },
    type: 'schedule',
    enabled: true
  }).lean();

  const scheduledRuns: ScheduledRun[] = [];

  // 3. Calculate next run for each
  for (const trigger of triggers) {
    if (trigger.config?.cron) {
      try {
        const interval = parser.parseExpression(trigger.config.cron, { currentDate: new Date() });
        const nextRun = interval.next().toDate();
        
        // Skip if date is in the past (shouldn't happen with .next(), but safety first)
        if (nextRun > new Date()) {
            scheduledRuns.push({
                triggerId: trigger._id.toString(),
                agentId: trigger.agentId.toString(),
                agentName: agentMap.get(trigger.agentId.toString()) || 'Unknown Agent',
                nextRun,
                cronExpression: trigger.config.cron
            });
        }
      } catch (err) {
        console.warn(`Invalid cron expression for trigger ${trigger._id}: ${trigger.config.cron}`);
      }
    }
  }

  // 4. Sort by date and limit
  return scheduledRuns
    .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())
    .slice(0, limit);
};
