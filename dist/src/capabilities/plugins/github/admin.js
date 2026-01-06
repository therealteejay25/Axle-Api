"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubDeleteWebhookTool = exports.GitHubListWebhooksTool = exports.GitHubCreateWebhookTool = exports.GitHubListCollaboratorsTool = exports.GitHubRemoveCollaboratorTool = exports.GitHubAddCollaboratorTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GITHUB ADMIN TOOLS
// ============================================
class GitHubAddCollaboratorTool extends BaseTool_1.BaseTool {
    name = 'github_add_collaborator';
    description = 'Add a collaborator to a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        username: zod_1.z.string().describe('GitHub username to add'),
        permission: zod_1.z.enum(['pull', 'push', 'admin', 'maintain', 'triage']).optional().default('push').describe('Permission level')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_add_collaborator({ owner, repo, username: params.username, permission: params.permission }, integration);
    }
}
exports.GitHubAddCollaboratorTool = GitHubAddCollaboratorTool;
class GitHubRemoveCollaboratorTool extends BaseTool_1.BaseTool {
    name = 'github_remove_collaborator';
    description = 'Remove a collaborator from a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        username: zod_1.z.string().describe('GitHub username to remove')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_remove_collaborator({ owner, repo, username: params.username }, integration);
    }
}
exports.GitHubRemoveCollaboratorTool = GitHubRemoveCollaboratorTool;
class GitHubListCollaboratorsTool extends BaseTool_1.BaseTool {
    name = 'github_list_collaborators';
    description = 'List collaborators for a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_list_collaborators({ owner, repo }, integration);
    }
}
exports.GitHubListCollaboratorsTool = GitHubListCollaboratorsTool;
class GitHubCreateWebhookTool extends BaseTool_1.BaseTool {
    name = 'github_create_webhook';
    description = 'Create a webhook for a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        config: zod_1.z.object({
            url: zod_1.z.string().url().describe('Webhook URL'),
            content_type: zod_1.z.enum(['json', 'form']).optional().default('json'),
            secret: zod_1.z.string().optional().describe('Webhook secret'),
            insecure_ssl: zod_1.z.string().optional().describe('SSL verification')
        }).describe('Webhook configuration'),
        events: zod_1.z.array(zod_1.z.string()).optional().default(['push']).describe('Events to trigger webhook'),
        active: zod_1.z.boolean().optional().default(true).describe('Active status')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_create_webhook({ owner, repo, ...params }, integration);
    }
}
exports.GitHubCreateWebhookTool = GitHubCreateWebhookTool;
class GitHubListWebhooksTool extends BaseTool_1.BaseTool {
    name = 'github_list_webhooks';
    description = 'List webhooks for a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_list_webhooks({ owner, repo }, integration);
    }
}
exports.GitHubListWebhooksTool = GitHubListWebhooksTool;
class GitHubDeleteWebhookTool extends BaseTool_1.BaseTool {
    name = 'github_delete_webhook';
    description = 'Delete a webhook from a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        hookId: zod_1.z.number().describe('Webhook ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_delete_webhook({ owner, repo, hookId: params.hookId }, integration);
    }
}
exports.GitHubDeleteWebhookTool = GitHubDeleteWebhookTool;
