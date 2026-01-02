import { OpenAPILoader } from '../../utils/OpenAPILoader';
import { FunctionTool } from '@google/adk';

// Mock GitHub Spec (in real scenario, load JSON file)
const githubSpec = {
  paths: {
    '/repos/{owner}/{repo}/issues': {
      post: {
        operationId: 'create_issue_openapi',
        summary: 'Create an issue',
        description: 'Create an issue via OpenAPI spec'
      },
      get: {
        operationId: 'list_issues_openapi',
        summary: 'List issues',
        description: 'List issues via OpenAPI spec'
      }
    },
    '/repos/{owner}/{repo}/pulls': {
      get: {
        operationId: 'list_prs_openapi',
        summary: 'List pull requests',
        description: 'List pull requests via OpenAPI spec'
      }
    },
    '/user/repos': {
      get: {
        operationId: 'list_my_repos_openapi',
        summary: 'List my repositories',
        description: 'List user repos via OpenAPI spec'
      }
    }
  },
  servers: [{ url: 'https://api.github.com' }]
};

export const getOpenAPITools = async (context: { integrations: Map<string, any> }): Promise<FunctionTool[]> => {
  if (!context.integrations.has('github')) return [];
  
  return OpenAPILoader.loadTools(githubSpec, 'github');
};
