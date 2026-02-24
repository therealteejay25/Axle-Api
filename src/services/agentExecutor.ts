import { logger } from "./logger";
import { enqueueExecution } from "../queue/executionQueue";
import { Execution } from "../models/Execution";

interface RunOptions {
  agentId: string;
  userId: string;
  input: string;          // trigger.customInstruction passed here as user message
  triggerId?: string;     // optional, for logging/metadata
  threadId?: string;      // use agent's default thread if not provided
}

/**
 * Execute an agent with the given options
 * This is the main entry point for agent execution
 */
export const executeAgent = async (options: RunOptions): Promise<{ executionId: string }> => {
  const { agentId, userId, input, triggerId, threadId } = options;

  logger.info("Agent execution requested", {
    agentId,
    userId,
    triggerId,
    hasInput: !!input,
    threadId,
  });

  // Create execution record
  const execution = await Execution.create({
    agentId,
    triggerId: triggerId ? triggerId : undefined,
    triggerType: triggerId ? "schedule" : "manual",
    status: "pending",
    inputPayload: {
      input,
      task: input,
      triggeredAt: new Date().toISOString(),
      triggeredBy: userId,
      threadId,
    }
  });

  // Enqueue execution job
  await enqueueExecution({
    executionId: execution._id.toString(),
    agentId,
    ownerId: userId,
    triggerId,
    triggerType: triggerId ? "schedule" : "manual",
    payload: {
      input,
      task: input,
      triggeredAt: new Date().toISOString(),
      triggeredBy: userId,
      threadId,
    }
  });

  logger.info("Agent execution enqueued", {
    agentId,
    executionId: execution._id.toString(),
    triggerId,
  });

  return { executionId: execution._id.toString() };
};

// Legacy interface for backward compatibility
interface ExecuteAgentParams {
  agentId: string;
  userId: string;
  triggerId: string;
  triggerType: "schedule" | "webhook" | "manual";
  input: {
    triggeredAt: string;
    [key: string]: any;
  };
}

/**
 * Legacy execute agent function (deprecated)
 * @deprecated Use executeAgent with RunOptions instead
 */
export const executeAgentLegacy = async (params: ExecuteAgentParams): Promise<void> => {
  logger.info("Agent execution triggered (legacy)", {
    agentId: params.agentId,
    userId: params.userId,
    triggerId: params.triggerId,
    triggerType: params.triggerType,
    triggeredAt: params.input.triggeredAt,
  });

  await executeAgent({
    agentId: params.agentId,
    userId: params.userId,
    input: params.input.triggeredAt || "Execute the assigned task",
    triggerId: params.triggerId,
  });
};

export default executeAgent;
