"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyActions = void 0;
const types_1 = require("./types");
// ============================================
// NOTIFY CAPABILITY
// ============================================
// Alert people or systems
// ============================================
exports.notifyActions = {
    // ==================== NOTIFY TEAM ====================
    notify_team: {
        actionId: 'notify_team',
        capability: types_1.Capability.NOTIFY,
        intent: 'Send a message to a team channel',
        description: 'Broadcast a notification to a team channel in Slack',
        whenToUse: 'When you need to notify a team, share information, or communicate in Slack',
        inputSchema: {
            channel: {
                type: 'string',
                description: 'Channel name or ID',
                required: true
            },
            message: {
                type: 'string',
                description: 'Notification message',
                required: true,
                validation: { min: 1, max: 4000 }
            },
            urgent: {
                type: 'boolean',
                description: 'Whether this is urgent (adds @channel)',
                required: false,
                default: false
            },
            thread: {
                type: 'string',
                description: 'Reply to specific thread',
                required: false
            }
        },
        outputSchema: {
            sent: 'boolean',
            messageId: 'string',
            channel: 'string'
        },
        constraints: {
            readOnly: false,
            safetyLevel: types_1.SafetyLevel.CAUTIOUS,
            rateLimit: {
                maxPerHour: 30,
                maxPerDay: 150
            }
        },
        verification: {
            method: 'check_status'
        },
        metadata: {
            estimatedDuration: 'instant',
            costLevel: 'free',
            requiresIntegration: ['slack']
        },
        executor: async (inputs, context) => {
            const { slackActions } = require('../adapters/slack');
            const integration = context.integrations.get('slack');
            if (!integration) {
                throw new Error('Slack integration not connected');
            }
            let message = inputs.message;
            if (inputs.urgent) {
                message = `<!channel> ${message}`;
            }
            const result = await slackActions.slack_send_message({
                channel: inputs.channel,
                text: message,
                threadTs: inputs.thread
            }, integration);
            return {
                sent: result.ok === true,
                messageId: result.ts || '',
                channel: inputs.channel
            };
        }
    },
    // ==================== NOTIFY STATUS ====================
    notify_status: {
        actionId: 'notify_status',
        capability: types_1.Capability.NOTIFY,
        intent: 'Update status with a reaction or emoji',
        description: 'Add an emoji reaction to show status or acknowledgment',
        whenToUse: 'When you need to acknowledge a message or show status without sending text',
        inputSchema: {
            target: {
                type: 'string',
                description: 'Message to react to (channel:timestamp)',
                required: true
            },
            emoji: {
                type: 'string',
                description: 'Emoji name (without colons)',
                required: true
            }
        },
        outputSchema: {
            added: 'boolean',
            emoji: 'string'
        },
        constraints: {
            readOnly: false,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: {
                maxPerHour: 50,
                maxPerDay: 200
            }
        },
        metadata: {
            estimatedDuration: 'instant',
            costLevel: 'free',
            requiresIntegration: ['slack']
        },
        executor: async (inputs, context) => {
            const { slackActions } = require('../adapters/slack');
            const integration = context.integrations.get('slack');
            if (!integration) {
                throw new Error('Slack integration not connected');
            }
            const [channel, timestamp] = inputs.target.split(':');
            const result = await slackActions.slack_add_reaction({
                channel,
                timestamp,
                emoji: inputs.emoji
            }, integration);
            return {
                added: result.ok === true,
                emoji: inputs.emoji
            };
        }
    }
};
exports.default = exports.notifyActions;
