// ============================================
// ERROR SUGGESTIONS
// ============================================
// Provides contextual, actionable suggestions for errors
// ============================================

export interface ErrorSuggestion {
  suggestion: string;
  category: 'integration' | 'validation' | 'network' | 'quota' | 'other';
  actionable: boolean;
}

/**
 * Generate actionable suggestion based on error and action context
 */
export const getSuggestion = (
  error: Error,
  actionType: string
): ErrorSuggestion => {
  const errorMessage = error.message.toLowerCase();
  
  // Integration not connected
  if (errorMessage.includes('integration not connected')) {
    const platform = actionType.split('_')[0];
    return {
      suggestion: `Connect your ${platform} integration in Settings → Integrations`,
      category: 'integration',
      actionable: true
    };
  }
  
  // Authentication errors
  if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
    const platform = actionType.split('_')[0];
    return {
      suggestion: `Your ${platform} authorization has expired. Reconnect your integration in Settings`,
      category: 'integration',
      actionable: true
    };
  }
  
  if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
    return {
      suggestion: 'Your integration lacks the required permissions. Try reconnecting with additional scopes',
      category: 'integration',
      actionable: true
    };
  }
  
  // Resource not found
  if (errorMessage.includes('404') || errorMessage.includes('not found')) {
    return {
      suggestion: 'The requested resource was not found. Verify the ID, name, or URL in your action parameters',
      category: 'validation',
      actionable: true
    };
  }
  
  // Rate limiting
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return {
      suggestion: 'Rate limit exceeded. The agent will automatically retry in a few minutes',
      category: 'quota',
      actionable: false
    };
  }
  
  // Quota exceeded
  if (errorMessage.includes('quota') || errorMessage.includes('limit exceeded')) {
    return {
      suggestion: 'API quota exceeded. Check your integration\'s usage limits or wait until quota resets',
      category: 'quota',
      actionable: true
    };
  }
  
  // Network errors
  if (errorMessage.includes('timeout') || errorMessage.includes('econnrefused')) {
    return {
      suggestion: 'Network connection failed. The execution will automatically retry',
      category: 'network',
      actionable: false
    };
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('dns')) {
    return {
      suggestion: 'Network error occurred. Check your internet connection or try again',
      category: 'network',
      actionable: false
    };
  }
  
  // Validation errors
  if (errorMessage.includes('required') || errorMessage.includes('missing')) {
    return {
      suggestion: 'A required parameter is missing. Check the action parameters and AI instructions',
      category: 'validation',
      actionable: true
    };
  }
  
  if (errorMessage.includes('invalid') || errorMessage.includes('malformed')) {
    return {
      suggestion: 'Invalid parameter format. Review the action documentation for correct format',
      category: 'validation',
      actionable: true
    };
  }
  
  // Action-specific suggestions
  if (actionType.startsWith('github_')) {
    if (errorMessage.includes('repository')) {
      return {
        suggestion: 'Repository not found or inaccessible. Check the owner/repo names and your GitHub permissions',
        category: 'validation',
        actionable: true
      };
    }
  }
  
  if (actionType.startsWith('slack_')) {
    if (errorMessage.includes('channel')) {
      return {
        suggestion: 'Slack channel not found. Use the channel ID (e.g., C1234567890) instead of the channel name',
        category: 'validation',
        actionable: true
      };
    }
  }
  
  if (actionType.startsWith('email_')) {
    if (errorMessage.includes('smtp') || errorMessage.includes('mail')) {
      return {
        suggestion: 'Email sending failed. Check your SMTP settings or Resend API key in environment variables',
        category: 'integration',
        actionable: true
      };
    }
  }
  
  // Generic fallback
  return {
    suggestion: 'An error occurred. Check the error details and action parameters, then try again',
    category: 'other',
    actionable: true
  };
};

/**
 * Format error with suggestion for display
 */
export const formatErrorWithSuggestion = (
  error: Error,
  actionType: string
): string => {
  const { suggestion } = getSuggestion(error, actionType);
  return `${error.message}\n\n💡 Suggestion: ${suggestion}`;
};

export default { getSuggestion, formatErrorWithSuggestion };
