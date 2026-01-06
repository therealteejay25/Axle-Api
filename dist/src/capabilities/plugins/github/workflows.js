"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubGetWorkflowLogsTool = exports.GitHubGetWorkflowRunsTool = exports.GitHubCancelWorkflowTool = exports.GitHubTriggerWorkflowTool = exports.GitHubListWorkflowsTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GITHUB WORKFLOWS (ACTIONS) TOOLS
// ============================================
class GitHubListWorkflowsTool extends BaseTool_1.BaseTool {
    name = 'github_list_workflows';
    description = 'List GitHub Actions workflows in a repository.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_list_workflows({ owner, repo }, integration);
    }
}
exports.GitHubListWorkflowsTool = GitHubListWorkflowsTool;
class GitHubTriggerWorkflowTool extends BaseTool_1.BaseTool {
    name = 'github_trigger_workflow';
    description = 'Trigger a GitHub Actions workflow run.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        workflowId: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).describe('Workflow ID or filename'),
        ref: zod_1.z.string().describe('Git reference (branch, tag, or SHA)'),
        inputs: zod_1.z.record(zod_1.z.any()).optional().describe('Workflow input parameters')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_trigger_workflow({ owner, repo, ...params }, integration);
    }
}
exports.GitHubTriggerWorkflowTool = GitHubTriggerWorkflowTool;
class GitHubCancelWorkflowTool extends BaseTool_1.BaseTool {
    name = 'github_cancel_workflow';
    description = 'Cancel a running workflow run.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        runId: zod_1.z.number().describe('Workflow run ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_cancel_workflow({ owner, repo, runId: params.runId }, integration);
    }
}
exports.GitHubCancelWorkflowTool = GitHubCancelWorkflowTool;
class GitHubGetWorkflowRunsTool extends BaseTool_1.BaseTool {
    name = 'github_get_workflow_runs';
    description = 'Get workflow runs for a repository or specific workflow.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        workflowId: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().describe('Workflow ID or filename (optional)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_workflow_runs({ owner, repo, workflowId: params.workflowId }, integration);
    }
}
exports.GitHubGetWorkflowRunsTool = GitHubGetWorkflowRunsTool;
class GitHubGetWorkflowLogsTool extends BaseTool_1.BaseTool {
    name = 'github_get_workflow_logs';
    description = 'Get logs for a workflow run.';
    inputSchema = zod_1.z.object({
        repository: zod_1.z.string().describe('Repository name ("owner/repo")'),
        runId: zod_1.z.number().describe('Workflow run ID')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        const [owner, repo] = params.repository.split('/');
        return githubActions.github_get_workflow_logs({ owner, repo, runId: params.runId }, integration);
    }
}
exports.GitHubGetWorkflowLogsTool = GitHubGetWorkflowLogsTool;
