"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubUnfollowUserTool = exports.GitHubFollowUserTool = exports.GitHubGetFollowingTool = exports.GitHubGetFollowersTool = exports.GitHubGetStarredReposTool = exports.GitHubGetProfileSummaryTool = exports.GitHubGetUserProfileTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// GITHUB USER/PROFILE TOOLS
// ============================================
class GitHubGetUserProfileTool extends BaseTool_1.BaseTool {
    name = 'github_get_user_profile';
    description = 'Get the authenticated user\'s GitHub profile information.';
    inputSchema = zod_1.z.object({});
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        return githubActions.github_get_user_profile({}, integration);
    }
}
exports.GitHubGetUserProfileTool = GitHubGetUserProfileTool;
class GitHubGetProfileSummaryTool extends BaseTool_1.BaseTool {
    name = 'github_get_profile_summary';
    description = 'Get a comprehensive profile summary including languages, starred repos, and interests.';
    inputSchema = zod_1.z.object({});
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        return githubActions.github_get_profile_summary({}, integration);
    }
}
exports.GitHubGetProfileSummaryTool = GitHubGetProfileSummaryTool;
class GitHubGetStarredReposTool extends BaseTool_1.BaseTool {
    name = 'github_get_starred';
    description = 'Get repositories starred by the authenticated user.';
    inputSchema = zod_1.z.object({
        perPage: zod_1.z.number().optional().default(30).describe('Number of results per page')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        return githubActions.github_get_starred(params, integration);
    }
}
exports.GitHubGetStarredReposTool = GitHubGetStarredReposTool;
class GitHubGetFollowersTool extends BaseTool_1.BaseTool {
    name = 'github_get_followers';
    description = 'Get followers for a user.';
    inputSchema = zod_1.z.object({
        username: zod_1.z.string().optional().describe('GitHub username (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        return githubActions.github_get_followers(params, integration);
    }
}
exports.GitHubGetFollowersTool = GitHubGetFollowersTool;
class GitHubGetFollowingTool extends BaseTool_1.BaseTool {
    name = 'github_get_following';
    description = 'Get users that a user is following.';
    inputSchema = zod_1.z.object({
        username: zod_1.z.string().optional().describe('GitHub username (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        return githubActions.github_get_following(params, integration);
    }
}
exports.GitHubGetFollowingTool = GitHubGetFollowingTool;
class GitHubFollowUserTool extends BaseTool_1.BaseTool {
    name = 'github_follow_user';
    description = 'Follow a GitHub user.';
    inputSchema = zod_1.z.object({
        username: zod_1.z.string().describe('GitHub username to follow')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        return githubActions.github_follow_user(params, integration);
    }
}
exports.GitHubFollowUserTool = GitHubFollowUserTool;
class GitHubUnfollowUserTool extends BaseTool_1.BaseTool {
    name = 'github_unfollow_user';
    description = 'Unfollow a GitHub user.';
    inputSchema = zod_1.z.object({
        username: zod_1.z.string().describe('GitHub username to unfollow')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('github');
        const { githubActions } = require('../../../adapters/github');
        return githubActions.github_unfollow_user(params, integration);
    }
}
exports.GitHubUnfollowUserTool = GitHubUnfollowUserTool;
