import { Agent } from "../models/Agent";
import { runAgentById } from "./agentRunner";
import { logger } from "../lib/logger";
import { Integration } from "../models/Integration";
import { decrypt } from "../lib/crypto";
import { evaluateConditions } from "./triggerService";
import axios from "axios";

/**
 * Polling service for continuous monitoring.
 * Checks for new messages/events and triggers agents when conditions are met.
 */

interface PollingJob {
  agentId: string;
  ownerId: string;
  source: string; // "slack", "github", etc.
  config: {
    channel?: string;
    intervalMinutes: number;
    lastChecked?: Date;
  };
}

/**
 * Poll Slack channel for new messages and check if conditions are met.
 */
export const pollSlackChannel = async (
  accessToken: string,
  channel: string,
  since?: Date
): Promise<{
  messages: any[];
  hasNewMessages: boolean;
  unansweredCount?: number;
}> => {
  try {
    const params: any = {
      channel,
      limit: 100,
    };

    if (since) {
      params.oldest = Math.floor(since.getTime() / 1000).toString();
    }

    const res = await axios.get("https://slack.com/api/conversations.history", {
      params,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.data || res.data.ok === false) {
      throw new Error(`Slack API error: ${res.data?.error}`);
    }

    const messages = res.data.messages || [];
    const now = Date.now();

    // Filter messages from last 10 minutes
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const recentMessages = messages.filter((msg: any) => {
      const msgTime = parseFloat(msg.ts) * 1000;
      return msgTime >= tenMinutesAgo;
    });

    // Count unanswered messages (messages without thread replies)
    const unansweredMessages = recentMessages.filter((msg: any) => {
      // If message has thread_ts, it's a reply (skip)
      if (msg.thread_ts) return false;
      // If message has replies, it's answered
      if (msg.reply_count && msg.reply_count > 0) return false;
      // Check if there are thread replies
      return true; // For now, assume unanswered if no reply_count
    });

    return {
      messages: recentMessages,
      hasNewMessages: recentMessages.length > 0,
      unansweredCount: unansweredMessages.length,
    };
  } catch (err: any) {
    logger.error("Error polling Slack channel", err);
    throw err;
  }
};

/**
 * Execute polling job for an agent.
 */
export const executePollingJob = async (job: PollingJob): Promise<void> => {
  try {
    const agent = await Agent.findById(job.agentId);
    if (!agent || !agent.triggers || agent.triggers.length === 0) {
      logger.warn(`Agent ${job.agentId} has no triggers configured`);
      return;
    }

    // Get integration for the source
    const integration = await Integration.findOne({
      userId: job.ownerId,
      name: job.source,
    }).lean();

    if (!integration || !integration.accessToken) {
      logger.warn(
        `No ${job.source} integration found for user ${job.ownerId}`
      );
      return;
    }

    const accessToken = decrypt(integration.accessToken);

    // Poll based on source
    if (job.source === "slack" && job.config.channel) {
      const lastChecked = job.config.lastChecked || new Date(Date.now() - 10 * 60 * 1000);
      const result = await pollSlackChannel(
        accessToken,
        job.config.channel,
        lastChecked
      );

      // Check if conditions are met
      const trigger = agent.triggers.find(
        (t: any) => t.type === "integration_event" && t.enabled
      );

      if (trigger && trigger.conditions) {
        // Evaluate conditions using triggerService
        const conditionsMet = evaluateConditions(trigger.conditions, result);

        if (conditionsMet) {
          // Trigger agent
          const input = `Polling detected condition met: ${JSON.stringify(result)}. Channel: ${job.config.channel}`;
          await runAgentById(job.ownerId, job.agentId, input);

          // Update last checked time
          // Note: This would need to be stored somewhere (agent metadata or separate collection)
          logger.info(
            `Triggered agent ${job.agentId} due to polling condition met`
          );
        }
      } else if (result.hasNewMessages) {
        // No conditions, just trigger on new messages
        const input = `New messages detected in ${job.config.channel}: ${result.messages.length} messages`;
        await runAgentById(job.ownerId, job.agentId, input);
      }
    }
  } catch (err) {
    logger.error(`Error executing polling job for agent ${job.agentId}`, err);
    throw err;
  }
};


/**
 * Find agents that need polling and create polling jobs.
 */
export const findPollingAgents = async (): Promise<PollingJob[]> => {
  try {
    const agents = await Agent.find({
      "triggers.enabled": true,
      "triggers.type": "integration_event",
    }).lean();

    const jobs: PollingJob[] = [];

    for (const agent of agents) {
      const pollingTriggers = (agent.triggers || []).filter(
        (t: any) =>
          t.type === "integration_event" &&
          t.enabled &&
          (t.eventPattern?.startsWith("slack.") ||
            t.eventPattern === "slack.*" ||
            t.eventPattern === "*")
      );

      for (const trigger of pollingTriggers) {
        // Extract channel from conditions or use default
        const channel =
          trigger.conditions?.channel || trigger.conditions?.channelId;

        if (channel) {
          jobs.push({
            agentId: agent._id.toString(),
            ownerId: agent.ownerId,
            source: "slack",
            config: {
              channel,
              intervalMinutes: 10, // Default polling interval
            },
          });
        }
      }
    }

    return jobs;
  } catch (err) {
    logger.error("Error finding polling agents", err);
    return [];
  }
};

export default {
  pollSlackChannel,
  executePollingJob,
  findPollingAgents,
};

