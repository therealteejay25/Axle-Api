import { Agent } from "../models/Agent";
import { logger } from "../lib/logger";

/**
 * Main Agent Router: Coordinates task delegation to micro agents.
 *
 * Flow:
 * 1. Parse user instruction
 * 2. Identify required micro agents based on tools/integrations
 * 3. Execute micro agents in parallel or sequence
 * 4. Aggregate results
 */

export interface DelegationTask {
  userId: string;
  instruction: string;
  preferredAgents?: string[]; // If user specifies agent IDs
  timeout?: number; // milliseconds
  retryCount?: number;
}

export interface DelegationResult {
  status: "success" | "partial" | "failed";
  results: Array<{
    agentId: string;
    agentName: string;
    status: "completed" | "failed" | "timeout";
    result?: any;
    error?: string;
    executionTime: number;
  }>;
  summary?: string;
  totalTime: number;
}

/**
 * Delegate task to appropriate micro agents.
 */
export const delegateToMicroAgents = async (
  task: DelegationTask
): Promise<DelegationResult> => {
  const startTime = Date.now();
  const results: DelegationResult["results"] = [];

  try {
    // Step 1: Identify candidate micro agents
    let agents: any[] = [];

    if (task.preferredAgents && task.preferredAgents.length > 0) {
      // Use specified agents
      agents = await Agent.find({
        _id: { $in: task.preferredAgents },
        ownerId: task.userId,
      }).lean();
    } else {
      // Auto-discover: find agents that might handle this task
      // For MVP, return all agents for the user; a smarter impl would analyze tools needed
      agents = await Agent.find({ ownerId: task.userId }).lean();
    }

    if (agents.length === 0) {
      logger.warn(`No agents found for user ${task.userId}`);
      return {
        status: "failed",
        results: [],
        summary: "No agents configured for this user.",
        totalTime: Date.now() - startTime,
      };
    }

    // Step 2: Execute micro agents in parallel
    // Use Promise.allSettled to isolate failures
    const executionPromises = agents.map((agent) =>
      executeAgentWithTimeout(
        agent,
        task.userId,
        task.instruction,
        task.timeout || 30000 // 30s default
      )
    );

    const settlements = await Promise.allSettled(executionPromises);

    // Step 3: Aggregate results
    let successCount = 0;
    for (let i = 0; i < settlements.length; i++) {
      const settlement = settlements[i];
      const agent = agents[i];
      const agentStartTime = Date.now();

      if (settlement.status === "fulfilled") {
        const result = settlement.value;
        successCount++;
        results.push({
          agentId: agent._id.toString(),
          agentName: agent.name,
          status: "completed",
          result: result.data,
          executionTime: result.executionTime,
        });
        logger.info(
          `Agent ${agent.name} completed successfully in ${result.executionTime}ms`
        );
      } else {
        const error = settlement.reason;
        results.push({
          agentId: agent._id.toString(),
          agentName: agent.name,
          status: error.message === "TIMEOUT" ? "timeout" : "failed",
          error: error.message,
          executionTime: Date.now() - agentStartTime,
        });
        logger.error(
          `Agent ${agent.name} failed: ${error.message}`,
          error.stack
        );
      }
    }

    const finalStatus =
      successCount === agents.length
        ? "success"
        : successCount > 0
        ? "partial"
        : "failed";

    return {
      status: finalStatus,
      results,
      summary: `Executed ${agents.length} agents: ${successCount} successful, ${
        agents.length - successCount
      } failed.`,
      totalTime: Date.now() - startTime,
    };
  } catch (err) {
    logger.error("Delegation error", err);
    return {
      status: "failed",
      results,
      summary: `Unexpected error: ${err.message}`,
      totalTime: Date.now() - startTime,
    };
  }
};

/**
 * Execute a single agent with timeout and retry logic.
 */
async function executeAgentWithTimeout(
  agent: any,
  userId: string,
  instruction: string,
  timeout: number
): Promise<{ data: any; executionTime: number }> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("TIMEOUT"));
    }, timeout);

    // Import here to avoid circular deps
    import("../services/agentRunner").then(({ runAgentById }) => {
      runAgentById(userId, agent._id.toString(), instruction)
        .then((result) => {
          clearTimeout(timer);
          resolve({
            data: result,
            executionTime: Date.now() - startTime,
          });
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  });
}

export default { delegateToMicroAgents };
