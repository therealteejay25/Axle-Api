import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GITHUB REPOSITORY TOOLS
// ============================================
// ADK-compatible GitHub repository management tools
// ============================================

export class GitHubListReposTool extends BaseTool {
  name = 'github_list_repos';
  description = 'List repositories for the authenticated user or an organization.';
  
  inputSchema = z.object({
    visibility: z.enum(['all', 'public', 'private']).optional().default('all').describe('Repository visibility filter')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    return githubActions.github_list_repos(params, integration);
  }
}

export class GitHubSearchReposTool extends BaseTool {
  name = 'github_search_repos';
  description = 'Search for repositories on GitHub by query.';
  
  inputSchema = z.object({
    q: z.string().describe('Search query'),
    sort: z.enum(['stars', 'forks', 'updated']).optional().describe('Sort field'),
    order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
    per_page: z.number().optional().default(30).describe('Results per page')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    return githubActions.github_search_repos(params, integration);
  }
}

export class GitHubForkRepoTool extends BaseTool {
  name = 'github_fork_repo';
  description = 'Fork a repository to your account or an organization.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    organization: z.string().optional().describe('Organization to fork to (optional)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_fork_repo({ owner, repo, organization: params.organization }, integration);
  }
}

export class GitHubStarRepoTool extends BaseTool {
  name = 'github_star_repo';
  description = 'Star a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_star_repo({ owner, repo }, integration);
  }
}

export class GitHubUnstarRepoTool extends BaseTool {
  name = 'github_unstar_repo';
  description = 'Unstar a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_unstar_repo({ owner, repo }, integration);
  }
}

export class GitHubWatchRepoTool extends BaseTool {
  name = 'github_watch_repo';
  description = 'Watch a repository for notifications.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    subscribed: z.boolean().optional().default(true).describe('Subscribe to notifications'),
    ignored: z.boolean().optional().default(false).describe('Ignore notifications')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_watch_repo({ owner, repo, subscribed: params.subscribed, ignored: params.ignored }, integration);
  }
}

export class GitHubUnwatchRepoTool extends BaseTool {
  name = 'github_unwatch_repo';
  description = 'Stop watching a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_unwatch_repo({ owner, repo }, integration);
  }
}

export class GitHubGetRepoReadmeTool extends BaseTool {
  name = 'github_get_repo_readme';
  description = 'Get the README content from a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_repo_readme({ owner, repo }, integration);
  }
}

export class GitHubGetRepoTreeTool extends BaseTool {
  name = 'github_get_repo_tree';
  description = 'Get the file tree structure of a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    tree_sha: z.string().describe('Tree SHA or branch name'),
    recursive: z.boolean().optional().default(false).describe('Recursively get all files')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_repo_tree({ owner, repo, tree_sha: params.tree_sha, recursive: params.recursive }, integration);
  }
}

export class GitHubGetRepoFileTool extends BaseTool {
  name = 'github_get_repo_file';
  description = 'Get the content of a specific file from a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    path: z.string().describe('File path in repository'),
    ref: z.string().optional().describe('Branch, tag, or commit SHA (optional)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_repo_file({ owner, repo, path: params.path, ref: params.ref }, integration);
  }
}

export class GitHubGetLanguageStatsTool extends BaseTool {
  name = 'github_get_languages';
  description = 'Get programming language statistics across all repositories.';
  
  inputSchema = z.object({
    visibility: z.enum(['all', 'public', 'private']).optional().default('all').describe('Repository visibility filter')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    return githubActions.github_get_languages(params, integration);
  }
}

export class GitHubGetContributorsTool extends BaseTool {
  name = 'github_get_contributors';
  description = 'Get the list of contributors for a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_contributors({ owner, repo }, integration);
  }
}

export class GitHubGetTopicsTool extends BaseTool {
  name = 'github_get_topics';
  description = 'Get the topics/tags for a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_topics({ owner, repo }, integration);
  }
}

export class GitHubGetLicenseTool extends BaseTool {
  name = 'github_get_license';
  description = 'Get the license information for a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_license({ owner, repo }, integration);
  }
}
