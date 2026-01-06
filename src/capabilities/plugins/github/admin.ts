import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GITHUB ADMIN TOOLS
// ============================================

export class GitHubAddCollaboratorTool extends BaseTool {
  name = 'github_add_collaborator';
  description = 'Add a collaborator to a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    username: z.string().describe('GitHub username to add'),
    permission: z.enum(['pull', 'push', 'admin', 'maintain', 'triage']).optional().default('push').describe('Permission level')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_add_collaborator({ owner, repo, username: params.username, permission: params.permission }, integration);
  }
}

export class GitHubRemoveCollaboratorTool extends BaseTool {
  name = 'github_remove_collaborator';
  description = 'Remove a collaborator from a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    username: z.string().describe('GitHub username to remove')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_remove_collaborator({ owner, repo, username: params.username }, integration);
  }
}

export class GitHubListCollaboratorsTool extends BaseTool {
  name = 'github_list_collaborators';
  description = 'List collaborators for a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_list_collaborators({ owner, repo }, integration);
  }
}

export class GitHubCreateWebhookTool extends BaseTool {
  name = 'github_create_webhook';
  description = 'Create a webhook for a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    config: z.object({
      url: z.string().url().describe('Webhook URL'),
      content_type: z.enum(['json', 'form']).optional().default('json'),
      secret: z.string().optional().describe('Webhook secret'),
      insecure_ssl: z.string().optional().describe('SSL verification')
    }).describe('Webhook configuration'),
    events: z.array(z.string()).optional().default(['push']).describe('Events to trigger webhook'),
    active: z.boolean().optional().default(true).describe('Active status')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_create_webhook({ owner, repo, ...params }, integration);
  }
}

export class GitHubListWebhooksTool extends BaseTool {
  name = 'github_list_webhooks';
  description = 'List webhooks for a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_list_webhooks({ owner, repo }, integration);
  }
}

export class GitHubDeleteWebhookTool extends BaseTool {
  name = 'github_delete_webhook';
  description = 'Delete a webhook from a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    hookId: z.number().describe('Webhook ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_delete_webhook({ owner, repo, hookId: params.hookId }, integration);
  }
}
