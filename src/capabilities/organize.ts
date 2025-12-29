import { 
  Capability, 
  SafetyLevel, 
  ActionDefinition, 
  ActionInputs, 
  ExecutionContext 
} from './types';

// ============================================
// ORGANIZE CAPABILITY
// ============================================
// Structure, categorize, and manage resources
// ============================================

export const organizeActions: Record<string, ActionDefinition> = {
  
  // ==================== MANAGE EMAIL ====================
  organize_email: {
    actionId: 'organize_email',
    capability: Capability.ORGANIZE,
    intent: 'Archive, delete, or label emails',
    description: 'Manage inbox by archiving, deleting, or labeling emails',
    whenToUse: 'When you need to clean up the inbox or organize emails',
    
    inputSchema: {
      messageId: {
        type: 'string',
        description: 'ID of the email message',
        required: true
      },
      action: {
        type: 'string',
        description: 'Action to perform',
        required: true,
        enum: ['archive', 'delete', 'mark_read', 'mark_unread']
      }
    },
    
    outputSchema: {
      success: 'boolean',
      action: 'string'
    },
    
    constraints: {
      readOnly: false,
      safetyLevel: SafetyLevel.CAUTIOUS,
      rateLimit: {
        maxPerHour: 100,
        maxPerDay: 500
      }
    },
    
    metadata: {
      estimatedDuration: 'instant',
      costLevel: 'free',
      requiresIntegration: ['google']
    },
    
    executor: async (inputs: ActionInputs, context: ExecutionContext) => {
      const { googleActions } = require('../adapters/google');
      const integration = context.integrations.get('google');
      if (!integration) throw new Error('Google integration not connected');
      
      switch (inputs.action) {
        case 'archive':
          await googleActions.google_gmail_archive_email({ messageId: inputs.messageId }, integration);
          break;
        case 'delete':
          await googleActions.google_gmail_delete_email({ messageId: inputs.messageId }, integration);
          break;
        case 'mark_read':
          await googleActions.google_gmail_mark_read({ messageId: inputs.messageId }, integration);
          break;
        case 'mark_unread':
          await googleActions.google_gmail_mark_unread({ messageId: inputs.messageId }, integration);
          break;
      }
      
      return { success: true, action: inputs.action };
    }
  },

  // ==================== ORGANIZE FILE ====================
  organize_file: {
    actionId: 'organize_file',
    capability: Capability.ORGANIZE,
    intent: 'Delete or remove files',
    description: 'Delete files from Google Drive',
    whenToUse: 'When you need to remove old or unused files',
    
    inputSchema: {
      fileId: {
        type: 'string',
        description: 'ID of the file to manage',
        required: true
      },
      action: {
        type: 'string',
        description: 'Action to perform',
        required: true,
        enum: ['delete']
      }
    },
    
    outputSchema: {
      success: 'boolean',
      fileId: 'string'
    },
    
    constraints: {
      readOnly: false,
      safetyLevel: SafetyLevel.RISKY,
      destructive: true,
      requiresConfirmation: true, // Safety first
      rateLimit: {
        maxPerHour: 50,
        maxPerDay: 200
      }
    },
    
    metadata: {
      estimatedDuration: 'instant',
      costLevel: 'free',
      requiresIntegration: ['google']
    },
    
    executor: async (inputs: ActionInputs, context: ExecutionContext) => {
      const { googleActions } = require('../adapters/google');
      const integration = context.integrations.get('google');
      if (!integration) throw new Error('Google integration not connected');
      
      if (inputs.action === 'delete') {
        await googleActions.google_drive_delete_file({ fileId: inputs.fileId }, integration);
      }
      
      return { success: true, fileId: inputs.fileId };
    }
  },
  
  // ==================== MANAGE CALENDAR ====================
  organize_schedule: {
    actionId: 'organize_schedule',
    capability: Capability.ORGANIZE,
    intent: 'Manage calendar events',
    description: 'Delete or cancel calendar events',
    whenToUse: 'When you need to cancel a meeting or remove an event',
    
    inputSchema: {
      eventId: {
        type: 'string',
        description: 'ID of the event',
        required: true
      },
      calendarId: {
        type: 'string',
        description: 'Calendar ID (default: primary)',
        required: false,
        default: 'primary'
      },
      action: {
        type: 'string',
        description: 'Action',
        required: true,
        enum: ['delete']
      }
    },
    
    outputSchema: {
      success: 'boolean',
      eventId: 'string'
    },
    
    constraints: {
      readOnly: false,
      safetyLevel: SafetyLevel.CAUTIOUS,
      rateLimit: {
        maxPerHour: 50,
        maxPerDay: 200
      }
    },
    
    metadata: {
      estimatedDuration: 'instant',
      costLevel: 'free',
      requiresIntegration: ['google']
    },
    
    executor: async (inputs: ActionInputs, context: ExecutionContext) => {
      const { googleActions } = require('../adapters/google');
      const integration = context.integrations.get('google');
      if (!integration) throw new Error('Google integration not connected');
      
      if (inputs.action === 'delete') {
        await googleActions.google_calendar_delete_event({ 
          eventId: inputs.eventId,
          calendarId: inputs.calendarId || 'primary'
        }, integration);
      }
      
      return { success: true, eventId: inputs.eventId };
    }
  }
};

export default organizeActions;
