import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// GITHUB WORKFLOWS (ACTIONS) TOOLS
// ============================================

export class GitHubListWorkflowsTool extends BaseTool {
  name = 'github_list_workflows';
  description = 'List GitHub Actions workflows in a repository.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_list_workflows({ owner, repo }, integration);
  }
}

export class GitHubTriggerWorkflowTool extends BaseTool {
  name = 'github_trigger_workflow';
  description = 'Trigger a GitHub Actions workflow run.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    workflowId: z.union([z.string(), z.number()]).describe('Workflow ID or filename'),
    ref: z.string().describe('Git reference (branch, tag, or SHA)'),
    inputs: z.record(z.any()).optional().describe('Workflow input parameters')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_trigger_workflow({ owner, repo, ...params }, integration);
  }
}

export class GitHubCancelWorkflowTool extends BaseTool {
  name = 'github_cancel_workflow';
  description = 'Cancel a running workflow run.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    runId: z.number().describe('Workflow run ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_cancel_workflow({ owner, repo, runId: params.runId }, integration);
  }
}

export class GitHubGetWorkflowRunsTool extends BaseTool {
  name = 'github_get_workflow_runs';
  description = 'Get workflow runs for a repository or specific workflow.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    workflowId: z.union([z.string(), z.number()]).optional().describe('Workflow ID or filename (optional)')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_workflow_runs({ owner, repo, workflowId: params.workflowId }, integration);
  }
}

export class GitHubGetWorkflowLogsTool extends BaseTool {
  name = 'github_get_workflow_logs';
  description = 'Get logs for a workflow run.';
  
  inputSchema = z.object({
    repository: z.string().describe('Repository name ("owner/repo")'),
    runId: z.number().describe('Workflow run ID')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('github');
    const { githubActions } = require('../../../adapters/github');
    const [owner, repo] = params.repository.split('/');
    return githubActions.github_get_workflow_logs({ owner, repo, runId: params.runId }, integration);
  }
}
