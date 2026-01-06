import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// X/TWITTER ENGAGEMENT TOOLS
// ============================================

export class XLikeTweetTool extends BaseTool {
  name = 'x_like_tweet';
  description = 'Like a tweet.';
  
  inputSchema = z.object({
    tweetId: z.string().describe('Tweet ID to like'),
    userId: z.string().optional().describe('User ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_like_tweet(params, integration);
  }
}

export class XUnlikeTweetTool extends BaseTool {
  name = 'x_unlike_tweet';
  description = 'Unlike a tweet.';
  
  inputSchema = z.object({
    tweetId: z.string().describe('Tweet ID to unlike'),
    userId: z.string().optional().describe('User ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_unlike_tweet(params, integration);
  }
}

export class XRetweetTool extends BaseTool {
  name = 'x_retweet';
  description = 'Retweet a tweet.';
  
  inputSchema = z.object({
    tweetId: z.string().describe('Tweet ID to retweet'),
    userId: z.string().optional().describe('User ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_retweet(params, integration);
  }
}

export class XUnretweetTool extends BaseTool {
  name = 'x_unretweet';
  description = 'Remove a retweet.';
  
  inputSchema = z.object({
    tweetId: z.string().describe('Tweet ID to unretweet'),
    userId: z.string().optional().describe('User ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_unretweet(params, integration);
  }
}

export class XBookmarkTweetTool extends BaseTool {
  name = 'x_bookmark_tweet';
  description = 'Bookmark a tweet.';
  
  inputSchema = z.object({
    tweetId: z.string().describe('Tweet ID to bookmark'),
    userId: z.string().optional().describe('User ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_bookmark_tweet(params, integration);
  }
}

export class XRemoveBookmarkTool extends BaseTool {
  name = 'x_remove_bookmark';
  description = 'Remove a bookmark from a tweet.';
  
  inputSchema = z.object({
    tweetId: z.string().describe('Tweet ID to unbookmark'),
    userId: z.string().optional().describe('User ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_remove_bookmark(params, integration);
  }
}
