import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GITHUB USER/PROFILE TOOLS
// ============================================

export class GitHubGetUserProfileTool extends BaseTool {
  name = 'github_get_user_profile';
  description = 'Get the authenticated user\'s GitHub profile information.';
  
  inputSchema = z.object({});

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    return githubActions.github_get_user_profile({}, integration);
  }
}

export class GitHubGetProfileSummaryTool extends BaseTool {
  name = 'github_get_profile_summary';
  description = 'Get a comprehensive profile summary including languages, starred repos, and interests.';
  
  inputSchema = z.object({});

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    return githubActions.github_get_profile_summary({}, integration);
  }
}

export class GitHubGetStarredReposTool extends BaseTool {
  name = 'github_get_starred';
  description = 'Get repositories starred by the authenticated user.';
  
  inputSchema = z.object({
    perPage: z.number().optional().default(30).describe('Number of results per page')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    return githubActions.github_get_starred(params, integration);
  }
}

export class GitHubGetFollowersTool extends BaseTool {
  name = 'github_get_followers';
  description = 'Get followers for a user.';
  
  inputSchema = z.object({
    username: z.string().optional().describe('GitHub username (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    return githubActions.github_get_followers(params, integration);
  }
}

export class GitHubGetFollowingTool extends BaseTool {
  name = 'github_get_following';
  description = 'Get users that a user is following.';
  
  inputSchema = z.object({
    username: z.string().optional().describe('GitHub username (omit for authenticated user)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    return githubActions.github_get_following(params, integration);
  }
}

export class GitHubFollowUserTool extends BaseTool {
  name = 'github_follow_user';
  description = 'Follow a GitHub user.';
  
  inputSchema = z.object({
    username: z.string().describe('GitHub username to follow')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    return githubActions.github_follow_user(params, integration);
  }
}

export class GitHubUnfollowUserTool extends BaseTool {
  name = 'github_unfollow_user';
  description = 'Unfollow a GitHub user.';
  
  inputSchema = z.object({
    username: z.string().describe('GitHub username to unfollow')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    return githubActions.github_unfollow_user(params, integration);
  }
}
