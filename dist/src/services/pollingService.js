"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findPollingAgents = exports.executePollingJob = exports.pollSlackChannel = void 0;
const Agent_1 = require("../models/Agent");
const agentRunner_1 = require("./agentRunner");
const logger_1 = require("../lib/logger");
const Integration_1 = require("../models/Integration");
const crypto_1 = require("../lib/crypto");
const triggerService_1 = require("./triggerService");
const axios_1 = __importDefault(require("axios"));
/**
 * Poll Slack channel for new messages and check if conditions are met.
 */
const pollSlackChannel = async (accessToken, channel, since) => {
    try {
        const params = {
            channel,
            limit: 100,
        };
        if (since) {
            params.oldest = Math.floor(since.getTime() / 1000).toString();
        }
        const res = await axios_1.default.get("https://slack.com/api/conversations.history", {
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
        const recentMessages = messages.filter((msg) => {
            const msgTime = parseFloat(msg.ts) * 1000;
            return msgTime >= tenMinutesAgo;
        });
        // Count unanswered messages (messages without thread replies)
        const unansweredMessages = recentMessages.filter((msg) => {
            // If message has thread_ts, it's a reply (skip)
            if (msg.thread_ts)
                return false;
            // If message has replies, it's answered
            if (msg.reply_count && msg.reply_count > 0)
                return false;
            // Check if there are thread replies
            return true; // For now, assume unanswered if no reply_count
        });
        return {
            messages: recentMessages,
            hasNewMessages: recentMessages.length > 0,
            unansweredCount: unansweredMessages.length,
        };
    }
    catch (err) {
        logger_1.logger.error("Error polling Slack channel", err);
        throw err;
    }
};
exports.pollSlackChannel = pollSlackChannel;
/**
 * Execute polling job for an agent.
 */
const executePollingJob = async (job) => {
    try {
        const agent = await Agent_1.Agent.findById(job.agentId);
        if (!agent || !agent.triggers || agent.triggers.length === 0) {
            logger_1.logger.warn(`Agent ${job.agentId} has no triggers configured`);
            return;
        }
        // Get integration for the source
        const integration = await Integration_1.Integration.findOne({
            userId: job.ownerId,
            name: job.source,
        }).lean();
        if (!integration || !integration.accessToken) {
            logger_1.logger.warn(`No ${job.source} integration found for user ${job.ownerId}`);
            return;
        }
        const accessToken = (0, crypto_1.decrypt)(integration.accessToken);
        // Poll based on source
        if (job.source === "slack" && job.config.channel) {
            const lastChecked = job.config.lastChecked || new Date(Date.now() - 10 * 60 * 1000);
            const result = await (0, exports.pollSlackChannel)(accessToken, job.config.channel, lastChecked);
            // Check if conditions are met
            const trigger = agent.triggers.find((t) => t.type === "integration_event" && t.enabled);
            if (trigger && trigger.conditions) {
                // Evaluate conditions using triggerService
                const conditionsMet = (0, triggerService_1.evaluateConditions)(trigger.conditions, result);
                if (conditionsMet) {
                    // Trigger agent
                    const input = `Polling detected condition met: ${JSON.stringify(result)}. Channel: ${job.config.channel}`;
                    await (0, agentRunner_1.runAgentById)(job.ownerId, job.agentId, input);
                    // Update last checked time
                    // Note: This would need to be stored somewhere (agent metadata or separate collection)
                    logger_1.logger.info(`Triggered agent ${job.agentId} due to polling condition met`);
                }
            }
            else if (result.hasNewMessages) {
                // No conditions, just trigger on new messages
                const input = `New messages detected in ${job.config.channel}: ${result.messages.length} messages`;
                await (0, agentRunner_1.runAgentById)(job.ownerId, job.agentId, input);
            }
        }
    }
    catch (err) {
        logger_1.logger.error(`Error executing polling job for agent ${job.agentId}`, err);
        throw err;
    }
};
exports.executePollingJob = executePollingJob;
/**
 * Find agents that need polling and create polling jobs.
 */
const findPollingAgents = async () => {
    try {
        const agents = await Agent_1.Agent.find({
            "triggers.enabled": true,
            "triggers.type": "integration_event",
        }).lean();
        const jobs = [];
        for (const agent of agents) {
            const pollingTriggers = (agent.triggers || []).filter((t) => t.type === "integration_event" &&
                t.enabled &&
                (t.eventPattern?.startsWith("slack.") ||
                    t.eventPattern === "slack.*" ||
                    t.eventPattern === "*"));
            for (const trigger of pollingTriggers) {
                // Extract channel from conditions or use default
                const channel = trigger.conditions?.channel || trigger.conditions?.channelId;
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
    }
    catch (err) {
        logger_1.logger.error("Error finding polling agents", err);
        return [];
    }
};
exports.findPollingAgents = findPollingAgents;
exports.default = {
    pollSlackChannel: exports.pollSlackChannel,
    executePollingJob: exports.executePollingJob,
    findPollingAgents: exports.findPollingAgents,
};
