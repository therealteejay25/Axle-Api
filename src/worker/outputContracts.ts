import { DataContract } from './dataIntegrity';

// ============================================
// OUTPUT CONTRACTS REGISTRY
// ============================================
// Defines expected outputs for each action.
// Used to validate tool results before reuse.
// ============================================

export const outputContracts: Record<string, DataContract[]> = {
  // ============================================
  // CODE TOOLS
  // ============================================
  
  'create_github_issue': [
    {
      field: 'number',
      type: 'number',
      required: true,
      source: 'previous_action'
    },
    {
      field: 'url',
      type: 'string',
      required: true,
      source: 'previous_action',
      validation: { pattern: '^https://github.com/' }
    },
    {
      field: 'id',
      type: 'number',
      required: false,
      source: 'previous_action'
    }
  ],
  
  'list_github_repos': [
    {
      field: 'length',
      type: 'number',
      required: false,
      source: 'previous_action'
    }
  ],
  
  // ============================================
  // DOCUMENTS TOOLS
  // ============================================
  
  'create_google_doc': [
    {
      field: 'documentId',
      type: 'string',
      required: true,
      source: 'previous_action',
      validation: { min: 10 }
    },
    {
      field: 'webViewLink',
      type: 'string',
      required: true,
      source: 'previous_action',
      validation: { pattern: '^https://docs.google.com/' }
    }
  ],
  
  'create_google_sheet': [
    {
      field: 'spreadsheetId',
      type: 'string',
      required: true,
      source: 'previous_action'
    },
    {
      field: 'webViewLink',
      type: 'string',
      required: true,
      source: 'previous_action',
      validation: { pattern: '^https://docs.google.com/spreadsheets/' }
    }
  ],
  
  // ============================================
  // COMMUNICATION TOOLS
  // ============================================
  
  'send_email': [
    {
      field: 'messageId',
      type: 'string',
      required: true,
      source: 'previous_action'
    },
    {
      field: 'status',
      type: 'string',
      required: false,
      source: 'previous_action'
    }
  ],
  
  'send_slack_message': [
    {
      field: 'ok',
      type: 'boolean',
      required: true,
      source: 'previous_action'
    },
    {
      field: 'ts',
      type: 'string',
      required: false,
      source: 'previous_action'
    }
  ],
  
  // ============================================
  // SOCIAL TOOLS
  // ============================================
  
  'post_tweet': [
    {
      field: 'id',
      type: 'string',
      required: true,
      source: 'previous_action'
    },
    {
      field: 'text',
      type: 'string',
      required: false,
      source: 'previous_action'
    },
    {
      field: 'url',
      type: 'string',
      required: false,
      source: 'previous_action'
    }
  ],
  
  // ============================================
  // DATA TOOLS
  // ============================================
  
  'http_get': [
    {
      field: 'status',
      type: 'number',
      required: true,
      source: 'previous_action'
    },
    {
      field: 'data',
      type: 'object',
      required: false,
      source: 'previous_action'
    }
  ],
  
  'http_post': [
    {
      field: 'status',
      type: 'number',
      required: true,
      source: 'previous_action'
    },
    {
      field: 'data',
      type: 'object',
      required: false,
      source: 'previous_action'
    }
  ],
  
  'research_web': [
    {
      field: 'summary',
      type: 'string',
      required: true,
      source: 'previous_action'
    },
    {
      field: 'sources',
      type: 'array',
      required: false,
      source: 'previous_action'
    },
    {
      field: 'keyPoints',
      type: 'array',
      required: false,
      source: 'previous_action'
    }
  ],
  
  'scrape_url': [
    {
      field: 'content',
      type: 'string',
      required: true,
      source: 'previous_action'
    },
    {
      field: 'title',
      type: 'string',
      required: false,
      source: 'previous_action'
    }
  ]
};

// Get output contract for an action
export const getOutputContract = (actionType: string): DataContract[] => {
  return outputContracts[actionType] || [];
};

// Check if action has output contract defined
export const hasOutputContract = (actionType: string): boolean => {
  return actionType in outputContracts;
};
