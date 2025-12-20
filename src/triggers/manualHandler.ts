import { Agent } from "../models/Agent";
import { Execution } from "../models/Execution";
import { enqueueExecution } from "../queue/executionQueue";
import { hasCredits } from "../services/billing";
import { logger } from "../services/logger";

// ============================================
// MANUAL HANDLER
// ============================================
// Handles manual agent runs via API.
// Just another trigger type.
// ============================================

interface ManualTriggerOptions {
  agentId: string;
  ownerId: string;
  payload?: Record<string, any>;
}

/**
 * Trigger a manual agent run
 */
export const triggerManualRun = async (
  options: ManualTriggerOptions
): Promise<{ success: boolean; executionId?: string; error?: string }> => {
  const { agentId, ownerId, payload = {} } = options;
  
  // Verify agent exists and belongs to user
  const agent = await Agent.findOne({
    _id: agentId,
    ownerId
  });
  
  if (!agent) {
    return { success: false, error: "Agent not found" };
  }
  
  if (agent.status !== "active") {
    return { success: false, error: "Agent is paused" };
  }
  
  // Check user has credits
  const hasCreds = await hasCredits(ownerId, 1);
  if (!hasCreds) {
    return { success: false, error: "Insufficient credits" };
  }
  
  // Create execution record
  const execution = await Execution.create({
    agentId: agent._id,
    triggerType: "manual",
    status: "pending",
    inputPayload: {
      ...payload,
      triggeredAt: new Date().toISOString(),
      triggeredBy: ownerId
    }
  });
  
  // Enqueue execution job
  await enqueueExecution({
    executionId: execution._id.toString(),
    agentId: agent._id.toString(),
    ownerId,
    triggerType: "manual",
    payload: {
      ...payload,
      triggeredAt: new Date().toISOString()
    }
  });
  
  logger.info(`Manual run triggered`, { 
    agentId, 
    executionId: execution._id 
  });
  
  return { success: true, executionId: execution._id.toString() };
};

/**
 * Trigger multiple agents at once
 */
export const triggerBatchRun = async (
  agentIds: string[],
  ownerId: string,
  payload?: Record<string, any>
): Promise<{ results: Array<{ agentId: string; executionId?: string; error?: string }> }> => {
  const results = [];
  
  for (const agentId of agentIds) {
    const result = await triggerManualRun({ agentId, ownerId, payload });
    results.push({
      agentId,
      executionId: result.executionId,
      error: result.error
    });
  }
  
  return { results };
};

export default {
  triggerManualRun,
  triggerBatchRun
};
