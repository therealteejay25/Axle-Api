import { Agent } from "../models/Agent";
import { runAgentById } from "./agentRunner";
import { logger } from "../lib/logger";

export interface TriggerEvent {
  type: "webhook" | "integration_event" | "time" | "manual";
  source: string; // e.g., "github", "slack", "webhook"
  event: string; // e.g., "issue.created", "message.posted", "webhook.custom"
  payload: any;
  userId?: string; // Optional: if event is user-specific
}

/**
 * Match an event to agents that should be triggered.
 */
export const matchAgentsToEvent = async (
  event: TriggerEvent
): Promise<Array<{ agentId: string; ownerId: string; trigger?: any }>> => {
  try {
    const matchedAgents: Array<{ agentId: string; ownerId: string; trigger?: any }> = [];

    // Build query to find agents with matching triggers
    const query: any = {
      "triggers.enabled": true,
      $or: [],
    };

    // Match webhook triggers
    if (event.type === "webhook") {
      query.$or.push({
        "triggers.type": "webhook",
        "triggers.webhookPath": event.event, // e.g., "github", "slack"
      });
    }

    // Match integration event triggers
    if (event.type === "integration_event") {
      const eventPattern = `${event.source}.${event.event}`; // e.g., "github.issue.created"
      query.$or.push({
        "triggers.type": "integration_event",
        $or: [
          { "triggers.eventPattern": eventPattern },
          { "triggers.eventPattern": `${event.source}.*` }, // Wildcard match
          { "triggers.eventPattern": "*" }, // Match all events
        ],
      });
    }

    // If userId is provided, filter by ownerId
    if (event.userId) {
      query.ownerId = event.userId;
    }

    const agents = await Agent.find(query).lean();

    for (const agent of agents) {
      // Check if agent has matching trigger
      const matchingTrigger = (agent.triggers || []).find((trigger: any) => {
        if (!trigger.enabled) return false;

        // Check event pattern match
        let patternMatches = false;

        if (trigger.type === "webhook" && event.type === "webhook") {
          patternMatches = trigger.webhookPath === event.event;
        } else if (
          trigger.type === "integration_event" &&
          event.type === "integration_event"
        ) {
          const pattern = trigger.eventPattern;
          const eventPattern = `${event.source}.${event.event}`;
          patternMatches =
            pattern === eventPattern ||
            pattern === `${event.source}.*` ||
            pattern === "*";
        }

        if (!patternMatches) return false;

        // Evaluate conditions if they exist
        if (trigger.conditions && Object.keys(trigger.conditions).length > 0) {
          const conditionsMet = evaluateConditions(
            trigger.conditions,
            event.payload
          );
          if (!conditionsMet) {
            logger.debug(
              `Trigger conditions not met for agent ${agent._id}, trigger: ${trigger.eventPattern}`
            );
            return false;
          }
        }

        return true;
      });

      if (matchingTrigger) {
        matchedAgents.push({
          agentId: agent._id.toString(),
          ownerId: agent.ownerId,
          trigger: matchingTrigger, // Include trigger for reference
        });
      }
    }

    return matchedAgents;
  } catch (err) {
    logger.error("Error matching agents to event", err);
    return [];
  }
};

/**
 * Trigger agents based on an event.
 */
export const triggerAgentsForEvent = async (
  event: TriggerEvent
): Promise<Array<{ agentId: string; success: boolean; error?: string }>> => {
  const matchedAgents = await matchAgentsToEvent(event);
  const results: Array<{
    agentId: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const { agentId, ownerId } of matchedAgents) {
    try {
      // Build input message describing the event
      const input = `Event triggered: ${event.type} from ${event.source} - ${event.event}. Payload: ${JSON.stringify(event.payload).slice(0, 500)}`;

      await runAgentById(ownerId, agentId, input);
      results.push({ agentId, success: true });
      logger.info(
        `Triggered agent ${agentId} for event ${event.source}.${event.event}`
      );
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      results.push({ agentId, success: false, error: errorMsg });
      logger.error(
        `Failed to trigger agent ${agentId} for event ${event.source}.${event.event}`,
        err
      );
    }
  }

  return results;
};

/**
 * Evaluate trigger conditions against event payload.
 * Supports MongoDB-style query operators: $gt, $gte, $lt, $lte, $eq, $ne, $in, $nin
 * Also supports simple equality checks and nested property access.
 */
export const evaluateConditions = (
  conditions: any,
  payload: any
): boolean => {
  if (!conditions || typeof conditions !== "object") return true;

  try {
    for (const [key, value] of Object.entries(conditions)) {
      // Handle MongoDB-style operators
      if (key.startsWith("$")) {
        // Top-level operator (e.g., $and, $or)
        if (key === "$and" && Array.isArray(value)) {
          return value.every((cond) => evaluateConditions(cond, payload));
        }
        if (key === "$or" && Array.isArray(value)) {
          return value.some((cond) => evaluateConditions(cond, payload));
        }
        continue;
      }

      // Get value from payload (supports nested paths like "channel.name")
      const payloadValue = getNestedValue(payload, key);

      // If value is an object with operators
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const operators = Object.keys(value);
        for (const op of operators) {
          const opValue = value[op];
          let result = false;

          switch (op) {
            case "$gt":
              result = Number(payloadValue) > Number(opValue);
              break;
            case "$gte":
              result = Number(payloadValue) >= Number(opValue);
              break;
            case "$lt":
              result = Number(payloadValue) < Number(opValue);
              break;
            case "$lte":
              result = Number(payloadValue) <= Number(opValue);
              break;
            case "$eq":
              result = payloadValue === opValue;
              break;
            case "$ne":
              result = payloadValue !== opValue;
              break;
            case "$in":
              result = Array.isArray(opValue) && opValue.includes(payloadValue);
              break;
            case "$nin":
              result = Array.isArray(opValue) && !opValue.includes(payloadValue);
              break;
            case "$contains":
              result =
                typeof payloadValue === "string" &&
                payloadValue.includes(String(opValue));
              break;
            case "$regex":
              try {
                const regex = new RegExp(opValue);
                result = regex.test(String(payloadValue));
              } catch {
                result = false;
              }
              break;
            default:
              // Unknown operator, skip
              continue;
          }

          if (!result) return false;
        }
      } else {
        // Simple equality check
        if (payloadValue !== value) {
          return false;
        }
      }
    }

    return true;
  } catch (err) {
    logger.error("Error evaluating conditions", err);
    // On error, default to false (don't trigger)
    return false;
  }
};

/**
 * Get nested value from object using dot notation (e.g., "channel.name")
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

export default { matchAgentsToEvent, triggerAgentsForEvent, evaluateConditions };

