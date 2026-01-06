"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubGetLicenseTool = exports.GitHubGetTopicsTool = exports.GitHubGetContributorsTool = exports.GitHubGetLanguageStatsTool = exports.GitHubGetRepoFileTool = exports.GitHubGetRepoTreeTool = exports.GitHubGetRepoReadmeTool = exports.GitHubUnwatchRepoTool = exports.GitHubWatchRepoTool = exports.GitHubUnstarRepoTool = exports.GitHubStarRepoTool = exports.GitHubForkRepoTool = exports.GitHubSearchReposTool = exports.GitHubListReposTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GITHUB REPOSITORY TOOLS
// ============================================
// ADK-compatible GitHub repository management tools
// ============================================
class GitHubListReposTool extends BaseTool_1.BaseTool {
    name = 'github_list_repos';
    description = 'List repositories for the authenticated user or an organization.';
    inputSchema = zod_1.z.object({
        visibility: zod_1.z.enum(['all', 'public', 'private']).optional().default('all').describe('Repository visibility filter')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        return githubActions.github_list_repos(params, integration);
    }
}
exports.GitHubListReposTool = GitHubListReposTool;
class GitHubSearchReposTool extends BaseTool_1.BaseTool {
    name = 'github_search_repos';
    description = 'Search for repositories on GitHub by query.';
    inputSchema = zod_1.z.object({
        q: zod_1.z.string().describe('Search query'),
        sort: zod_1.z.enum(['stars', 'forks', 'updated']).optional().describe('Sort field'),
        order: zod_1.z.enum(['asc', 'desc']).optional().describe('Sort order'),
        per_page: zod_1.z.number().optional().default(30).describe('Results per page')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        return githubActions.github_search_repos(params, integration);
    }
}
exports.GitHubSearchReposTool = GitHubSearchReposTool;
class GitHubForkRepoTool extends BaseTool_1.BaseTool {
    name = 'github_fork_repo';
    description = 'Fork a repository to your account or an organization.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        organization: zod_1.z.string().optional().describe('Organization to fork to (optional)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_fork_repo({ owner, repo, organization: params.organization }, integration);
    }
}
exports.GitHubForkRepoTool = GitHubForkRepoTool;
class GitHubStarRepoTool extends BaseTool_1.BaseTool {
    name = 'github_star_repo';
    description = 'Star a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_star_repo({ owner, repo }, integration);
    }
}
exports.GitHubStarRepoTool = GitHubStarRepoTool;
class GitHubUnstarRepoTool extends BaseTool_1.BaseTool {
    name = 'github_unstar_repo';
    description = 'Unstar a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_unstar_repo({ owner, repo }, integration);
    }
}
exports.GitHubUnstarRepoTool = GitHubUnstarRepoTool;
class GitHubWatchRepoTool extends BaseTool_1.BaseTool {
    name = 'github_watch_repo';
    description = 'Watch a repository for notifications.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        subscribed: zod_1.z.boolean().optional().default(true).describe('Subscribe to notifications'),
        ignored: zod_1.z.boolean().optional().default(false).describe('Ignore notifications')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_watch_repo({ owner, repo, subscribed: params.subscribed, ignored: params.ignored }, integration);
    }
}
exports.GitHubWatchRepoTool = GitHubWatchRepoTool;
class GitHubUnwatchRepoTool extends BaseTool_1.BaseTool {
    name = 'github_unwatch_repo';
    description = 'Stop watching a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_unwatch_repo({ owner, repo }, integration);
    }
}
exports.GitHubUnwatchRepoTool = GitHubUnwatchRepoTool;
class GitHubGetRepoReadmeTool extends BaseTool_1.BaseTool {
    name = 'github_get_repo_readme';
    description = 'Get the README content from a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_repo_readme({ owner, repo }, integration);
    }
}
exports.GitHubGetRepoReadmeTool = GitHubGetRepoReadmeTool;
class GitHubGetRepoTreeTool extends BaseTool_1.BaseTool {
    name = 'github_get_repo_tree';
    description = 'Get the file tree structure of a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        tree_sha: zod_1.z.string().describe('Tree SHA or branch name'),
        recursive: zod_1.z.boolean().optional().default(false).describe('Recursively get all files')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_repo_tree({ owner, repo, tree_sha: params.tree_sha, recursive: params.recursive }, integration);
    }
}
exports.GitHubGetRepoTreeTool = GitHubGetRepoTreeTool;
class GitHubGetRepoFileTool extends BaseTool_1.BaseTool {
    name = 'github_get_repo_file';
    description = 'Get the content of a specific file from a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        path: zod_1.z.string().describe('File path in repository'),
        ref: zod_1.z.string().optional().describe('Branch, tag, or commit SHA (optional)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_repo_file({ owner, repo, path: params.path, ref: params.ref }, integration);
    }
}
exports.GitHubGetRepoFileTool = GitHubGetRepoFileTool;
class GitHubGetLanguageStatsTool extends BaseTool_1.BaseTool {
    name = 'github_get_languages';
    description = 'Get programming language statistics across all repositories.';
    inputSchema = zod_1.z.object({
        visibility: zod_1.z.enum(['all', 'public', 'private']).optional().default('all').describe('Repository visibility filter')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        return githubActions.github_get_languages(params, integration);
    }
}
exports.GitHubGetLanguageStatsTool = GitHubGetLanguageStatsTool;
class GitHubGetContributorsTool extends BaseTool_1.BaseTool {
    name = 'github_get_contributors';
    description = 'Get the list of contributors for a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_contributors({ owner, repo }, integration);
    }
}
exports.GitHubGetContributorsTool = GitHubGetContributorsTool;
class GitHubGetTopicsTool extends BaseTool_1.BaseTool {
    name = 'github_get_topics';
    description = 'Get the topics/tags for a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_topics({ owner, repo }, integration);
    }
}
exports.GitHubGetTopicsTool = GitHubGetTopicsTool;
class GitHubGetLicenseTool extends BaseTool_1.BaseTool {
    name = 'github_get_license';
    description = 'Get the license information for a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_license({ owner, repo }, integration);
    }
}
exports.GitHubGetLicenseTool = GitHubGetLicenseTool;
