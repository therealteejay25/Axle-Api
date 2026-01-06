"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverActions = void 0;
const types_1 = require("./types");
// ============================================
// DISCOVER CAPABILITY
// ============================================
// Find information, people, or resources
// ============================================
exports.discoverActions = {
    // ==================== SEARCH WEB ====================
    search_web: {
        actionId: 'search_web',
        capability: types_1.Capability.DISCOVER,
        intent: 'Find information on the internet',
        description: 'Search the web and gather information on a topic',
        whenToUse: 'When you need to find current information, research a topic, or gather data from the internet',
        inputSchema: {
            query: {
                type: 'string',
                description: 'What to search for',
                required: true
            },
            maxResults: {
                type: 'number',
                description: 'How many results to return',
                required: false,
                default: 5,
                validation: { min: 1, max: 10 }
            },
            recency: {
                type: 'string',
                description: 'How recent results should be',
                required: false,
                default: 'any',
                enum: ['any', 'day', 'week', 'month', 'year']
            }
        },
        outputSchema: {
            results: 'array',
            query: 'string',
            count: 'number'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: {
                maxPerHour: 20,
                maxPerDay: 100
            }
        },
        verification: {
            method: 'none'
        },
        metadata: {
            estimatedDuration: 'seconds',
            costLevel: 'low',
            requiresIntegration: []
        },
        executor: async (inputs, context) => {
            // Map to underlying research_web tool
            const { researchActions } = require('../adapters/research');
            const result = await researchActions.research_web_search({
                query: inputs.query,
                numResults: inputs.maxResults || 5
            }, {} // No integration needed
            );
            return {
                results: result.results || [],
                query: inputs.query,
                count: result.results?.length || 0,
                summary: result.summary
            };
        }
    },
    // ==================== SEARCH CODE ====================
    search_code: {
        actionId: 'search_code',
        capability: types_1.Capability.DISCOVER,
        intent: 'Find repositories, code, or developers on GitHub',
        description: 'Search GitHub for repositories, code snippets, or developers',
        whenToUse: 'When you need to find open source projects, code examples, or developers',
        inputSchema: {
            query: {
                type: 'string',
                description: 'What to search for',
                required: true
            },
            type: {
                type: 'string',
                description: 'What to search for',
                required: false,
                default: 'repositories',
                enum: ['repositories', 'code', 'users']
            },
            language: {
                type: 'string',
                description: 'Filter by programming language',
                required: false
            },
            maxResults: {
                type: 'number',
                description: 'How many results to return',
                required: false,
                default: 10,
                validation: { min: 1, max: 20 }
            }
        },
        outputSchema: {
            results: 'array',
            query: 'string',
            count: 'number',
            summaryText: 'string'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: {
                maxPerHour: 30,
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
            // Map to github_search_repos
            const result = await githubActions.github_search_repos({
                query: inputs.query,
                language: inputs.language,
                perPage: inputs.maxResults || 10
            }, integration);
            const items = result.items || [];
            const summaryText = items.length > 0
                ? items.map((r) => {
                    const full = r.full_name || r.name || 'unknown';
                    const desc = r.description ? ` — ${r.description}` : '';
                    const url = r.html_url ? ` (${r.html_url})` : '';
                    return `- ${full}${desc}${url}`;
                }).join('\n')
                : 'No GitHub results found.';
            return {
                results: items,
                query: inputs.query,
                count: result.total_count || 0,
                summaryText
            };
        }
    },
    // ==================== SEARCH CONVERSATIONS ====================
    search_conversations: {
        actionId: 'search_conversations',
        capability: types_1.Capability.DISCOVER,
        intent: 'Find messages or discussions in Slack',
        description: 'Search Slack for messages, threads, or discussions',
        whenToUse: 'When you need to find past conversations, decisions, or information shared in Slack',
        inputSchema: {
            query: {
                type: 'string',
                description: 'What to search for',
                required: true
            },
            channel: {
                type: 'string',
                description: 'Limit search to specific channel',
                required: false
            },
            from: {
                type: 'string',
                description: 'Filter by user who sent the message',
                required: false
            },
            maxResults: {
                type: 'number',
                description: 'How many results to return',
                required: false,
                default: 10,
                validation: { min: 1, max: 20 }
            }
        },
        outputSchema: {
            messages: 'array',
            query: 'string',
            count: 'number'
        },
        constraints: {
            readOnly: true,
            safetyLevel: types_1.SafetyLevel.SAFE,
            rateLimit: {
                maxPerHour: 30,
                maxPerDay: 200
            }
        },
        metadata: {
            estimatedDuration: 'seconds',
            costLevel: 'free',
            requiresIntegration: ['slack']
        },
        executor: async (inputs, context) => {
            const { slackActions } = require('../adapters/slack');
            const integration = context.integrations.get('slack');
            if (!integration) {
                throw new Error('Slack integration not connected');
            }
            // Build search query
            let searchQuery = inputs.query;
            if (inputs.channel) {
                searchQuery += ` in:${inputs.channel}`;
            }
            if (inputs.from) {
                searchQuery += ` from:${inputs.from}`;
            }
            const result = await slackActions.slack_search_messages({
                query: searchQuery,
                count: inputs.maxResults || 10
            }, integration);
            return {
                messages: result.messages?.matches || [],
                query: inputs.query,
                count: result.messages?.total || 0
            };
        }
    }
};
exports.default = exports.discoverActions;
