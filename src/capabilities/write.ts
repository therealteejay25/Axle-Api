import { 
  Capability, 
  SafetyLevel, 
  ActionDefinition, 
  ActionInputs, 
  ExecutionContext 
} from './types';

// ============================================
// WRITE CAPABILITY
// ============================================
// Create new content
// ============================================

export const writeActions: Record<string, ActionDefinition> = {
  
  // ==================== WRITE CODE ISSUE ====================
  write_code_issue: {
    actionId: 'write_code_issue',
    capability: Capability.WRITE,
    intent: 'Create a GitHub issue to track work',
    description: 'Create a new issue in a GitHub repository',
    whenToUse: 'When you need to report a bug, request a feature, or create a task',
    
    inputSchema: {
      repository: {
        type: 'string',
        description: 'Repository name (owner/repo)',
        required: true
      },
      title: {
        type: 'string',
        description: 'Issue title',
        required: true,
        validation: { min: 5, max: 200 }
      },
      description: {
        type: 'string',
        description: 'Detailed description of the issue',
        required: false
      },
      labels: {
        type: 'array',
        description: 'Tags to categorize the issue',
        required: false
      },
      assignee: {
        type: 'string',
        description: 'Person to assign (username)',
        required: false
      }
    },
    
    outputSchema: {
      number: 'number',
      url: 'string',
      title: 'string',
      repository: 'string'
    },
    
    constraints: {
      readOnly: false,
      safetyLevel: SafetyLevel.CAUTIOUS,
      rateLimit: {
        maxPerHour: 10,
        maxPerDay: 50
      }
    },
    
    verification: {
      method: 'read_back',
      expectedOutput: {
        number: 'number',
        url: 'string'
      }
    },
    
    metadata: {
      estimatedDuration: 'instant',
      costLevel: 'free',
      requiresIntegration: ['github']
    },
    
    executor: async (inputs: ActionInputs, context: ExecutionContext) => {
      const { githubActions } = require('../adapters/github');
      const integration = context.integrations.get('github');
      
      if (!integration) {
        throw new Error('GitHub integration not connected');
      }
      
      const [owner, repo] = inputs.repository.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format. Use: owner/repo');
      }
      
      const result = await githubActions.github_create_issue(
        {
          owner,
          repo,
          title: inputs.title,
          body: inputs.description || '',
          labels: inputs.labels || [],
          assignee: inputs.assignee
        },
        integration
      );
      
      return {
        number: result.number,
        url: result.html_url,
        title: result.title,
        repository: inputs.repository
      };
    }
  },
  
  // ==================== WRITE MESSAGE ====================
  write_message: {
    actionId: 'write_message',
    capability: Capability.WRITE,
    intent: 'Send a private message or email',
    description: 'Send a DM, email, or Slack message',
    whenToUse: 'When you need to communicate privately with a person or channel',
    
    inputSchema: {
      to: {
        type: 'string',
        description: 'Recipient (Email, Channel ID, Username)',
        required: true
      },
      message: {
        type: 'string',
        description: 'Message content',
        required: true,
        validation: { min: 1, max: 4000 }
      },
      platform: {
        type: 'string',
        description: 'Which platform to use',
        required: false,
        default: 'slack',
        enum: ['slack', 'email', 'twitter', 'instagram']
      },
      subject: {
        type: 'string',
        description: 'Email subject (email only)',
        required: false
      },
      thread: {
        type: 'string',
        description: 'Reply to specific thread (Slack only)',
        required: false
      }
    },
    
    outputSchema: {
      sent: 'boolean',
      messageId: 'string',
      platform: 'string'
    },
    
    constraints: {
      readOnly: false,
      safetyLevel: SafetyLevel.CAUTIOUS,
      rateLimit: {
        maxPerHour: 30,
        maxPerDay: 150
      }
    },
    
    verification: {
      method: 'check_status'
    },
    
    metadata: {
      estimatedDuration: 'instant',
      costLevel: 'free',
      requiresIntegration: [] // Depends on platform
    },
    
    executor: async (inputs: ActionInputs, context: ExecutionContext) => {
      if (inputs.platform === 'slack') {
        const { slackActions } = require('../adapters/slack');
        const integration = context.integrations.get('slack');
        if (!integration) throw new Error('Slack integration not connected');
        
        const result = await slackActions.slack_send_message(
          { channel: inputs.to, text: inputs.message, threadTs: inputs.thread },
          integration
        );
        return { sent: result.ok === true, messageId: result.ts || '', platform: 'slack' };
      } 
      
      if (inputs.platform === 'email') {
        const { googleActions } = require('../adapters/google');
        const integration = context.integrations.get('google');
        // Fallback to generic email adapter if google not present? 
        // For now assume Google Mail.
        if (!integration) throw new Error('Google integration not connected');
        
        const result = await googleActions.google_gmail_send_email(
          { to: inputs.to, subject: inputs.subject || 'Message from Agent', body: inputs.message },
          integration
        );
        return { sent: true, messageId: result.id || '', platform: 'email' };
      }

      if (inputs.platform === 'twitter') {
         // Twitter DM support requires different scopes/endpoints usually not in basic wrapper
         // Checking xActions... 
         // Assuming x_post_tweet can handle DMs? No.
         // xActions in registry has x_post_tweet, x_reply_tweet.
         // It does NOT listed x_send_dm in the file view I saw earlier (Step 448 view_file twitter.ts truncated?).
         // I'll skip Twitter DM for now or implement if adapter supports.
         throw new Error('Twitter DM not currently supported');
      }

      if (inputs.platform === 'instagram') {
         const { instagramActions } = require('../adapters/instagram');
         const integration = context.integrations.get('instagram');
         if (!integration) throw new Error('Instagram integration not connected');
         
         await instagramActions.ig_send_dm({ recipientId: inputs.to, text: inputs.message }, integration);
         return { sent: true, messageId: 'unknown', platform: 'instagram' };
      }

      throw new Error(`Unknown platform: ${inputs.platform}`);
    }
  },
  
  // ==================== WRITE POST ====================
  write_post: {
    actionId: 'write_post',
    capability: Capability.WRITE,
    intent: 'Publish public content to social media',
    description: 'Post a tweet, status, or image to social media',
    whenToUse: 'When you want to broadcast information publicly on X or Instagram',
    
    inputSchema: {
      content: {
        type: 'string',
        description: 'Text content of the post',
        required: false // Optional for IG actions if image provided
      },
      mediaUrl: {
        type: 'string',
        description: 'URL of image/video to attach',
        required: false
      },
      platform: {
        type: 'string',
        description: 'Platform',
        required: true,
        enum: ['x', 'instagram']
      }
    },
    
    outputSchema: {
      posted: 'boolean',
      postId: 'string',
      url: 'string'
    },
    
    constraints: {
      readOnly: false,
      safetyLevel: SafetyLevel.CAUTIOUS,
      rateLimit: { maxPerHour: 20, maxPerDay: 50 }
    },
    
    metadata: {
      estimatedDuration: 'seconds',
      requiresIntegration: []
    },
    
    executor: async (inputs: ActionInputs, context: ExecutionContext) => {
      if (inputs.platform === 'x') {
        const { xActions } = require('../adapters/twitter');
        const integration = context.integrations.get('twitter');
        if (!integration) throw new Error('Twitter integration not connected');
        
        // Basic text tweet
        if (!inputs.mediaUrl) {
            const result = await xActions.x_post_tweet({ text: inputs.content }, integration);
            return { posted: true, postId: result.data?.id, url: `https://x.com/user/status/${result.data?.id}` };
        }
        // TODO: Handle media upload for X if needed. Assuming text only for now for simplicity/robustness.
        throw new Error('Media upload for X not fully implemented in this action yet. Use text only.');
      }
      
      if (inputs.platform === 'instagram') {
        const { instagramActions } = require('../adapters/instagram');
        const integration = context.integrations.get('instagram');
        if (!integration) throw new Error('Instagram integration not connected');
        
        if (!inputs.mediaUrl) throw new Error('Image URL required for Instagram post');
        
        const result = await instagramActions.ig_create_post({ 
             igUserId: integration.metadata?.userId || 'me', // Adapter needs ID?
             imageUrl: inputs.mediaUrl,
             caption: inputs.content
        }, integration);
        
        return { posted: true, postId: result.id, url: result.permalink || '' };
      }
      
      throw new Error(`Platform ${inputs.platform} not supported`);
    }
  },

  // ==================== WRITE DOCUMENT ====================
  write_document: {
    actionId: 'write_document',
    capability: Capability.WRITE,
    intent: 'Create a new Google Doc',
    description: 'Create a new document in Google Docs',
    whenToUse: 'When you need to draft a report, article, or notes',
    
    inputSchema: {
      title: {
        type: 'string',
        description: 'Document title',
        required: true
      },
      content: {
        type: 'string',
        description: 'Initial text content',
        required: false
      }
    },
    
    outputSchema: {
      documentId: 'string',
      url: 'string'
    },
    
    constraints: {
      readOnly: false,
      safetyLevel: SafetyLevel.SAFE,
      rateLimit: { maxPerHour: 50, maxPerDay: 200 }
    },
    
    metadata: {
      estimatedDuration: 'seconds',
      requiresIntegration: ['google']
    },
    
    executor: async (inputs: ActionInputs, context: ExecutionContext) => {
      const { googleActions } = require('../adapters/google');
      const integration = context.integrations.get('google');
      if (!integration) throw new Error('Google integration not connected');
      
      const doc = await googleActions.google_docs_create_doc({ title: inputs.title }, integration);
      
      if (inputs.content) {
         // Insert initial content
         await googleActions.google_docs_insert_text({
             documentId: doc.documentId,
             text: inputs.content
         }, integration);
      }
      
      return { 
          documentId: doc.documentId,
          url: doc.webViewLink || `https://docs.google.com/document/d/${doc.documentId}`
      };
    }
  },

  // ==================== SCHEDULE MEETING ====================
  schedule_meeting: {
    actionId: 'schedule_meeting',
    capability: Capability.WRITE,
    intent: 'Create a calendar event',
    description: 'Schedule a meeting or event in Google Calendar',
    whenToUse: 'When you need to block time or schedule a meeting',
    
    inputSchema: {
      summary: {
        type: 'string',
        description: 'Event title',
        required: true
      },
      startTime: {
        type: 'string',
        description: 'Start time (ISO)',
        required: true
      },
      endTime: {
        type: 'string',
        description: 'End time (ISO)',
        required: true
      },
      attendees: {
        type: 'array',
        description: 'List of email addresses',
        required: false
      }
    },
    
    outputSchema: {
      eventId: 'string',
      link: 'string'
    },
    
    constraints: {
      readOnly: false,
      safetyLevel: SafetyLevel.CAUTIOUS,
      rateLimit: { maxPerHour: 50, maxPerDay: 200 }
    },
    
    metadata: {
      estimatedDuration: 'instant',
      requiresIntegration: ['google']
    },
    
    executor: async (inputs: ActionInputs, context: ExecutionContext) => {
      const { googleActions } = require('../adapters/google');
      const integration = context.integrations.get('google');
      if (!integration) throw new Error('Google integration not connected');
      
      const result = await googleActions.google_calendar_create_event({
          summary: inputs.summary,
          startTime: inputs.startTime,
          endTime: inputs.endTime,
          attendees: inputs.attendees
      }, integration);
      
      return { 
          eventId: result.id,
          link: result.htmlLink
      };
    }
  },

  // ==================== WRITE COMMENT ====================
  write_comment: {
    actionId: 'write_comment',
    capability: Capability.WRITE,
    intent: 'Reply to or comment on existing content',
    description: 'Add a comment to a GitHub issue, PR, or Slack thread',
    whenToUse: 'When you need to respond to, update, or provide feedback on existing content',
    
    inputSchema: {
      target: {
        type: 'string',
        description: 'What to comment on (issue URL, PR URL, or thread ID)',
        required: true
      },
      comment: {
        type: 'string',
        description: 'Comment text',
        required: true,
        validation: { min: 1, max: 4000 }
      },
      platform: {
        type: 'string',
        description: 'Which platform',
        required: false,
        default: 'github',
        enum: ['github', 'slack', 'instagram']
      }
    },
    
    outputSchema: {
      commentId: 'string',
      url: 'string'
    },
    
    constraints: {
      readOnly: false,
      safetyLevel: SafetyLevel.CAUTIOUS,
      rateLimit: {
        maxPerHour: 20,
        maxPerDay: 100
      }
    },
    
    metadata: {
      estimatedDuration: 'instant',
      costLevel: 'free',
      requiresIntegration: [] // Depends on platform
    },
    
    executor: async (inputs: ActionInputs, context: ExecutionContext) => {
      if (inputs.platform === 'github') {
        const { githubActions } = require('../adapters/github');
        const integration = context.integrations.get('github');
        if (!integration) throw new Error('GitHub integration not connected');
        
        let owner, repo, issueNumber;
        if (inputs.target.includes('github.com')) {
          const match = inputs.target.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
          if (match) [, owner, repo, issueNumber] = match;
        } else if (inputs.target.includes('#')) {
          const [repoPath, number] = inputs.target.split('#');
          [owner, repo] = repoPath.split('/');
          issueNumber = number;
        }
        
        if (!owner || !repo || !issueNumber) throw new Error('Invalid target format');
        
        const result = await githubActions.github_comment_issue(
          { owner, repo, issueNumber: parseInt(issueNumber), body: inputs.comment },
          integration
        );
        return { commentId: result.id?.toString() || '', url: result.html_url || '' };
      } 
      
      if (inputs.platform === 'slack') {
        const { slackActions } = require('../adapters/slack');
        const integration = context.integrations.get('slack');
        if (!integration) throw new Error('Slack integration not connected');
        
        const [channel, threadTs] = inputs.target.split(':');
        const result = await slackActions.slack_send_message(
          { channel, text: inputs.comment, threadTs },
          integration
        );
        return { commentId: result.ts || '', url: `slack://channel/${channel}/thread/${threadTs}` };
      }
      
      if (inputs.platform === 'instagram') {
        const { instagramActions } = require('../adapters/instagram');
        const integration = context.integrations.get('instagram');
        if (!integration) throw new Error('Instagram integration not connected');
        
        const result = await instagramActions.ig_comment_post({ mediaId: inputs.target, message: inputs.comment }, integration);
        return { commentId: result.id || '', url: '' };
      }

      throw new Error(`Unknown platform: ${inputs.platform}`);
    }
  }
};

export default writeActions;
