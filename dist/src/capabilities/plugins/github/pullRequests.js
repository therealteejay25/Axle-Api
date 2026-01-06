"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubGetPRFilesTool = exports.GitHubGetPRDiffTool = exports.GitHubCommentPRTool = exports.GitHubReviewPRTool = exports.GitHubUpdatePRTool = exports.GitHubCreatePRTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GITHUB PULL REQUEST TOOLS
// ============================================
// ADK-compatible GitHub PR management tools
// ============================================
class GitHubCreatePRTool extends BaseTool_1.BaseTool {
    name = 'github_create_pr';
    description = 'Create a pull request in a repository to propose code changes for review.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name (\"owner/repo\")'),
        title: zod_1.z.string().describe('PR title'),
        head: zod_1.z.string().describe('Branch with changes'),
        base: zod_1.z.string().describe('Target branch (e.g., "main")'),
        body: zod_1.z.string().optional().describe('PR description'),
        draft: zod_1.z.boolean().optional().describe('Create as draft PR')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_create_pr({
            owner, repo, title: params.title, head: params.head,
            base: params.base, body: params.body, draft: params.draft
        }, integration);
    }
}
exports.GitHubCreatePRTool = GitHubCreatePRTool;
class GitHubUpdatePRTool extends BaseTool_1.BaseTool {
    name = 'github_update_pr';
    description = 'Update a pull request (title, body, state, or base branch).';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name (\"owner/repo\")'),
        prNumber: zod_1.z.number().describe('PR number'),
        title: zod_1.z.string().optional().describe('New title'),
        body: zod_1.z.string().optional().describe('New description'),
        state: zod_1.z.enum(['open', 'closed']).optional().describe('PR state'),
        base: zod_1.z.string().optional().describe('New base branch')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_update_pr({
            owner, repo, prNumber: params.prNumber,
            title: params.title, body: params.body, state: params.state, base: params.base
        }, integration);
    }
}
exports.GitHubUpdatePRTool = GitHubUpdatePRTool;
class GitHubReviewPRTool extends BaseTool_1.BaseTool {
    name = 'github_review_pr';
    description = 'Submit a review on a pull request (approve, request changes, or comment).';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name (\"owner/repo\")'),
        prNumber: zod_1.z.number().describe('PR number'),
        event: zod_1.z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).describe('Review type'),
        body: zod_1.z.string().optional().describe('Review comment')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_review_pr({
            owner, repo, prNumber: params.prNumber, event: params.event, body: params.body
        }, integration);
    }
}
exports.GitHubReviewPRTool = GitHubReviewPRTool;
class GitHubCommentPRTool extends BaseTool_1.BaseTool {
    name = 'github_comment_pr';
    description = 'Add a comment to a pull request.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name (\"owner/repo\")'),
        prNumber: zod_1.z.number().describe('PR number'),
        body: zod_1.z.string().describe('Comment text')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_comment_pr({
            owner, repo, prNumber: params.prNumber, body: params.body
        }, integration);
    }
}
exports.GitHubCommentPRTool = GitHubCommentPRTool;
class GitHubGetPRDiffTool extends BaseTool_1.BaseTool {
    name = 'github_get_pr_diff';
    description = 'Get the diff (changes) for a pull request.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name (\"owner/repo\")'),
        prNumber: zod_1.z.number().describe('PR number')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_pr_diff({
            owner, repo, prNumber: params.prNumber
        }, integration);
    }
}
exports.GitHubGetPRDiffTool = GitHubGetPRDiffTool;
class GitHubGetPRFilesTool extends BaseTool_1.BaseTool {
    name = 'github_get_pr_files';
    description = 'Get the list of files changed in a pull request.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name (\"owner/repo\")'),
        prNumber: zod_1.z.number().describe('PR number')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_pr_files({
            owner, repo, prNumber: params.prNumber
        }, integration);
    }
}
exports.GitHubGetPRFilesTool = GitHubGetPRFilesTool;
