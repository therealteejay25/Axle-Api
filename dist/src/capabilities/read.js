"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readActions = void 0;
const types_1 = require("./types");
// ============================================
// READ CAPABILITY
// ============================================
// Consume and understand content
// ============================================
exports.readActions = {
    // ==================== READ ARTICLE ====================
    read_article: {
        actionId: 'read_article',
        capability: types_1.Capability.READ,
        intent: 'Extract and summarize web content',
        description: 'Read and extract content from a web page or article',
        whenToUse: 'When you need to read content from a specific webpage, article, or blog post',
        inputSchema: {
            url: {
                type: 'string',
                description: 'URL of the page to read',
                required: true,
                validation: {
                    pattern: '^https?://'
                }
            },
            extractKeyPoints: {
                type: 'boolean',
                description: 'Whether to extract key points',
                required: false,
                default: true
            }
        },
        outputSchema: {
            title: 'string',
            content: 'string',
            summary: 'string',
            keyPoints: 'array',
            url: 'string'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: {
                maxPerHour: 30,
                maxPerDay: 150
            }
        },
        metadata: {
            estimatedDuration: 'seconds',
            costLevel: 'low',
            requiresIntegration: []
        },
        executor: async (inputs, context) => {
            const { researchActions } = require('../adapters/research');
            const result = await researchActions.research_summarize_url({
                url: inputs.url,
                maxLength: 8000 // Ensure we get enough content
            }, {});
            // Extract key points if requested
            let keyPoints = [];
            if (inputs.extractKeyPoints && result.content) {
                // Simple extraction: first sentences of paragraphs
                const paragraphs = result.content.split('\n\n');
                keyPoints = paragraphs
                    .slice(0, 5)
                    .map((p) => p.split('.')[0])
                    .filter((p) => p.length > 20 && p.length < 200);
            }
            return {
                title: result.title || 'Untitled',
                content: result.content || '',
                summary: result.description || result.content?.substring(0, 500) || '',
                keyPoints,
                url: inputs.url
            };
        }
    },
    // ==================== READ CONVERSATION ====================
    read_conversation: {
        actionId: 'read_conversation',
        capability: types_1.Capability.READ,
        intent: 'Get messages from a Slack channel or thread',
        description: 'Read recent messages from a Slack channel or thread',
        whenToUse: 'When you need to check what was said in a channel or catch up on a conversation',
        inputSchema: {
            channel: {
                type: 'string',
                description: 'Channel ID or name',
                required: true
            },
            limit: {
                type: 'number',
                description: 'Number of messages to read',
                required: false,
                default: 10,
                validation: { min: 1, max: 50 }
            },
            threadTs: {
                type: 'string',
                description: 'Thread timestamp to read specific thread',
                required: false
            }
        },
        outputSchema: {
            messages: 'array',
            channel: 'string',
            count: 'number'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: {
                maxPerHour: 40,
                maxPerDay: 200
            }
        },
        metadata: {
            estimatedDuration: 'instant',
            costLevel: 'free',
            requiresIntegration: ['slack']
        },
        executor: async (inputs, context) => {
            const { slackActions } = require('../adapters/slack');
            const integration = context.integrations.get('slack');
            if (!integration) {
                throw new Error('Slack integration not connected');
            }
            let result;
            if (inputs.threadTs) {
                // Read thread
                result = await slackActions.slack_read_thread({
                    channel: inputs.channel,
                    threadTs: inputs.threadTs
                }, integration);
            }
            else {
                // Read channel messages
                result = await slackActions.slack_read_messages({
                    channel: inputs.channel,
                    limit: inputs.limit || 10
                }, integration);
            }
            return {
                messages: result.messages || [],
                channel: inputs.channel,
                count: result.messages?.length || 0
            };
        }
    },
    // ==================== READ CODE ====================
    read_code: {
        actionId: 'read_code',
        capability: types_1.Capability.READ,
        intent: 'Get repository or file content from GitHub',
        description: 'Read README, code files, or repository information from GitHub',
        whenToUse: 'When you need to understand a repository, read documentation, or view code',
        inputSchema: {
            repository: {
                type: 'string',
                description: 'Repository name (owner/repo)',
                required: true
            },
            type: {
                type: 'string',
                description: 'What to read',
                required: false,
                default: 'readme',
                enum: ['readme', 'info', 'issues', 'prs']
            },
            limit: {
                type: 'number',
                description: 'For lists (issues/prs), how many to return',
                required: false,
                default: 10,
                validation: { min: 1, max: 20 }
            }
        },
        outputSchema: {
            repository: 'string',
            type: 'string',
            data: 'object'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: {
                maxPerHour: 40,
                maxPerDay: 200
            }
        },
        metadata: {
            estimatedDuration: 'seconds',
            costLevel: 'free',
            requiresIntegration: ['github']
        },
        executor: async (inputs, context) => {
            const { githubActions } = require('../adapters/github');
            const integration = context.integrations.get('github');
            if (!integration) {
                throw new Error('GitHub integration not connected');
            }
            const [owner, repo] = inputs.repository.split('/');
            if (!owner || !repo) {
                throw new Error('Invalid repository format. Use: owner/repo');
            }
            let data;
            switch (inputs.type) {
                case 'readme':
                    data = await githubActions.github_get_repo_readme({ owner, repo }, integration);
                    break;
                case 'info':
                    data = await githubActions.github_get_repo({ owner, repo }, integration);
                    break;
                case 'issues':
                    data = await githubActions.github_list_issues({ owner, repo, state: 'open', perPage: inputs.limit || 10 }, integration);
                    break;
                case 'prs':
                    data = await githubActions.github_list_prs({ owner, repo, state: 'open', perPage: inputs.limit || 10 }, integration);
                    break;
                default:
                    throw new Error(`Unknown type: ${inputs.type}`);
            }
            return {
                repository: inputs.repository,
                type: inputs.type,
                data
            };
        }
    },
    // ==================== READ FEED ====================
    read_feed: {
        actionId: 'read_feed',
        capability: types_1.Capability.READ,
        intent: 'Read social media feed or timeline',
        description: 'Get latest posts from X timeline or Instagram feed',
        whenToUse: 'When you need to see what is happening on social media',
        inputSchema: {
            platform: {
                type: 'string',
                description: 'Platform to read',
                required: true,
                enum: ['x', 'instagram']
            },
            username: {
                type: 'string',
                description: 'Username (for IG posts)',
                required: false
            },
            limit: {
                type: 'number',
                description: 'Number of posts',
                required: false,
                default: 10
            }
        },
        outputSchema: {
            posts: 'array',
            count: 'number'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: { maxPerHour: 50, maxPerDay: 500 }
        },
        metadata: {
            estimatedDuration: 'seconds',
            requiresIntegration: []
        },
        executor: async (inputs, context) => {
            if (inputs.platform === 'x') {
                const { xActions } = require('../adapters/twitter');
                const integration = context.integrations.get('twitter');
                if (!integration)
                    throw new Error('Twitter integration not connected');
                const userId = integration?.metadata?.xUserId;
                const result = await xActions.x_get_home_timeline({ maxResults: inputs.limit || 10, userId }, integration);
                return { posts: result.data || [], count: result.meta?.result_count || 0 };
            }
            if (inputs.platform === 'instagram') {
                const { instagramActions } = require('../adapters/instagram');
                const integration = context.integrations.get('instagram');
                if (!integration)
                    throw new Error('Instagram integration not connected');
                // Use provided username or default to current user
                let userId = inputs.username;
                if (!userId) {
                    // TODO: Get current user ID? Assuming caller provides ID for now or knows it
                    throw new Error('Username/UserID required for Instagram feed');
                }
                const result = await instagramActions.ig_get_posts({ igUserId: userId, limit: inputs.limit }, integration);
                return { posts: result.data || [], count: result.data?.length || 0 };
            }
            throw new Error(`Platform ${inputs.platform} not supported`);
        }
    },
    // ==================== READ PROFILE ====================
    read_profile: {
        actionId: 'read_profile',
        capability: types_1.Capability.READ,
        intent: 'Get user profile information',
        description: 'Read profile details (bio, stats) for a user',
        whenToUse: 'When you need to learn about a user on X, Instagram, or GitHub',
        inputSchema: {
            username: {
                type: 'string',
                description: 'Username or User ID',
                required: true
            },
            platform: {
                type: 'string',
                description: 'Platform',
                required: true,
                enum: ['x', 'instagram', 'github']
            }
        },
        outputSchema: {
            profile: 'object'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: { maxPerHour: 100, maxPerDay: 500 }
        },
        metadata: {
            estimatedDuration: 'instant',
            requiresIntegration: []
        },
        executor: async (inputs, context) => {
            if (inputs.platform === 'x') {
                const { xActions } = require('../adapters/twitter');
                const integration = context.integrations.get('twitter');
                if (!integration)
                    throw new Error('Twitter integration not connected');
                return xActions.x_get_profile({ username: inputs.username }, integration);
            }
            if (inputs.platform === 'github') {
                const { githubActions } = require('../adapters/github');
                const integration = context.integrations.get('github');
                if (!integration)
                    throw new Error('GitHub integration not connected');
                return githubActions.github_get_user_profile({ username: inputs.username }, integration);
            }
            if (inputs.platform === 'instagram') {
                const { instagramActions } = require('../adapters/instagram');
                const integration = context.integrations.get('instagram');
                if (!integration)
                    throw new Error('Instagram integration not connected');
                return instagramActions.ig_get_profile({ igUserId: inputs.username }, integration);
            }
            throw new Error(`Platform ${inputs.platform} not supported`);
        }
    },
    // ==================== READ DOCUMENT ====================
    read_document: {
        actionId: 'read_document',
        capability: types_1.Capability.READ,
        intent: 'Read content of a Google Doc',
        description: 'Get text content from a Google Doc',
        whenToUse: 'When you need to read a Google Doc',
        inputSchema: {
            documentId: {
                type: 'string',
                description: 'Google Doc ID',
                required: true
            }
        },
        outputSchema: {
            title: 'string',
            body: 'object'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: { maxPerHour: 100, maxPerDay: 1000 }
        },
        metadata: {
            estimatedDuration: 'seconds',
            requiresIntegration: ['google']
        },
        executor: async (inputs, context) => {
            const { googleActions } = require('../adapters/google');
            const integration = context.integrations.get('google');
            if (!integration)
                throw new Error('Google integration not connected');
            const doc = await googleActions.google_docs_get_doc({ documentId: inputs.documentId }, integration);
            return { title: doc.title, body: doc.body };
        }
    },
    // ==================== READ DATA ====================
    read_data: {
        actionId: 'read_data',
        capability: types_1.Capability.READ,
        intent: 'Read data from Google Sheets',
        description: 'Get cell values from a Google Sheet',
        whenToUse: 'When you need to read structured data or reports from a Sheet',
        inputSchema: {
            spreadsheetId: {
                type: 'string',
                description: 'Sheet ID',
                required: true
            },
            range: {
                type: 'string',
                description: 'A1 notation range (e.g. "Sheet1!A1:B10")',
                required: true
            }
        },
        outputSchema: {
            values: 'array'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: { maxPerHour: 100, maxPerDay: 1000 }
        },
        metadata: {
            estimatedDuration: 'seconds',
            requiresIntegration: ['google']
        },
        executor: async (inputs, context) => {
            const { googleActions } = require('../adapters/google');
            const integration = context.integrations.get('google');
            if (!integration)
                throw new Error('Google integration not connected');
            const result = await googleActions.google_sheets_read_cells({
                spreadsheetId: inputs.spreadsheetId,
                range: inputs.range
            }, integration);
            return { values: result.values || [] };
        }
    },
    // ==================== READ SCHEDULE ====================
    read_schedule: {
        actionId: 'read_schedule',
        capability: types_1.Capability.READ,
        intent: 'List calendar events',
        description: 'Get upcoming events from Google Calendar',
        whenToUse: 'When you need to check availability or list meetings',
        inputSchema: {
            timeMin: {
                type: 'string',
                description: 'Start time (ISO string). Default: Now',
                required: false
            },
            maxResults: {
                type: 'number',
                description: 'Max events',
                required: false,
                default: 10
            },
            calendarId: {
                type: 'string',
                description: 'Calendar ID',
                required: false,
                default: 'primary'
            }
        },
        outputSchema: {
            items: 'array',
            summaryText: 'string'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: { maxPerHour: 50, maxPerDay: 500 }
        },
        metadata: {
            estimatedDuration: 'instant',
            requiresIntegration: ['google']
        },
        executor: async (inputs, context) => {
            const { googleActions } = require('../adapters/google');
            const integration = context.integrations.get('google');
            if (!integration)
                throw new Error('Google integration not connected');
            const result = await googleActions.google_calendar_list_events({
                calendarId: inputs.calendarId || 'primary',
                timeMin: inputs.timeMin,
                maxResults: inputs.maxResults
            }, integration);
            const items = result.items || [];
            const summaryText = items.length > 0
                ? items.map((e) => {
                    const start = e?.start?.dateTime || e?.start?.date;
                    const end = e?.end?.dateTime || e?.end?.date;
                    const summary = e?.summary || 'Untitled event';
                    const startStr = start ? new Date(start).toLocaleString() : 'unknown time';
                    const endStr = end ? new Date(end).toLocaleString() : '';
                    return `- ${summary}${endStr ? ` (${startStr} → ${endStr})` : ` (${startStr})`}`;
                }).join('\n')
                : 'No calendar events found.';
            return { items, summaryText };
        }
    },
    // ==================== READ EMAIL ====================
    read_email: {
        actionId: 'read_email',
        capability: types_1.Capability.READ,
        intent: 'Search and read emails',
        description: 'List or search emails in Gmail',
        whenToUse: 'When you need to check for new emails or find a specific message',
        inputSchema: {
            query: {
                type: 'string',
                description: 'Search query (e.g. "from:boss", "is:unread")',
                required: false
            },
            maxResults: {
                type: 'number',
                description: 'Max emails',
                required: false,
                default: 10
            }
        },
        outputSchema: {
            messages: 'array',
            count: 'number'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: { maxPerHour: 50, maxPerDay: 200 }
        },
        metadata: {
            estimatedDuration: 'seconds',
            requiresIntegration: ['google']
        },
        executor: async (inputs, context) => {
            const { googleActions } = require('../adapters/google');
            const integration = context.integrations.get('google');
            if (!integration)
                throw new Error('Google integration not connected');
            const result = await googleActions.google_gmail_list_emails({
                query: inputs.query,
                maxResults: inputs.maxResults
            }, integration);
            return {
                messages: result.messages || [],
                count: result.resultSizeEstimate || 0
            };
        }
    }
};
exports.default = exports.readActions;
