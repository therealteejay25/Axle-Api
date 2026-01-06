import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// X/TWITTER TIMELINE TOOLS
// ============================================

export class XGetUserTweetsTool extends BaseTool {
  name = 'x_get_user_tweets';
  description = 'Get tweets from a specific user.';
  
  inputSchema = z.object({
    userId: z.string().optional().describe('User ID (omit for authenticated user)'),
    maxResults: z.number().optional().default(10).describe('Maximum results')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_get_user_tweets(params, integration);
  }
}

export class XGetHomeTimelineTool extends BaseTool {
  name = 'x_get_home_timeline';
  description = 'Get the authenticated user\'s home timeline.';
  
  inputSchema = z.object({
    maxResults: z.number().optional().default(10).describe('Maximum results'),
    userId: z.string().optional().describe('User ID (optional)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_get_home_timeline(params, integration);
  }
}

export class XGetMentionsTool extends BaseTool {
  name = 'x_get_mentions';
  description = 'Get mentions of the authenticated user.';
  
  inputSchema = z.object({
    userId: z.string().optional().describe('User ID (omit for authenticated user)'),
    maxResults: z.number().optional().default(10).describe('Maximum results')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_get_mentions(params, integration);
  }
}
