import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GITHUB PULL REQUEST TOOLS
// ============================================
// ADK-compatible GitHub PR management tools
// ============================================

export class GitHubCreatePRTool extends BaseTool {
  name = 'github_create_pr';
  description = 'Create a pull request in a repository to propose code changes for review.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name (\"owner/repo\")'),
    title: z.string().describe('PR title'),
    head: z.string().describe('Branch with changes'),
    base: z.string().describe('Target branch (e.g., "main")'),
    body: z.string().optional().describe('PR description'),
    draft: z.boolean().optional().describe('Create as draft PR')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    
    return githubActions.github_create_pr({
      owner, repo, title: params.title, head: params.head, 
      base: params.base, body: params.body, draft: params.draft
    }, integration);
  }
}

export class GitHubUpdatePRTool extends BaseTool {
  name = 'github_update_pr';
  description = 'Update a pull request (title, body, state, or base branch).';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name (\"owner/repo\")'),
    prNumber: z.number().describe('PR number'),
    title: z.string().optional().describe('New title'),
    body: z.string().optional().describe('New description'),
    state: z.enum(['open', 'closed']).optional().describe('PR state'),
    base: z.string().optional().describe('New base branch')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    
    return githubActions.github_update_pr({
      owner, repo, prNumber: params.prNumber,
      title: params.title, body: params.body, state: params.state, base: params.base
    }, integration);
  }
}

export class GitHubReviewPRTool extends BaseTool {
  name = 'github_review_pr';
  description = 'Submit a review on a pull request (approve, request changes, or comment).';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name (\"owner/repo\")'),
    prNumber: z.number().describe('PR number'),
    event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).describe('Review type'),
    body: z.string().optional().describe('Review comment')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    
    return githubActions.github_review_pr({
      owner, repo, prNumber: params.prNumber, event: params.event, body: params.body
    }, integration);
  }
}

export class GitHubCommentPRTool extends BaseTool {
  name = 'github_comment_pr';
  description = 'Add a comment to a pull request.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name (\"owner/repo\")'),
    prNumber: z.number().describe('PR number'),
    body: z.string().describe('Comment text')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    
    return githubActions.github_comment_pr({
      owner, repo, prNumber: params.prNumber, body: params.body
    }, integration);
  }
}

export class GitHubGetPRDiffTool extends BaseTool {
  name = 'github_get_pr_diff';
  description = 'Get the diff (changes) for a pull request.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name (\"owner/repo\")'),
    prNumber: z.number().describe('PR number')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    
    return githubActions.github_get_pr_diff({
      owner, repo, prNumber: params.prNumber
    }, integration);
  }
}

export class GitHubGetPRFilesTool extends BaseTool {
  name = 'github_get_pr_files';
  description = 'Get the list of files changed in a pull request.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name (\"owner/repo\")'),
    prNumber: z.number().describe('PR number')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    
    return githubActions.github_get_pr_files({
      owner, repo, prNumber: params.prNumber
    }, integration);
  }
}
