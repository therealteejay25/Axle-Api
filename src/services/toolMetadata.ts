// src/services/toolMetadata.ts

/**
 * Tool metadata that tells the agent which tools have rich UI cards
 */
export const TOOL_UI_CAPABILITIES: Record<string, {
  hasRichUI: boolean;
  cardType: string;
  description: string;
}> = {
  // Gmail tools with rich cards
  'gmail_compose': {
    hasRichUI: true,
    cardType: 'Email Composer',
    description: 'Creates a beautiful email draft card with editing capabilities',
  },
  'gmail_get_thread': {
    hasRichUI: true,
    cardType: 'Email Thread Viewer',
    description: 'Shows email conversation in an expandable thread view',
  },
  
  // Calendar tools with rich cards
  'google_calendar_get_event': {
    hasRichUI: true,
    cardType: 'Calendar Event Card',
    description: 'Displays event with time, attendees, and join meeting button',
  },
  'google_calendar_list_events': {
    hasRichUI: true,
    cardType: 'Day Schedule View',
    description: 'Shows hourly schedule with conflict detection',
  },
  
  // GitHub tools with rich cards
  'github_get_pr': {
    hasRichUI: true,
    cardType: 'Pull Request Viewer',
    description: 'Shows PR with diff stats, merge button, and file changes',
  },
  'github_get_issue': {
    hasRichUI: true,
    cardType: 'GitHub Issue Card',
    description: 'Displays issue with labels and comment box',
  },
  
  // X (Twitter) tools with rich cards
  'twitter_post': {
    hasRichUI: true,
    cardType: 'Tweet Composer',
    description: 'Shows tweet preview with character counter and image grid',
  },
  'twitter_create_thread': {
    hasRichUI: true,
    cardType: 'Thread Preview',
    description: 'Displays connected thread of tweets before posting',
  },
  
  // Slack tools with rich cards
  'slack_send_message': {
    hasRichUI: true,
    cardType: 'Slack Message Composer',
    description: 'Shows beautiful Slack message card with editable composer, @mentions, and channel preview',
  },
  'slack_post_message': {
    hasRichUI: true,
    cardType: 'Slack Message Composer',
    description: 'Creates Slack message draft with preview before posting',
  },
  'slack_post_to_channel': {
    hasRichUI: true,
    cardType: 'Slack Message Composer',
    description: 'Shows message preview with channel targeting',
  },
  'slack_create_channel': {
    hasRichUI: true,
    cardType: 'Channel Creator',
    description: 'Shows channel creation form with privacy toggle and member selection',
  },
  'slack_get_channel': {
    hasRichUI: true,
    cardType: 'Channel Info Card',
    description: 'Displays channel details with members and settings',
  },
  'slack_get_channel_info': {
    hasRichUI: true,
    cardType: 'Channel Info Card',
    description: 'Shows channel metadata with topic and purpose',
  },
  'slack_get_user': {
    hasRichUI: true,
    cardType: 'User Profile Card',
    description: 'Shows user profile with contact info, status, and quick message button',
  },
  'slack_get_user_info': {
    hasRichUI: true,
    cardType: 'User Profile Card',
    description: 'Displays detailed user information with badges and contact details',
  },
  'slack_lookup_user': {
    hasRichUI: true,
    cardType: 'User Profile Card',
    description: 'Finds and displays user profile by email or username',
  },
  'slack_invite_user': {
    hasRichUI: true,
    cardType: 'User Profile Card',
    description: 'Shows user profile with invite status and channel options',
  },
  
  // Sheets tools with rich cards
  'sheets_update_row': {
    hasRichUI: true,
    cardType: 'Row Comparison Table',
    description: 'Shows old vs new values in a visual diff table',
  },
  
  // Drive tools with rich cards
  'drive_get_file': {
    hasRichUI: true,
    cardType: 'File Preview Card',
    description: 'Displays file with icon, size, and quick actions',
  },
  
  // Web tools with rich cards
  'web_scrape': {
    hasRichUI: true,
    cardType: 'Content Extractor',
    description: 'Shows extracted text with word count and source',
  },
  'cron_schedule': {
    hasRichUI: true,
    cardType: 'Schedule Timer',
    description: 'Displays next run time with enable/disable toggle',
  },
};

/**
 * Generate system prompt addition that tells the agent about UI cards
 */
export function getToolUIContext(): string {
  const toolsWithUI = Object.entries(TOOL_UI_CAPABILITIES)
    .map(([toolName, meta]) => `- ${toolName}: ${meta.description}`)
    .join('\n');
  
  return `
IMPORTANT: UI Capabilities
You have access to tools that produce beautiful, interactive UI cards for users:

${toolsWithUI}

When selecting tools:
1. Prefer tools with rich UI cards when appropriate - they create better user experiences
2. These tools automatically render as interactive cards, not just text
3. Users can interact with these cards (edit drafts, approve actions, etc.)
4. Combine multiple tool calls to build comprehensive interfaces

For example:
- Instead of just "gmail_send", first use "gmail_compose" to show a draft
- Use "google_calendar_list_events" to show a visual schedule
- Use "github_get_pr" to show PR details with merge button

These cards make your responses more helpful and visually engaging.
`;
}

export function hasRichUI(toolName: string): boolean {
  return TOOL_UI_CAPABILITIES[toolName]?.hasRichUI === true;
}
