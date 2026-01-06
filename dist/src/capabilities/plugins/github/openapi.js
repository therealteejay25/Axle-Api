"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenAPITools = void 0;
const OpenAPILoader_1 = require("../../utils/OpenAPILoader");
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
const getOpenAPITools = async (context) => {
    if (!context.integrations.has('github'))
        return [];
    return OpenAPILoader_1.OpenAPILoader.loadTools(githubSpec, 'github');
};
exports.getOpenAPITools = getOpenAPITools;
