import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GITHUB COMMIT TOOLS
// ============================================

export class GitHubListCommitsTool extends BaseTool {
  name = 'github_list_commits';
  description = 'List commits in a repository with optional filters.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    sha: z.string().optional().describe('SHA or branch to start listing from'),
    path: z.string().optional().describe('Only commits containing this file path'),
    author: z.string().optional().describe('GitHub username of commit author'),
    since: z.string().optional().describe('ISO 8601 date - only commits after this date'),
    until: z.string().optional().describe('ISO 8601 date - only commits before this date')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_list_commits({ owner, repo, ...params }, integration);
  }
}

export class GitHubGetCommitTool extends BaseTool {
  name = 'github_get_commit';
  description = 'Get details of a specific commit.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    ref: z.string().describe('Commit SHA, branch name, or tag')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_commit({ owner, repo, ref: params.ref }, integration);
  }
}

export class GitHubGetCommitDiffTool extends BaseTool {
  name = 'github_get_commit_diff';
  description = 'Get the diff for a specific commit.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    ref: z.string().describe('Commit SHA')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_commit_diff({ owner, repo, ref: params.ref }, integration);
  }
}

export class GitHubCompareCommitsTool extends BaseTool {
  name = 'github_compare_commits';
  description = 'Compare two commits or branches.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    base: z.string().describe('Base commit SHA or branch'),
    head: z.string().describe('Head commit SHA or branch')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_compare_commits({ owner, repo, base: params.base, head: params.head }, integration);
  }
}

export class GitHubCreateCommitCommentTool extends BaseTool {
  name = 'github_create_commit_comment';
  description = 'Add a comment to a commit.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    commit_sha: z.string().describe('Commit SHA'),
    body: z.string().describe('Comment text'),
    path: z.string().optional().describe('Relative path of file to comment on'),
    position: z.number().optional().describe('Line index in the diff'),
    line: z.number().optional().describe('Line number in the file')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_create_commit_comment({ owner, repo, ...params }, integration);
  }
}
