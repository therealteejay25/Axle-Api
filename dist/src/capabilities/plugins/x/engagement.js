"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XRemoveBookmarkTool = exports.XBookmarkTweetTool = exports.XUnretweetTool = exports.XRetweetTool = exports.XUnlikeTweetTool = exports.XLikeTweetTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// X/TWITTER ENGAGEMENT TOOLS
// ============================================
class XLikeTweetTool extends BaseTool_1.BaseTool {
    name = 'x_like_tweet';
    description = 'Like a tweet.';
    inputSchema = zod_1.z.object({
        tweetId: zod_1.z.string().describe('Tweet ID to like'),
        userId: zod_1.z.string().optional().describe('User ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_like_tweet(params, integration);
    }
}
exports.XLikeTweetTool = XLikeTweetTool;
class XUnlikeTweetTool extends BaseTool_1.BaseTool {
    name = 'x_unlike_tweet';
    description = 'Unlike a tweet.';
    inputSchema = zod_1.z.object({
        tweetId: zod_1.z.string().describe('Tweet ID to unlike'),
        userId: zod_1.z.string().optional().describe('User ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_unlike_tweet(params, integration);
    }
}
exports.XUnlikeTweetTool = XUnlikeTweetTool;
class XRetweetTool extends BaseTool_1.BaseTool {
    name = 'x_retweet';
    description = 'Retweet a tweet.';
    inputSchema = zod_1.z.object({
        tweetId: zod_1.z.string().describe('Tweet ID to retweet'),
        userId: zod_1.z.string().optional().describe('User ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_retweet(params, integration);
    }
}
exports.XRetweetTool = XRetweetTool;
class XUnretweetTool extends BaseTool_1.BaseTool {
    name = 'x_unretweet';
    description = 'Remove a retweet.';
    inputSchema = zod_1.z.object({
        tweetId: zod_1.z.string().describe('Tweet ID to unretweet'),
        userId: zod_1.z.string().optional().describe('User ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_unretweet(params, integration);
    }
}
exports.XUnretweetTool = XUnretweetTool;
class XBookmarkTweetTool extends BaseTool_1.BaseTool {
    name = 'x_bookmark_tweet';
    description = 'Bookmark a tweet.';
    inputSchema = zod_1.z.object({
        tweetId: zod_1.z.string().describe('Tweet ID to bookmark'),
        userId: zod_1.z.string().optional().describe('User ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_bookmark_tweet(params, integration);
    }
}
exports.XBookmarkTweetTool = XBookmarkTweetTool;
class XRemoveBookmarkTool extends BaseTool_1.BaseTool {
    name = 'x_remove_bookmark';
    description = 'Remove a bookmark from a tweet.';
    inputSchema = zod_1.z.object({
        tweetId: zod_1.z.string().describe('Tweet ID to unbookmark'),
        userId: zod_1.z.string().optional().describe('User ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_remove_bookmark(params, integration);
    }
}
exports.XRemoveBookmarkTool = XRemoveBookmarkTool;
