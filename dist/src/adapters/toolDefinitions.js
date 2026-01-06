"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableToolDefinitions = exports.getToolsByCapability = exports.getToolDefinition = exports.toolDefinitions = void 0;
const types_1 = require("./types");
// ============================================
// TOOL DEFINITIONS REGISTRY
// ============================================
// Capability-based tool metadata for AI reasoning.
// Tools grouped by what they DO, not which API they use.
// ============================================
exports.toolDefinitions = {
    // ============================================
    // RESEARCH CAPABILITY
    // ============================================
    'research_web': {
        name: 'research_web',
        capability: types_1.ToolCapability.RESEARCH,
        description: 'Search the web and gather information on a topic',
        whenToUse: 'When you need to find current information, research a topic, or gather data from the internet',
        parameters: [
            { name: 'query', type: 'string', required: true, description: 'Search query' },
            { name: 'maxResults', type: 'number', required: false, description: 'Max results to return' }
        ],
        returns: { type: 'object', description: 'Research summary with sources and key points' },
        examples: [{ description: 'Research AI trends', params: { query: 'latest AI trends 2024' } }]
    },
    'scrape_url': {
        name: 'scrape_url',
        capability: types_1.ToolCapability.RESEARCH,
        description: 'Extract content from a specific URL',
        whenToUse: 'When you need to read content from a specific webpage or article',
        parameters: [
            { name: 'url', type: 'string', required: true, description: 'URL to scrape' }
        ],
        returns: { type: 'object', description: 'Page content and title' },
        examples: [{ description: 'Scrape article', params: { url: 'https://example.com/article' } }]
    },
    'http_get': {
        name: 'http_get',
        capability: types_1.ToolCapability.RESEARCH,
        description: 'Make HTTP GET request to any API',
        whenToUse: 'When you need to fetch data from an external API or service',
        parameters: [
            { name: 'url', type: 'string', required: true, description: 'API endpoint URL' },
            { name: 'headers', type: 'object', required: false, description: 'HTTP headers' }
        ],
        returns: { type: 'object', description: 'API response data' },
        examples: [{ description: 'Fetch API data', params: { url: 'https://api.example.com/data' } }]
    },
    // ============================================
    // READ_CONTENT CAPABILITY
    // ============================================
    'github_list_repos': {
        name: 'github_list_repos',
        capability: types_1.ToolCapability.READ_CONTENT,
        provider: 'github',
        description: 'List GitHub repositories for authenticated user',
        whenToUse: 'When you need to see what repositories the user has access to',
        parameters: [
            { name: 'visibility', type: 'string', required: false, description: 'public, private, or all' }
        ],
        returns: { type: 'array', description: 'List of repositories' },
        examples: [{ description: 'List repos', params: {} }]
    },
    'github_list_issues': {
        name: 'github_list_issues',
        capability: types_1.ToolCapability.READ_CONTENT,
        provider: 'github',
        description: 'List issues in a GitHub repository',
        whenToUse: 'When you need to see open issues, bugs, or tasks in a repository',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'state', type: 'string', required: false, description: 'open, closed, or all' }
        ],
        returns: { type: 'array', description: 'List of issues' },
        examples: [{ description: 'List open issues', params: { owner: 'user', repo: 'project', state: 'open' } }]
    },
    'github_get_issue': {
        name: 'github_get_issue',
        capability: types_1.ToolCapability.READ_CONTENT,
        provider: 'github',
        description: 'Get details of a specific GitHub issue',
        whenToUse: 'When you need to read the full details of an issue',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'issueNumber', type: 'number', required: true, description: 'Issue number' }
        ],
        returns: { type: 'object', description: 'Issue details' },
        examples: [{ description: 'Get issue #42', params: { owner: 'user', repo: 'project', issueNumber: 42 } }]
    },
    'github_list_pull_requests': {
        name: 'github_list_pull_requests',
        capability: types_1.ToolCapability.READ_CONTENT,
        provider: 'github',
        description: 'List pull requests in a repository',
        whenToUse: 'When you need to see open or closed pull requests',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'state', type: 'string', required: false, description: 'open, closed, or all' }
        ],
        returns: { type: 'array', description: 'List of pull requests' },
        examples: [{ description: 'List open PRs', params: { owner: 'user', repo: 'project', state: 'open' } }]
    },
    'slack_list_channels': {
        name: 'slack_list_channels',
        capability: types_1.ToolCapability.READ_CONTENT,
        provider: 'slack',
        description: 'List Slack channels in workspace',
        whenToUse: 'When you need to see available channels to send messages to',
        parameters: [
            { name: 'types', type: 'string', required: false, description: 'Channel types to include' }
        ],
        returns: { type: 'array', description: 'List of channels' },
        examples: [{ description: 'List channels', params: {} }]
    },
    'slack_read_messages': {
        name: 'slack_read_messages',
        capability: types_1.ToolCapability.READ_CONTENT,
        provider: 'slack',
        description: 'Read recent messages from a Slack channel',
        whenToUse: 'When you need to check what was said in a channel',
        parameters: [
            { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
            { name: 'limit', type: 'number', required: false, description: 'Number of messages to read' }
        ],
        returns: { type: 'array', description: 'List of messages' },
        examples: [{ description: 'Read messages', params: { channel: 'C123456', limit: 10 } }]
    },
    // ============================================
    // WRITE_CONTENT CAPABILITY
    // ============================================
    'github_create_issue': {
        name: 'github_create_issue',
        capability: types_1.ToolCapability.WRITE_CONTENT,
        provider: 'github',
        description: 'Create a new issue in a GitHub repository',
        whenToUse: 'When you need to report a bug, request a feature, or create a task',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'title', type: 'string', required: true, description: 'Issue title' },
            { name: 'body', type: 'string', required: false, description: 'Issue description' },
            { name: 'labels', type: 'array', required: false, description: 'Labels to add' }
        ],
        returns: { type: 'object', description: 'Created issue with number and URL' },
        examples: [{ description: 'Create bug report', params: { owner: 'user', repo: 'project', title: 'Fix login bug', body: 'Login fails on mobile' } }]
    },
    'github_comment_issue': {
        name: 'github_comment_issue',
        capability: types_1.ToolCapability.WRITE_CONTENT,
        provider: 'github',
        description: 'Add a comment to a GitHub issue',
        whenToUse: 'When you need to respond to or update an issue',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'issueNumber', type: 'number', required: true, description: 'Issue number' },
            { name: 'body', type: 'string', required: true, description: 'Comment text' }
        ],
        returns: { type: 'object', description: 'Created comment' },
        examples: [{ description: 'Comment on issue', params: { owner: 'user', repo: 'project', issueNumber: 42, body: 'Working on this' } }]
    },
    'github_close_issue': {
        name: 'github_close_issue',
        capability: types_1.ToolCapability.WRITE_CONTENT,
        provider: 'github',
        description: 'Close a GitHub issue',
        whenToUse: 'When an issue is resolved or no longer relevant',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'issueNumber', type: 'number', required: true, description: 'Issue number' }
        ],
        returns: { type: 'object', description: 'Closed issue' },
        examples: [{ description: 'Close issue', params: { owner: 'user', repo: 'project', issueNumber: 42 } }]
    },
    'github_create_pr': {
        name: 'github_create_pr',
        capability: types_1.ToolCapability.WRITE_CONTENT,
        provider: 'github',
        description: 'Create a pull request in a repository',
        whenToUse: 'When you need to propose code changes for review',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'title', type: 'string', required: true, description: 'PR title' },
            { name: 'head', type: 'string', required: true, description: 'Branch with changes' },
            { name: 'base', type: 'string', required: true, description: 'Target branch' },
            { name: 'body', type: 'string', required: false, description: 'PR description' }
        ],
        returns: { type: 'object', description: 'Created pull request' },
        examples: [{ description: 'Create PR', params: { owner: 'user', repo: 'project', title: 'Add feature', head: 'feature-branch', base: 'main' } }]
    },
    'http_post': {
        name: 'http_post',
        capability: types_1.ToolCapability.WRITE_CONTENT,
        description: 'Make HTTP POST request to any API',
        whenToUse: 'When you need to send data to an external API or trigger an action',
        parameters: [
            { name: 'url', type: 'string', required: true, description: 'API endpoint URL' },
            { name: 'data', type: 'object', required: true, description: 'Data to send' },
            { name: 'headers', type: 'object', required: false, description: 'HTTP headers' }
        ],
        returns: { type: 'object', description: 'API response' },
        examples: [{ description: 'Post data', params: { url: 'https://api.example.com/create', data: { name: 'test' } } }]
    },
    // ============================================
    // COMMUNICATION CAPABILITY
    // ============================================
    'slack_send_message': {
        name: 'slack_send_message',
        capability: types_1.ToolCapability.COMMUNICATION,
        provider: 'slack',
        description: 'Send a message to a Slack channel',
        whenToUse: 'When you need to notify a team, share information, or communicate in Slack',
        parameters: [
            { name: 'channel', type: 'string', required: true, description: 'Channel ID or name' },
            { name: 'text', type: 'string', required: true, description: 'Message text' },
            { name: 'threadTs', type: 'string', required: false, description: 'Thread timestamp for replies' }
        ],
        returns: { type: 'object', description: 'Sent message with timestamp' },
        examples: [{ description: 'Send message', params: { channel: 'general', text: 'Deployment complete!' } }]
    },
    'slack_reply_thread': {
        name: 'slack_reply_thread',
        capability: types_1.ToolCapability.COMMUNICATION,
        provider: 'slack',
        description: 'Reply to a message thread in Slack',
        whenToUse: 'When you need to respond to a specific conversation thread',
        parameters: [
            { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
            { name: 'threadTs', type: 'string', required: true, description: 'Thread timestamp' },
            { name: 'text', type: 'string', required: true, description: 'Reply text' }
        ],
        returns: { type: 'object', description: 'Sent reply' },
        examples: [{ description: 'Reply to thread', params: { channel: 'C123', threadTs: '1234567890.123456', text: 'Got it!' } }]
    },
    'email_send': {
        name: 'email_send',
        capability: types_1.ToolCapability.COMMUNICATION,
        description: 'Send an email',
        whenToUse: 'When you need to send formal communication, reports, or notifications via email',
        parameters: [
            { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
            { name: 'subject', type: 'string', required: true, description: 'Email subject' },
            { name: 'html', type: 'string', required: false, description: 'HTML email body' },
            { name: 'text', type: 'string', required: false, description: 'Plain text email body' }
        ],
        returns: { type: 'object', description: 'Sent email with message ID' },
        examples: [{ description: 'Send email', params: { to: 'user@example.com', subject: 'Report', text: 'Here is the report' } }]
    },
    // ============================================
    // CODE_MANAGEMENT CAPABILITY
    // ============================================
    'github_merge_pr': {
        name: 'github_merge_pr',
        capability: types_1.ToolCapability.CODE_MANAGEMENT,
        provider: 'github',
        description: 'Merge a pull request',
        whenToUse: 'When a PR has been approved and is ready to merge',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'prNumber', type: 'number', required: true, description: 'PR number' },
            { name: 'merge_method', type: 'string', required: false, description: 'merge, squash, or rebase' }
        ],
        returns: { type: 'object', description: 'Merge result' },
        examples: [{ description: 'Merge PR', params: { owner: 'user', repo: 'project', prNumber: 42 } }]
    },
    'github_create_release': {
        name: 'github_create_release',
        capability: types_1.ToolCapability.CODE_MANAGEMENT,
        provider: 'github',
        description: 'Create a new release in a repository',
        whenToUse: 'When you need to publish a new version or release',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'tagName', type: 'string', required: true, description: 'Git tag for release' },
            { name: 'name', type: 'string', required: false, description: 'Release name' },
            { name: 'body', type: 'string', required: false, description: 'Release notes' }
        ],
        returns: { type: 'object', description: 'Created release' },
        examples: [{ description: 'Create release', params: { owner: 'user', repo: 'project', tagName: 'v1.0.0', name: 'Version 1.0.0' } }]
    },
    'github_trigger_workflow': {
        name: 'github_trigger_workflow',
        capability: types_1.ToolCapability.CODE_MANAGEMENT,
        provider: 'github',
        description: 'Trigger a GitHub Actions workflow',
        whenToUse: 'When you need to run CI/CD pipelines or automated workflows',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'workflowId', type: 'string', required: true, description: 'Workflow file name or ID' },
            { name: 'ref', type: 'string', required: true, description: 'Git ref (branch/tag)' }
        ],
        returns: { type: 'object', description: 'Workflow run status' },
        examples: [{ description: 'Trigger deploy', params: { owner: 'user', repo: 'project', workflowId: 'deploy.yml', ref: 'main' } }]
    },
    // ============================================
    // NOTIFICATIONS CAPABILITY
    // ============================================
    'slack_add_reaction': {
        name: 'slack_add_reaction',
        capability: types_1.ToolCapability.NOTIFICATIONS,
        provider: 'slack',
        description: 'Add emoji reaction to a Slack message',
        whenToUse: 'When you need to acknowledge a message or show status',
        parameters: [
            { name: 'channel', type: 'string', required: true, description: 'Channel ID' },
            { name: 'timestamp', type: 'string', required: true, description: 'Message timestamp' },
            { name: 'emoji', type: 'string', required: true, description: 'Emoji name (without colons)' }
        ],
        returns: { type: 'object', description: 'Reaction result' },
        examples: [{ description: 'Add checkmark', params: { channel: 'C123', timestamp: '1234567890.123456', emoji: 'white_check_mark' } }]
    },
    'github_label_issue': {
        name: 'github_label_issue',
        capability: types_1.ToolCapability.NOTIFICATIONS,
        provider: 'github',
        description: 'Add labels to a GitHub issue',
        whenToUse: 'When you need to categorize or prioritize an issue',
        parameters: [
            { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
            { name: 'repo', type: 'string', required: true, description: 'Repository name' },
            { name: 'issueNumber', type: 'number', required: true, description: 'Issue number' },
            { name: 'labels', type: 'array', required: true, description: 'Labels to add' }
        ],
        returns: { type: 'object', description: 'Updated issue' },
        examples: [{ description: 'Add labels', params: { owner: 'user', repo: 'project', issueNumber: 42, labels: ['bug', 'priority-high'] } }]
    }
};
// Get tool definition by name
const getToolDefinition = (toolName) => {
    return exports.toolDefinitions[toolName] || null;
};
exports.getToolDefinition = getToolDefinition;
// Get all tools for a specific capability
const getToolsByCapability = (capability, connectedIntegrations) => {
    return Object.values(exports.toolDefinitions).filter(tool => {
        // Match capability
        if (tool.capability !== capability)
            return false;
        // Check if required integration is connected
        if (tool.provider && !connectedIntegrations.includes(tool.provider)) {
            return false;
        }
        return true;
    });
};
exports.getToolsByCapability = getToolsByCapability;
// Get all available tools (for a given set of integrations)
const getAvailableToolDefinitions = (connectedIntegrations) => {
    return Object.values(exports.toolDefinitions).filter(tool => {
        // Tools without provider are always available (HTTP, research, etc.)
        if (!tool.provider)
            return true;
        // Check if required integration is connected
        return connectedIntegrations.includes(tool.provider);
    });
};
exports.getAvailableToolDefinitions = getAvailableToolDefinitions;
