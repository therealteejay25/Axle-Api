"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XGetTrendsTool = exports.XSearchTweetsTool = exports.XGetThreadTool = exports.XGetTweetTool = exports.XDeleteTweetTool = exports.XPostThreadTool = exports.XPostTweetTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// X/TWITTER TWEET TOOLS
// ============================================
class XPostTweetTool extends BaseTool_1.BaseTool {
    name = 'x_post_tweet';
    description = 'Post a tweet on X (Twitter).';
    inputSchema = zod_1.z.object({
        text: zod_1.z.string().max(280).describe('Tweet text (max 280 characters)'),
        replyToId: zod_1.z.string().optional().describe('Tweet ID to reply to'),
        quoteTweetId: zod_1.z.string().optional().describe('Tweet ID to quote')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_post_tweet(params, integration);
    }
}
exports.XPostTweetTool = XPostTweetTool;
class XPostThreadTool extends BaseTool_1.BaseTool {
    name = 'x_post_thread';
    description = 'Post a thread of tweets on X (Twitter).';
    inputSchema = zod_1.z.object({
        tweets: zod_1.z.array(zod_1.z.string().max(280)).describe('Array of tweet texts')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_post_thread(params, integration);
    }
}
exports.XPostThreadTool = XPostThreadTool;
class XDeleteTweetTool extends BaseTool_1.BaseTool {
    name = 'x_delete_tweet';
    description = 'Delete a tweet.';
    inputSchema = zod_1.z.object({
        tweetId: zod_1.z.string().describe('Tweet ID to delete')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_delete_tweet(params, integration);
    }
}
exports.XDeleteTweetTool = XDeleteTweetTool;
class XGetTweetTool extends BaseTool_1.BaseTool {
    name = 'x_get_tweet';
    description = 'Get details of a specific tweet.';
    inputSchema = zod_1.z.object({
        tweetId: zod_1.z.string().describe('Tweet ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_get_tweet(params, integration);
    }
}
exports.XGetTweetTool = XGetTweetTool;
class XGetThreadTool extends BaseTool_1.BaseTool {
    name = 'x_get_thread';
    description = 'Get the conversation thread for a tweet.';
    inputSchema = zod_1.z.object({
        tweetId: zod_1.z.string().describe('Tweet ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_get_thread(params, integration);
    }
}
exports.XGetThreadTool = XGetThreadTool;
class XSearchTweetsTool extends BaseTool_1.BaseTool {
    name = 'x_search_tweets';
    description = 'Search for tweets by query.';
    inputSchema = zod_1.z.object({
        query: zod_1.z.string().describe('Search query'),
        maxResults: zod_1.z.number().optional().default(10).describe('Maximum results')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_search_tweets(params, integration);
    }
}
exports.XSearchTweetsTool = XSearchTweetsTool;
class XGetTrendsTool extends BaseTool_1.BaseTool {
    name = 'x_get_trends';
    description = 'Get trending topics on X.';
    inputSchema = zod_1.z.object({
        woeid: zod_1.z.number().optional().describe('Where On Earth ID for location')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_get_trends(params, integration);
    }
}
exports.XGetTrendsTool = XGetTrendsTool;
