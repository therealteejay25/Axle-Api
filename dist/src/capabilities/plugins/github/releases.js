"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubListTagsTool = exports.GitHubDeleteReleaseTool = exports.GitHubUpdateReleaseTool = exports.GitHubCreateReleaseTool = exports.GitHubGetReleaseTool = exports.GitHubListReleasesTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GITHUB RELEASE TOOLS
// ============================================
class GitHubListReleasesTool extends BaseTool_1.BaseTool {
    name = 'github_list_releases';
    description = 'List releases for a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_list_releases({ owner, repo }, integration);
    }
}
exports.GitHubListReleasesTool = GitHubListReleasesTool;
class GitHubGetReleaseTool extends BaseTool_1.BaseTool {
    name = 'github_get_release';
    description = 'Get details of a specific release.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        releaseId: zod_1.z.number().describe('Release ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_release({ owner, repo, releaseId: params.releaseId }, integration);
    }
}
exports.GitHubGetReleaseTool = GitHubGetReleaseTool;
class GitHubCreateReleaseTool extends BaseTool_1.BaseTool {
    name = 'github_create_release';
    description = 'Create a new release for a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        tagName: zod_1.z.string().describe('Git tag name for this release'),
        name: zod_1.z.string().optional().describe('Release name'),
        body: zod_1.z.string().optional().describe('Release notes'),
        draft: zod_1.z.boolean().optional().default(false).describe('Create as draft'),
        prerelease: zod_1.z.boolean().optional().default(false).describe('Mark as prerelease')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_create_release({ owner, repo, ...params }, integration);
    }
}
exports.GitHubCreateReleaseTool = GitHubCreateReleaseTool;
class GitHubUpdateReleaseTool extends BaseTool_1.BaseTool {
    name = 'github_update_release';
    description = 'Update an existing release.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        releaseId: zod_1.z.number().describe('Release ID'),
        tag_name: zod_1.z.string().optional().describe('Git tag name'),
        name: zod_1.z.string().optional().describe('Release name'),
        body: zod_1.z.string().optional().describe('Release notes'),
        draft: zod_1.z.boolean().optional().describe('Draft status'),
        prerelease: zod_1.z.boolean().optional().describe('Prerelease status')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_update_release({ owner, repo, ...params }, integration);
    }
}
exports.GitHubUpdateReleaseTool = GitHubUpdateReleaseTool;
class GitHubDeleteReleaseTool extends BaseTool_1.BaseTool {
    name = 'github_delete_release';
    description = 'Delete a release.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        releaseId: zod_1.z.number().describe('Release ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_delete_release({ owner, repo, releaseId: params.releaseId }, integration);
    }
}
exports.GitHubDeleteReleaseTool = GitHubDeleteReleaseTool;
class GitHubListTagsTool extends BaseTool_1.BaseTool {
    name = 'github_list_tags';
    description = 'List tags for a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_list_tags({ owner, repo }, integration);
    }
}
exports.GitHubListTagsTool = GitHubListTagsTool;
