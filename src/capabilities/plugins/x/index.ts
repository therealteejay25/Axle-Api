import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';
import { refreshXToken } from '../../../services/XTokenService';
import { logger } from '../../../services/logger';

// Helper to handle X token refresh
async function withXRetry(
    operation: () => Promise<any>, 
    context: ToolContext
) {
    try {
        return await operation();
    } catch (error: any) {
        // If 401, refresh token and retry
        if (error.response?.status === 401 || error.code === 401 || error.statusCode === 401) {
            logger.warn("X Tool encountered 401, refreshing token...");
            
            const integration = context.integrations.get('twitter');
            if (integration && integration._id) {
                const newToken = await refreshXToken(integration._id.toString());
                
                // Update the integration object in memory so the retry uses the new token
                // NOTE: The adapter likely reads from this integration object reference
                // or we need to update the object the adapter behaves on.
                // Assuming 'integration' is mutable or adapter re-reads.
                // Re-fetch integration or update properties
                // Integration object in context is likely a Mongoose document or POJO
                if (integration.accessToken) {
                    // Update in-memory reference
                    const { encryptToken } = require('../../../services/crypto');
                    integration.accessToken = encryptToken(newToken);
                }
                
                return await operation();
            }
        }
        throw error;
    }
}

// ============================================
// X / TWITTERPlugin
// ============================================

export class XPostTweetTool extends BaseTool {
  name = 'x_post_tweet';
  description = 'Post a tweet to X (formerly Twitter).';
  inputSchema = z.object({
    text: z.string().describe('The content of the tweet (max 280 chars)'),
    replyToId: z.string().optional().describe('ID of the tweet to reply to')
  });

  async runImpl(params: any, context: ToolContext) {
    return withXRetry(async () => {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        
        if (params.replyToId) {
            return xActions.x_reply_tweet({ text: params.text, tweetId: params.replyToId }, integration);
        }
        return xActions.x_post_tweet({ text: params.text }, integration);
    }, context);
  }
}

export class XGetHomeTimelineTool extends BaseTool {
    name = 'x_get_home_timeline';
    description = 'Get recent tweets from your home timeline.';
    inputSchema = z.object({
        limit: z.number().default(10)
    });
    
    async runImpl(params: any, context: ToolContext) {
        return withXRetry(async () => {
            const integration = context.integrations.get('twitter');
            const { xActions } = require('../../../adapters/twitter');
            const userId = integration.metadata?.xUserId;
            return xActions.x_get_home_timeline({ maxResults: params.limit, userId }, integration);
        }, context);
    }
}

export class XSearchTweetsTool extends BaseTool {
    name = 'x_search_tweets';
    description = 'Search for tweets.';
    inputSchema = z.object({
        query: z.string(),
        limit: z.number().default(10)
    });

    async runImpl(params: any, context: ToolContext) {
        return withXRetry(async () => {
            const integration = context.integrations.get('twitter');
            const { xActions } = require('../../../adapters/twitter');
            return xActions.x_search_tweets({ query: params.query, maxResults: params.limit }, integration);
        }, context);
    }
}

export class XGetUserProfileTool extends BaseTool {
    name = 'x_get_user_profile';
    description = 'Get a user\'s profile information.';
    inputSchema = z.object({
        username: z.string()
    });
    
    async runImpl(params: any, context: ToolContext) {
        return withXRetry(async () => {
            const integration = context.integrations.get('twitter');
            const { xActions } = require('../../../adapters/twitter');
            return xActions.x_get_profile({ username: params.username }, integration);
        }, context);
    }
}

