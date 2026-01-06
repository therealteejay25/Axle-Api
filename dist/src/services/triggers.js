"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextScheduledRuns = void 0;
const Trigger_1 = require("../models/Trigger");
const Agent_1 = require("../models/Agent");
const cron_parser_1 = __importDefault(require("cron-parser"));
/**
 * Get the next scheduled runs for a user's agents
 */
const getNextScheduledRuns = async (userId, limit = 5) => {
    // 1. Get all user's agents
    const agents = await Agent_1.Agent.find({ ownerId: userId }).lean();
    const agentMap = new Map(agents.map(a => [a._id.toString(), a.name]));
    const agentIds = agents.map(a => a._id);
    // 2. Get active schedule triggers
    const triggers = await Trigger_1.Trigger.find({
        agentId: { $in: agentIds },
        type: 'schedule',
        enabled: true
    }).lean();
    const scheduledRuns = [];
    // 3. Calculate next run for each
    for (const trigger of triggers) {
        if (trigger.config?.cron) {
            try {
                const interval = cron_parser_1.default.parseExpression(trigger.config.cron, { currentDate: new Date() });
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
            }
            catch (err) {
                console.warn(`Invalid cron expression for trigger ${trigger._id}: ${trigger.config.cron}`);
            }
        }
    }
    // 4. Sort by date and limit
    return scheduledRuns
        .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())
        .slice(0, limit);
};
exports.getNextScheduledRuns = getNextScheduledRuns;
