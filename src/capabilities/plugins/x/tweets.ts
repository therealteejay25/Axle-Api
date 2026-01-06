import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// X/TWITTER TWEET TOOLS
// ============================================

export class XPostTweetTool extends BaseTool {
  name = 'x_post_tweet';
  description = 'Post a tweet on X (Twitter).';
  
  inputSchema = z.object({
    text: z.string().max(280).describe('Tweet text (max 280 characters)'),
    replyToId: z.string().optional().describe('Tweet ID to reply to'),
    quoteTweetId: z.string().optional().describe('Tweet ID to quote')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_post_tweet(params, integration);
  }
}

export class XPostThreadTool extends BaseTool {
  name = 'x_post_thread';
  description = 'Post a thread of tweets on X (Twitter).';
  
  inputSchema = z.object({
    tweets: z.array(z.string().max(280)).describe('Array of tweet texts')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_post_thread(params, integration);
  }
}

export class XDeleteTweetTool extends BaseTool {
  name = 'x_delete_tweet';
  description = 'Delete a tweet.';
  
  inputSchema = z.object({
    tweetId: z.string().describe('Tweet ID to delete')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_delete_tweet(params, integration);
  }
}

export class XGetTweetTool extends BaseTool {
  name = 'x_get_tweet';
  description = 'Get details of a specific tweet.';
  
  inputSchema = z.object({
    tweetId: z.string().describe('Tweet ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_get_tweet(params, integration);
  }
}

export class XGetThreadTool extends BaseTool {
  name = 'x_get_thread';
  description = 'Get the conversation thread for a tweet.';
  
  inputSchema = z.object({
    tweetId: z.string().describe('Tweet ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_get_thread(params, integration);
  }
}

export class XSearchTweetsTool extends BaseTool {
  name = 'x_search_tweets';
  description = 'Search for tweets by query.';
  
  inputSchema = z.object({
    query: z.string().describe('Search query'),
    maxResults: z.number().optional().default(10).describe('Maximum results')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_search_tweets(params, integration);
  }
}

export class XGetTrendsTool extends BaseTool {
  name = 'x_get_trends';
  description = 'Get trending topics on X.';
  
  inputSchema = z.object({
    woeid: z.number().optional().describe('Where On Earth ID for location')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_get_trends(params, integration);
  }
}
