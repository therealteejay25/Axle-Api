import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// X/TWITTER USER TOOLS
// ============================================

export class XGetProfileTool extends BaseTool {
  name = 'x_get_profile';
  description = 'Get user profile information.';
  
  inputSchema = z.object({
    username: z.string().optional().describe('Username (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_get_profile(params, integration);
  }
}

export class XFollowUserTool extends BaseTool {
  name = 'x_follow_user';
  description = 'Follow a user on X.';
  
  inputSchema = z.object({
    targetUserId: z.string().describe('User ID to follow'),
    userId: z.string().optional().describe('Your user ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_follow_user(params, integration);
  }
}

export class XUnfollowUserTool extends BaseTool {
  name = 'x_unfollow_user';
  description = 'Unfollow a user on X.';
  
  inputSchema = z.object({
    targetUserId: z.string().describe('User ID to unfollow'),
    userId: z.string().optional().describe('Your user ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_unfollow_user(params, integration);
  }
}

export class XMuteUserTool extends BaseTool {
  name = 'x_mute_user';
  description = 'Mute a user on X.';
  
  inputSchema = z.object({
    targetUserId: z.string().describe('User ID to mute'),
    userId: z.string().optional().describe('Your user ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_mute_user(params, integration);
  }
}

export class XUnmuteUserTool extends BaseTool {
  name = 'x_unmute_user';
  description = 'Unmute a user on X.';
  
  inputSchema = z.object({
    targetUserId: z.string().describe('User ID to unmute'),
    userId: z.string().optional().describe('Your user ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_unmute_user(params, integration);
  }
}

export class XBlockUserTool extends BaseTool {
  name = 'x_block_user';
  description = 'Block a user on X.';
  
  inputSchema = z.object({
    targetUserId: z.string().describe('User ID to block'),
    userId: z.string().optional().describe('Your user ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_block_user(params, integration);
  }
}

export class XUnblockUserTool extends BaseTool {
  name = 'x_unblock_user';
  description = 'Unblock a user on X.';
  
  inputSchema = z.object({
    targetUserId: z.string().describe('User ID to unblock'),
    userId: z.string().optional().describe('Your user ID (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_unblock_user(params, integration);
  }
}
