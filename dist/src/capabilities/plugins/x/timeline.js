"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XGetMentionsTool = exports.XGetHomeTimelineTool = exports.XGetUserTweetsTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// X/TWITTER TIMELINE TOOLS
// ============================================
class XGetUserTweetsTool extends BaseTool_1.BaseTool {
    name = 'x_get_user_tweets';
    description = 'Get tweets from a specific user.';
    inputSchema = zod_1.z.object({
        userId: zod_1.z.string().optional().describe('User ID (omit for authenticated user)'),
        maxResults: zod_1.z.number().optional().default(10).describe('Maximum results')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_get_user_tweets(params, integration);
    }
}
exports.XGetUserTweetsTool = XGetUserTweetsTool;
class XGetHomeTimelineTool extends BaseTool_1.BaseTool {
    name = 'x_get_home_timeline';
    description = 'Get the authenticated user\'s home timeline.';
    inputSchema = zod_1.z.object({
        maxResults: zod_1.z.number().optional().default(10).describe('Maximum results'),
        userId: zod_1.z.string().optional().describe('User ID (optional)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_get_home_timeline(params, integration);
    }
}
exports.XGetHomeTimelineTool = XGetHomeTimelineTool;
class XGetMentionsTool extends BaseTool_1.BaseTool {
    name = 'x_get_mentions';
    description = 'Get mentions of the authenticated user.';
    inputSchema = zod_1.z.object({
        userId: zod_1.z.string().optional().describe('User ID (omit for authenticated user)'),
        maxResults: zod_1.z.number().optional().default(10).describe('Maximum results')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_get_mentions(params, integration);
    }
}
exports.XGetMentionsTool = XGetMentionsTool;
