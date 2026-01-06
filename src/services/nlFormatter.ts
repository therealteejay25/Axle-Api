import { callAI } from "../worker/aiCaller";
import { Agent } from "../models/Agent";
import { Integration } from "../models/Integration";

// ============================================
// NATURAL LANGUAGE FORMATTER
// ====================================================================================
// Enhances API data with human-readable explanations
// ============================================

/**
 * Format timestamp to human-readable relative time
 */
export const humanizeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString();
};

/**
 * Get agent name by ID
 */
export const getAgentName = async (agentId: string): Promise<string> => {
  try {
    const agent = await Agent.findById(agentId).select('name').lean();
    return agent?.name || "Unknown Agent";
  } catch {
    return "Unknown Agent";
  }
};

/**
 * Explain execution status
 */
export const explainStatus = (status: string): string => {
  const explanations: Record<string, string> = {
    pending: "⏳ Waiting to start",
    running: "🔄 Currently executing",
    success: "✅ All actions completed successfully",
    failed: "❌ Execution failed - check error details",
    canceled: "🚫 Canceled by user"
  };
  return explanations[status] || status;
};

/**
 * Explain integration status
 */
export const explainIntegrationStatus = (
  provider: string,
  connected: boolean,
  expiresAt?: Date
): string => {
  if (!connected) {
    return `❌ Not connected - connect your ${provider} account in Settings`;
  }
  
  if (expiresAt) {
    const daysUntilExpiry = Math.floor(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilExpiry <= 0) {
      return `❌ Token expired - reconnect your ${provider} account`;
    }
    if (daysUntilExpiry <= 7) {
      return `⚠️ Token expires in ${daysUntilExpiry} days - consider reconnecting`;
    }
  }
  
  return `✅ Connected and healthy`;
};

/**
 * Generate execution summary using AI
 */
export const generateExecutionSummary = async (execution: any): Promise<string> => {
  try {
    // Build simple context
    const actionsText = execution.actionsExecuted
      ?.map((a: any) => `${a.type}${a.error ? ' (failed)' : ' (success)'}`)
      .join(', ') || 'none';
    
    const prompt = `Generate a single, natural sentence summarizing this agent execution:
- Agent: ${execution.agentId?.name || 'Unknown'}
- Status: ${execution.status}
- Actions: ${actionsText}
- Reasoning: ${execution.reasoning || 'Not provided'}

Example good summaries:
- "Successfully sent email with your latest 5 GitHub commits"
- "Posted tweet about your new blog post and received 12 likes"
- "Failed to create GitHub issue due to missing repository access"

Generate ONE concise sentence (max 15 words) that a non-technical user would understand:`;

    const response = await callAI(prompt, "gemini-1.5-pro-002", 0.7, 150);
    
    // Extract just the summary text
    return response.reasoning || "Execution completed";
  } catch {
    // Fallback to simple summary
    if (execution.status === "success") {
      return `Completed ${execution.actionsExecuted?.length || 0} actions successfully`;
    }
    return `Execution ${execution.status}`;
  }
};

/**
 * Enhance execution object with natural language fields
 */
export const enhanceExecution = async (execution: any): Promise<any> => {
  const agentName = execution.agentId?.name || await getAgentName(execution.agentId);
  
  return {
    ...execution,
    // Natural language additions
    agentName,
    statusExplained: explainStatus(execution.status),
    createdAtHuman: humanizeTime(execution.createdAt),
    finishedAtHuman: execution.finishedAt ? humanizeTime(execution.finishedAt) : null,
    durationHuman: execution.finishedAt 
      ? `${Math.round((new Date(execution.finishedAt).getTime() - new Date(execution.createdAt).getTime()) / 1000)}s`
      : null,
    summary: await generateExecutionSummary(execution),
    // ID explanations
    executionIdExplained: "Unique identifier for this agent run",
    agentIdExplained: `The agent that performed this execution: ${agentName}`
  };
};

/**
 * Enhance agent object
 */
export const enhanceAgent = async (agent: any): Promise<any> => {
  return {
    ...agent,
    // Natural language additions
    statusExplained: agent.status === "active" 
      ? "✅ This agent is active and will run when triggered"
      : "⏸️ This agent is paused and won't run",
    createdAtHuman: humanizeTime(agent.createdAt),
    lastRunHuman: agent.lastRunAt ? humanizeTime(agent.lastRunAt) : "Never run",
    // ID explanations
    agentIdExplained: "Unique identifier for this agent",
    ownerIdExplained: "Your user ID - you own this agent"
  };
};

/**
 * Enhance integration object
 */
export const enhanceIntegration = async (integration: any): Promise<any> => {
  return {
    ...integration,
    statusExplained: explainIntegrationStatus(
      integration.provider,
      true,
      integration.expiresAt
    ),
    createdAtHuman: humanizeTime(integration.createdAt),
    lastUsedHuman: integration.lastUsedAt 
      ? humanizeTime(integration.lastUsedAt) 
      : "Never used",
    providerExplained: `${integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)} integration for automating ${integration.provider} actions`
  };
};

/**
 * Enhance audit log
 */
export const enhanceAuditLog = (log: any): any => {
    let description = log.actionType;
    const p = log.params || {};

    // Simple rule-based formatter for common actions
    switch (log.actionType) {
        case 'agent_run':
            description = `Agent '${p.agentName || 'Unknown'}' started running`;
            break;
        case 'agent_created':
            description = `Created new agent '${p.name || 'Untitled'}'`;
            break;
        case 'agent_updated':
             description = `Updated configuration for agent '${p.name || 'Unknown'}'`;
             break;
        case 'agent_deleted':
             description = `Deleted agent '${p.name || 'Unknown'}'`;
             break;
        case 'user_login':
             description = `Logged in via ${p.method || 'unknown method'}`;
             break;
        case 'api_key_created':
             description = `Generated new API key '${p.label || 'Untitled'}'`;
             break;
        case 'integration_connected':
             description = `Connected ${p.provider} account`;
             break;
        case 'cron_trigger_fired':
             description = `Scheduled run triggered for '${p.agentName || 'Unknown Agent'}'`;
             break;
    }

    return {
        ...log,
        description,
        timestampHuman: humanizeTime(log.timestamp)
    };
};

export default {
  humanizeTime,
  getAgentName,
  explainStatus,
  explainIntegrationStatus,
  generateExecutionSummary,
  enhanceExecution,
  enhanceAgent,
  enhanceIntegration,
  enhanceAuditLog
};
