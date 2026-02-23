import { Types } from "mongoose";
import { Agent } from "../models/Agent";
import { Trigger, ITrigger, TriggerType } from "../models/Trigger";
import { enqueueExecution } from "../queue/executionQueue";
import { Execution } from "../models/Execution";
import { logger } from "./logger";
import { addScheduleTrigger, removeScheduleTrigger } from "../triggers/scheduleHandler";
import cronParser from "cron-parser";

/**
 * TriggerService manages scheduled and webhook-based agent executions
 * This is what actually makes your triggers work
 */
class TriggerServiceClass {
  private initialized = false;

  /**
   * Initialize the trigger system - call this on server startup
   */
  async initialize() {
    if (this.initialized) return;

    logger.info("Initializing TriggerService...");
    this.initialized = true;
    logger.info("TriggerService initialized (using existing scheduleHandler for scheduling)");
  }

  /**
   * Create a new scheduled trigger
   */
  async createScheduledTrigger(params: {
    agentId: string;
    userId: string;
    schedule: string; // cron expression or natural language
    task: string;
    active?: boolean;
    name?: string;
  }) {
    // Parse natural language to cron if needed
    const cronExpression = this.parseToCron(params.schedule);

    // Validate cron expression
    try {
      cronParser.parseExpression(cronExpression);
    } catch (error) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const trigger = await Trigger.create({
      user: new Types.ObjectId(params.userId),
      agent: new Types.ObjectId(params.agentId),
      type: "schedule",
      name: params.name || `Schedule: ${params.schedule}`,
      active: params.active !== false,
      cronExpression,
      lastFiredAt: undefined,
    });

    // Register with BullMQ scheduler
    if (trigger.active) {
      try {
        await addScheduleTrigger(trigger._id.toString());
      } catch (error) {
        logger.error(`Failed to add schedule trigger ${trigger._id}:`, error);
        // Continue anyway - the trigger is saved in DB
      }
    }

    return trigger;
  }

  /**
   * Parse natural language schedule to cron expression
   */
  private parseToCron(schedule: string): string {
    // If it's already a cron expression, validate and return it
    try {
      cronParser.parseExpression(schedule);
      return schedule;
    } catch {
      // Not a cron expression, try to parse natural language
    }

    const s = schedule.toLowerCase().trim();

    // Every X hours
    const hoursMatch = s.match(/every (\d+) hours?/);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1]);
      if (hours > 0 && hours <= 24) {
        return `0 */${hours} * * *`;
      }
    }

    // Every X minutes
    const minutesMatch = s.match(/every (\d+) minutes?/);
    if (minutesMatch) {
      const minutes = parseInt(minutesMatch[1]);
      if (minutes > 0 && minutes < 60) {
        return `*/${minutes} * * * *`;
      }
    }

    // Daily at specific time
    const dailyMatch = s.match(/daily at (\d+)(am|pm)/);
    if (dailyMatch) {
      let hour = parseInt(dailyMatch[1]);
      const period = dailyMatch[2];
      if (period === "pm" && hour !== 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;
      if (hour >= 0 && hour < 24) {
        return `0 ${hour} * * *`;
      }
    }

    // Every weekday at time
    const weekdayMatch = s.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday) at (\d+)(am|pm)/);
    if (weekdayMatch) {
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      const day = weekdayMatch[1];
      let hour = parseInt(weekdayMatch[2]);
      const period = weekdayMatch[3];
      if (period === "pm" && hour !== 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;
      const dayNum = dayMap[day];
      if (dayNum !== undefined && hour >= 0 && hour < 24) {
        return `0 ${hour} * * ${dayNum}`;
      }
    }

    // Every Monday, Tuesday, etc. (default to 9am)
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    for (const [day, num] of Object.entries(dayMap)) {
      if (s.includes(day) && s.includes("every")) {
        // Extract time if present
        const timeMatch = s.match(/(\d+)(am|pm)/);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1]);
          const period = timeMatch[2];
          if (period === "pm" && hour !== 12) hour += 12;
          if (period === "am" && hour === 12) hour = 0;
          if (hour >= 0 && hour < 24) {
            return `0 ${hour} * * ${num}`;
          }
        }
        // Default to 9am
        return `0 9 * * ${num}`;
      }
    }

    // Couldn't parse - throw error instead of using default
    throw new Error(`Could not parse schedule: "${schedule}". Please use cron syntax (e.g., '0 9 * * *') or natural language (e.g., 'daily at 9am', 'every Monday at 10am').`);
  }

  /**
   * Cancel a scheduled trigger
   */
  async cancelTrigger(triggerId: string) {
    // Remove from BullMQ scheduler
    try {
      await removeScheduleTrigger(triggerId);
    } catch (error) {
      logger.warn(`Failed to remove schedule trigger ${triggerId}:`, error);
    }

    // Update database
    await Trigger.findByIdAndUpdate(triggerId, {
      active: false,
    });
  }

  /**
   * Handle webhook trigger
   */
  async handleWebhook(params: {
    agentId: string;
    userId: string;
    source: string;
    payload: any;
    webhookToken?: string;
  }) {
    logger.info(`Handling webhook for agent ${params.agentId} from ${params.source}`);

    // Find or create webhook trigger
    let trigger = await Trigger.findOne({
      agent: new Types.ObjectId(params.agentId),
      type: "webhook",
      webhookToken: params.webhookToken,
    });

    if (!trigger) {
      trigger = await Trigger.create({
        user: new Types.ObjectId(params.userId),
        agent: new Types.ObjectId(params.agentId),
        type: "webhook",
        name: `Webhook: ${params.source}`,
        active: true,
        webhookToken: params.webhookToken,
      });
    }

    // Verify agent is active
    const agent = await Agent.findById(params.agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${params.agentId}`);
    }

    if ((agent as any).status !== "active") {
      logger.debug(`Skipping webhook for inactive agent ${params.agentId}`);
      return trigger;
    }

    // Create execution record
    const execution = await Execution.create({
      agentId: new Types.ObjectId(params.agentId),
      triggerId: trigger._id,
      triggerType: "webhook",
      status: "pending",
      inputPayload: {
        webhookSource: params.source,
        webhookPayload: params.payload,
        task: `Process ${params.source} webhook event`,
        triggeredAt: new Date().toISOString(),
      },
    });

    // Queue execution
    await enqueueExecution({
      executionId: execution._id.toString(),
      agentId: params.agentId,
      ownerId: params.userId,
      triggerId: trigger._id.toString(),
      triggerType: "webhook",
      payload: {
        webhookSource: params.source,
        webhookPayload: params.payload,
        task: `Process ${params.source} webhook event`,
        triggeredAt: new Date().toISOString(),
      },
    });

    // Update trigger stats
    trigger.lastFiredAt = new Date();
    await trigger.save();

    logger.info(`Webhook trigger fired`, {
      triggerId: trigger._id.toString(),
      agentId: params.agentId,
      executionId: execution._id.toString(),
    });

    return trigger;
  }
}

export const TriggerService = new TriggerServiceClass();
