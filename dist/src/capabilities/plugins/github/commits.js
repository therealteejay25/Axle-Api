"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubCreateCommitCommentTool = exports.GitHubCompareCommitsTool = exports.GitHubGetCommitDiffTool = exports.GitHubGetCommitTool = exports.GitHubListCommitsTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GITHUB COMMIT TOOLS
// ============================================
class GitHubListCommitsTool extends BaseTool_1.BaseTool {
    name = 'github_list_commits';
    description = 'List commits in a repository with optional filters.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        sha: zod_1.z.string().optional().describe('SHA or branch to start listing from'),
        path: zod_1.z.string().optional().describe('Only commits containing this file path'),
        author: zod_1.z.string().optional().describe('GitHub username of commit author'),
        since: zod_1.z.string().optional().describe('ISO 8601 date - only commits after this date'),
        until: zod_1.z.string().optional().describe('ISO 8601 date - only commits before this date')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_list_commits({ owner, repo, ...params }, integration);
    }
}
exports.GitHubListCommitsTool = GitHubListCommitsTool;
class GitHubGetCommitTool extends BaseTool_1.BaseTool {
    name = 'github_get_commit';
    description = 'Get details of a specific commit.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        ref: zod_1.z.string().describe('Commit SHA, branch name, or tag')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_commit({ owner, repo, ref: params.ref }, integration);
    }
}
exports.GitHubGetCommitTool = GitHubGetCommitTool;
class GitHubGetCommitDiffTool extends BaseTool_1.BaseTool {
    name = 'github_get_commit_diff';
    description = 'Get the diff for a specific commit.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        ref: zod_1.z.string().describe('Commit SHA')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_commit_diff({ owner, repo, ref: params.ref }, integration);
    }
}
exports.GitHubGetCommitDiffTool = GitHubGetCommitDiffTool;
class GitHubCompareCommitsTool extends BaseTool_1.BaseTool {
    name = 'github_compare_commits';
    description = 'Compare two commits or branches.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        base: zod_1.z.string().describe('Base commit SHA or branch'),
        head: zod_1.z.string().describe('Head commit SHA or branch')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_compare_commits({ owner, repo, base: params.base, head: params.head }, integration);
    }
}
exports.GitHubCompareCommitsTool = GitHubCompareCommitsTool;
class GitHubCreateCommitCommentTool extends BaseTool_1.BaseTool {
    name = 'github_create_commit_comment';
    description = 'Add a comment to a commit.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        commit_sha: zod_1.z.string().describe('Commit SHA'),
        body: zod_1.z.string().describe('Comment text'),
        path: zod_1.z.string().optional().describe('Relative path of file to comment on'),
        position: zod_1.z.number().optional().describe('Line index in the diff'),
        line: zod_1.z.number().optional().describe('Line number in the file')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_create_commit_comment({ owner, repo, ...params }, integration);
    }
}
exports.GitHubCreateCommitCommentTool = GitHubCreateCommitCommentTool;
