"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XUnblockUserTool = exports.XBlockUserTool = exports.XUnmuteUserTool = exports.XMuteUserTool = exports.XUnfollowUserTool = exports.XFollowUserTool = exports.XGetProfileTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// X/TWITTER USER TOOLS
// ============================================
class XGetProfileTool extends BaseTool_1.BaseTool {
    name = 'x_get_profile';
    description = 'Get user profile information.';
    inputSchema = zod_1.z.object({
        username: zod_1.z.string().optional().describe('Username (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_get_profile(params, integration);
    }
}
exports.XGetProfileTool = XGetProfileTool;
class XFollowUserTool extends BaseTool_1.BaseTool {
    name = 'x_follow_user';
    description = 'Follow a user on X.';
    inputSchema = zod_1.z.object({
        targetUserId: zod_1.z.string().describe('User ID to follow'),
        userId: zod_1.z.string().optional().describe('Your user ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_follow_user(params, integration);
    }
}
exports.XFollowUserTool = XFollowUserTool;
class XUnfollowUserTool extends BaseTool_1.BaseTool {
    name = 'x_unfollow_user';
    description = 'Unfollow a user on X.';
    inputSchema = zod_1.z.object({
        targetUserId: zod_1.z.string().describe('User ID to unfollow'),
        userId: zod_1.z.string().optional().describe('Your user ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_unfollow_user(params, integration);
    }
}
exports.XUnfollowUserTool = XUnfollowUserTool;
class XMuteUserTool extends BaseTool_1.BaseTool {
    name = 'x_mute_user';
    description = 'Mute a user on X.';
    inputSchema = zod_1.z.object({
        targetUserId: zod_1.z.string().describe('User ID to mute'),
        userId: zod_1.z.string().optional().describe('Your user ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_mute_user(params, integration);
    }
}
exports.XMuteUserTool = XMuteUserTool;
class XUnmuteUserTool extends BaseTool_1.BaseTool {
    name = 'x_unmute_user';
    description = 'Unmute a user on X.';
    inputSchema = zod_1.z.object({
        targetUserId: zod_1.z.string().describe('User ID to unmute'),
        userId: zod_1.z.string().optional().describe('Your user ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_unmute_user(params, integration);
    }
}
exports.XUnmuteUserTool = XUnmuteUserTool;
class XBlockUserTool extends BaseTool_1.BaseTool {
    name = 'x_block_user';
    description = 'Block a user on X.';
    inputSchema = zod_1.z.object({
        targetUserId: zod_1.z.string().describe('User ID to block'),
        userId: zod_1.z.string().optional().describe('Your user ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_block_user(params, integration);
    }
}
exports.XBlockUserTool = XBlockUserTool;
class XUnblockUserTool extends BaseTool_1.BaseTool {
    name = 'x_unblock_user';
    description = 'Unblock a user on X.';
    inputSchema = zod_1.z.object({
        targetUserId: zod_1.z.string().describe('User ID to unblock'),
        userId: zod_1.z.string().optional().describe('Your user ID (omit for authenticated user)')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_unblock_user(params, integration);
    }
}
exports.XUnblockUserTool = XUnblockUserTool;
