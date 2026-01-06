import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GITHUB RELEASE TOOLS
// ============================================

export class GitHubListReleasesTool extends BaseTool {
  name = 'github_list_releases';
  description = 'List releases for a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_list_releases({ owner, repo }, integration);
  }
}

export class GitHubGetReleaseTool extends BaseTool {
  name = 'github_get_release';
  description = 'Get details of a specific release.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    releaseId: z.number().describe('Release ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_release({ owner, repo, releaseId: params.releaseId }, integration);
  }
}

export class GitHubCreateReleaseTool extends BaseTool {
  name = 'github_create_release';
  description = 'Create a new release for a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    tagName: z.string().describe('Git tag name for this release'),
    name: z.string().optional().describe('Release name'),
    body: z.string().optional().describe('Release notes'),
    draft: z.boolean().optional().default(false).describe('Create as draft'),
    prerelease: z.boolean().optional().default(false).describe('Mark as prerelease')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_create_release({ owner, repo, ...params }, integration);
  }
}

export class GitHubUpdateReleaseTool extends BaseTool {
  name = 'github_update_release';
  description = 'Update an existing release.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    releaseId: z.number().describe('Release ID'),
    tag_name: z.string().optional().describe('Git tag name'),
    name: z.string().optional().describe('Release name'),
    body: z.string().optional().describe('Release notes'),
    draft: z.boolean().optional().describe('Draft status'),
    prerelease: z.boolean().optional().describe('Prerelease status')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_update_release({ owner, repo, ...params }, integration);
  }
}

export class GitHubDeleteReleaseTool extends BaseTool {
  name = 'github_delete_release';
  description = 'Delete a release.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    releaseId: z.number().describe('Release ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_delete_release({ owner, repo, releaseId: params.releaseId }, integration);
  }
}

export class GitHubListTagsTool extends BaseTool {
  name = 'github_list_tags';
  description = 'List tags for a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_list_tags({ owner, repo }, integration);
  }
}
