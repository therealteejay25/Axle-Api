"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.engageActions = void 0;
const types_1 = require("./types");
// ============================================
// ENGAGE CAPABILITY
// ============================================
// React, like, follow, share (Social Media)
// ============================================
exports.engageActions = {
    // ==================== LIKE ITEM ====================
    engage_like: {
        actionId: 'engage_like',
        capability: types_1.Capability.ENGAGE,
        intent: 'Like a post, tweet, or message',
        description: 'Add a like or heart to a social media post',
        whenToUse: 'When you want to show appreciation or acknowledgement on Social Media (X, IG)',
        inputSchema: {
            target: {
                type: 'string',
                description: 'ID or URL of the item to like',
                required: true
            },
            platform: {
                type: 'string',
                description: 'Platform to use',
                required: true,
                enum: ['x', 'instagram']
            }
        },
        outputSchema: {
            liked: 'boolean',
            target: 'string'
        },
        constraints: {
            readOnly: false,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: {
                maxPerHour: 100,
                maxPerDay: 500
            }
        },
        metadata: {
            estimatedDuration: 'instant',
            costLevel: 'free',
            requiresIntegration: [] // Loaded dynamically based on platform
        },
        executor: async (inputs, context) => {
            if (inputs.platform === 'x') {
                const { xActions } = require('../adapters/twitter');
                const integration = context.integrations.get('twitter');
                if (!integration)
                    throw new Error('Twitter/X integration not connected');
                await xActions.x_like_tweet({ tweetId: inputs.target }, integration);
            }
            else if (inputs.platform === 'instagram') {
                const { instagramActions } = require('../adapters/instagram');
                const integration = context.integrations.get('instagram');
                if (!integration)
                    throw new Error('Instagram integration not connected');
                await instagramActions.ig_like_post({ mediaId: inputs.target }, integration);
            }
            else {
                throw new Error(`Platform ${inputs.platform} not supported for like`);
            }
            return { liked: true, target: inputs.target };
        }
    },
    // ==================== SHARE ITEM ====================
    engage_share: {
        actionId: 'engage_share',
        capability: types_1.Capability.ENGAGE,
        intent: 'Retweet, repost, or share content',
        description: 'Share existing content to your timeline or feed',
        whenToUse: 'When you want to amplify content (Retweet on X)',
        inputSchema: {
            target: {
                type: 'string',
                description: 'ID or URL of the item to share',
                required: true
            },
            platform: {
                type: 'string',
                description: 'Platform to use',
                required: true,
                enum: ['x'] // IG requires re-uploading, handled via CREATE
            },
            comment: {
                type: 'string',
                description: 'Optional quote/comment',
                required: false
            }
        },
        outputSchema: {
            shared: 'boolean',
            shareId: 'string'
        },
        constraints: {
            readOnly: false,
            safetyLevel: types_1.SafetyLevel.CAUTIOUS,
            rateLimit: {
                maxPerHour: 20,
                maxPerDay: 50
            }
        },
        metadata: {
            estimatedDuration: 'instant',
            costLevel: 'free',
            requiresIntegration: ['twitter']
        },
        executor: async (inputs, context) => {
            if (inputs.platform === 'x') {
                const { xActions } = require('../adapters/twitter');
                const integration = context.integrations.get('twitter');
                if (!integration)
                    throw new Error('Twitter/X integration not connected');
                let result;
                if (inputs.comment) {
                    // Quote tweet
                    result = await xActions.x_quote_tweet({ tweetId: inputs.target, text: inputs.comment }, integration);
                }
                else {
                    // Retweet
                    result = await xActions.x_retweet({ tweetId: inputs.target }, integration);
                }
                return {
                    shared: true,
                    shareId: result.data?.id || 'unknown'
                };
            }
            throw new Error(`Platform ${inputs.platform} not supported for sharing`);
        }
    },
    // ==================== FOLLOW USER ====================
    engage_follow: {
        actionId: 'engage_follow',
        capability: types_1.Capability.ENGAGE,
        intent: 'Follow a user or account',
        description: 'Start following a user to see their updates',
        whenToUse: 'When you want to build a connection or track updates from a specific user',
        inputSchema: {
            username: {
                type: 'string',
                description: 'Username or User ID to follow',
                required: true
            },
            platform: {
                type: 'string',
                description: 'Platform to use',
                required: true,
                enum: ['x', 'github'] // IG often restricts bot following
            }
        },
        outputSchema: {
            following: 'boolean',
            target: 'string'
        },
        constraints: {
            readOnly: false,
            safetyLevel: types_1.SafetyLevel.CAUTIOUS,
            rateLimit: {
                maxPerHour: 15,
                maxPerDay: 100
            }
        },
        metadata: {
            estimatedDuration: 'instant',
            costLevel: 'free',
            requiresIntegration: []
        },
        executor: async (inputs, context) => {
            if (inputs.platform === 'x') {
                const { xActions } = require('../adapters/twitter');
                const integration = context.integrations.get('twitter');
                if (!integration)
                    throw new Error('Twitter/X integration not connected');
                await xActions.x_follow_user({ userId: inputs.username }, integration);
            }
            else if (inputs.platform === 'github') {
                const { githubActions } = require('../adapters/github');
                const integration = context.integrations.get('github');
                if (!integration)
                    throw new Error('GitHub integration not connected');
                await githubActions.github_follow_user({ username: inputs.username }, integration);
            }
            else {
                throw new Error(`Platform ${inputs.platform} not supported for follow`);
            }
            return { following: true, target: inputs.username };
        }
    }
};
exports.default = exports.engageActions;
