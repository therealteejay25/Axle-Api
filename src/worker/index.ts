import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { ExecutionJobData, ExecutionJobResult } from "../queue/executionQueue";
import { Execution } from "../models/Execution";
import { loadAgent } from "./agentLoader";
import { SocketService } from "../services/SocketService";
import { buildContext, buildIterativeContext, buildSystemPrompt } from "./contextBuilder";
import { callAI, AIAction, MemoryEntry } from "./aiCaller";
import { executeActions, toExecutionActions } from "./actionExecutor";
import { deductCredits, calculateCredits } from "../services/billing";
import { logger } from "../services/logger";


// ============================================
// WORKER
// ============================================
// Processes execution jobs one at a time.
// Complete lifecycle:
//   1. Mark execution as running
//   2. Load agent config
//   3. Load integrations
//   4. Build execution context
//   5. Call AI
//   6. Validate AI output
//   7. Execute actions
//   8. Persist results
//   9. Mark execution complete
// ============================================

const QUEUE_NAME = "execution-queue";

let worker: Worker<ExecutionJobData, ExecutionJobResult> | null = null;

export const startWorker = (): Worker<ExecutionJobData, ExecutionJobResult> => {
  worker = new Worker<ExecutionJobData, ExecutionJobResult>(
    QUEUE_NAME,
    async (job: Job<ExecutionJobData, ExecutionJobResult>) => {
      return processJob(job);
    },
    {
      connection: redis,
      concurrency: 5, // Process up to 5 jobs in parallel
      limiter: {
        max: 100,
        duration: 60000 // Max 100 jobs per minute
      }
    }
  );
  
  worker.on("completed", (job, result) => {
    logger.info("Job completed", {
      jobId: job.id,
      executionId: job.data.executionId,
      success: result.success,
      actionsExecuted: result.actionsExecuted
    });
  });
  
  worker.on("failed", (job, error) => {
    logger.error("Job failed", {
      jobId: job?.id,
      executionId: job?.data.executionId,
      error: error.message
    });
  });
  
  worker.on("error", (error) => {
    logger.error("Worker error", { error: error.message });
  });
  
  logger.info("Worker started");
  return worker;
};

// Validate actions before execution
const validateActions = (actions: AIAction[], loaded: LoadedAgent): string[] => {
  const errors: string[] = [];
  
  // Legacy Registry
  const { getAvailableActions: getLegacyActions, validateActionParams: validateLegacyParams } = require("../adapters/registry");
  // New Capability Executor
  const { getAction: getCapabilityAction, validateActionParams: validateCapabilityParams } = require("../capabilities/executor");
  
  const legacyActions = getLegacyActions();
  const integrationNames = Array.from(loaded.integrations.keys());
  
  for (const action of actions) {
    // 1. Check Capability Layer (New System)
    const capabilityAction = getCapabilityAction(action.type);
    
    if (capabilityAction) {
       // Check integration connection
       const required = capabilityAction.metadata.requiresIntegration || [];
       if (required.length > 0) {
         const missing = required.filter((i: string) => !integrationNames.includes(i));
         if (missing.length > 0) {
           errors.push(`Action "${action.type}" requires integration: ${missing.join(', ')}.`);
           continue;
         }
       }
       
       // Validate params
       const validation = validateCapabilityParams(action.type, action.params);
       if (!validation.valid) {
          errors.push(`Invalid params for "${action.type}": ${validation.errors.join(', ')}`);
       }
       continue;
    }
    
    // 2. Check Legacy Registry (Old System)
    if (legacyActions.includes(action.type)) {
       // Check integration
       const platform = action.type.split('_')[0];
       const requiresIntegration = !['http', 'email', 'scraper', 'research'].includes(platform);
       
       if (requiresIntegration && !integrationNames.includes(platform)) {
          errors.push(
            `Action "${action.type}" requires ${platform} integration. ` +
            `Connected integrations: ${integrationNames.join(', ') || 'none'}. ` +
            `Please connect ${platform} in Settings.`
          );
          continue;
       }
       
       // Validate params
       const validation = validateLegacyParams(action.type, action.params);
       if (!validation.valid) {
          errors.push(`Invalid params for "${action.type}": ${validation.errors.join(', ')}`);
       }
       continue;
    }
    
    // 3. Unknown Action
    errors.push(`Unknown action: "${action.type}". Check action name spelling.`);
  }
  
  return errors;
};

const processJob = async (
  job: Job<ExecutionJobData, ExecutionJobResult>
): Promise<ExecutionJobResult> => {
  const { executionId, agentId, ownerId, triggerType, payload } = job.data;
  
  // 1. Mark execution as running
  const execution = await Execution.findById(executionId);
  if (!execution) {
    throw new Error(`Execution not found: ${executionId}`);
  }
  
  execution.status = "running";
  execution.startedAt = new Date();
  await execution.save();
  
  // Emit live update
  SocketService.getInstance().emitToAgent(agentId, "execution:started", {
    executionId: execution._id,
    status: "running"
  });
  
  try {
    // 2-3. Load agent and integrations
    const loaded = await loadAgent(agentId, ownerId);
    
    // Check if agent is paused
    if (loaded.agent.status === "paused") {
      logger.info("Agent is paused, skipping execution", { agentId });
      execution.status = "failed";
      execution.error = "Agent is paused";
      await execution.save();
      return { success: false, actionsExecuted: 0, creditsUsed: 0, error: "Agent is paused" };
    }

    // 4. Fetch recent executions for memory (last 5 successful runs)
    const previousExecutions = await Execution.find({
      agentId,
      status: 'success',
      _id: { $ne: executionId } // Exclude current execution
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name reasoning memory actionsExecuted createdAt')
      .lean();

    // ============================================
    // ITERATIVE EXECUTION STATE
    // ============================================
    // Tracks state across THINK→DECIDE→ACT→OBSERVE→MEMORY→REPLAN loop
    // ============================================
    interface IterativeState {
      iteration: number;
      maxIterations: number;
      actionHistory: any[];
      observations: string[];
      iterativeMemory: MemoryEntry[];  // Changed to structured memory
      shouldContinue: boolean;
      goalAchieved: boolean;
      totalTokensUsed: number;
      
      // DYNAMIC REPLANNING fields (new)
      currentDecision: string;         // Current replan decision
      recoveryAttempts: number;        // Number of recovery attempts
      maxRecoveryAttempts: number;     // Max recovery attempts before abort
      lastError?: string;              // Last error encountered
      adjustmentsMade: string[];       // List of adjustments made
    }
    
    const iterativeState: IterativeState = {
      iteration: 1,
      maxIterations: loaded.agent.settings?.maxIterations || 10, // Configurable max iterations
      actionHistory: [],
      observations: [],
      iterativeMemory: [],  // Initialize as empty array
      shouldContinue: true,
      goalAchieved: false,
      totalTokensUsed: 0,
      
      // Initialize replanning state
      currentDecision: 'CONTINUE',
      recoveryAttempts: 0,
      maxRecoveryAttempts: 3,  // Max 3 recovery attempts
      adjustmentsMade: []
    };
    
    let allActionResults: any[] = [];
    let executionMode: 'one-shot' | 'iterative' = 'one-shot'; // Default to one-shot for backward compatibility
    
    // ============================================
    // MAIN EXECUTION LOOP
    // ============================================
    // Supports both ONE-SHOT and ITERATIVE modes:
    // - ONE-SHOT: AI returns actions[], execute all, exit loop
    // - ITERATIVE: AI returns action + continue flag, loop until done
    // ============================================
    while (iterativeState.shouldContinue && iterativeState.iteration <= iterativeState.maxIterations) {
      logger.info(`Execution iteration ${iterativeState.iteration}/${iterativeState.maxIterations}`, {
        executionId,
        mode: executionMode
      });
      
      // THINK: Build context with current state
      const context = iterativeState.iteration === 1
        ? buildContext(loaded, triggerType, payload, previousExecutions)
        : buildIterativeContext(
            loaded,
            triggerType,
            payload,
            iterativeState.iteration,
            iterativeState.maxIterations,
            iterativeState.actionHistory,
            iterativeState.observations,
            iterativeState.iterativeMemory,
            previousExecutions
          );
      
      const systemPrompt = buildSystemPrompt(loaded, context);
      
      // Store prompt for debugging (first iteration only)
      if (iterativeState.iteration === 1) {
        execution.aiPrompt = systemPrompt;
      }
      
      // DECIDE: Call AI
      const maxTokens = Math.max(loaded.agent.brain.maxTokens || 4096, 4096);
      
      const aiResponse = await callAI(
        systemPrompt,
        loaded.agent.brain.model,
        loaded.agent.brain.temperature,
        maxTokens
      );
      
      iterativeState.totalTokensUsed += aiResponse.tokensUsed;
      
      // Store AI response and reasoning (first iteration only)
      if (iterativeState.iteration === 1) {
        execution.aiResponse = aiResponse.rawResponse;
        execution.aiTokensUsed = aiResponse.tokensUsed;
        
        if (aiResponse.reasoning) {
          execution.reasoning = aiResponse.reasoning;
        }
        
        if (aiResponse.executionName) {
          execution.name = aiResponse.executionName;
        }
      }
      
      // DETECT MODE: Check if AI returned one-shot or iterative response
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        // ============================================
        // ONE-SHOT MODE (backward compatible)
        // ============================================
        // AI returned multiple actions - execute all at once
        // ============================================
        executionMode = 'one-shot';
        logger.info("Executing in ONE-SHOT mode", { actionsCount: aiResponse.actions.length });
        
        // Validate actions before execution
        const validationErrors = validateActions(aiResponse.actions, loaded);
        if (validationErrors.length > 0) {
          execution.status = "failed";
          execution.error = `Action validation failed: ${validationErrors.join('; ')}`;
          execution.finishedAt = new Date();
          await execution.save();
          
          SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
            executionId: execution._id,
            status: "failed",
            error: execution.error
          });
          
          return {
            success: false,
            actionsExecuted: 0,
            creditsUsed: 0,
            error: execution.error
          };
        }
        
        // Execute all actions
        const actionResults = await executeActions(
          aiResponse.actions,
          loaded,
          loaded.agent.actions,
          executionId,
          agentId
        );
        
        allActionResults = actionResults;
        
        // Persist memory from AI response (structured memory)
        if (aiResponse.memory && Array.isArray(aiResponse.memory)) {
          execution.memory = aiResponse.memory as any;  // Store as array
        }
        
        // Exit loop after one-shot execution
        break;
        
      } else if (aiResponse.action) {
        // ============================================
        // ITERATIVE MODE (new - THINK→DECIDE→ACT→OBSERVE→MEMORY→REPLAN)
        // ============================================
        // AI returned single action with continuation control
        // ============================================
        executionMode = 'iterative';
        logger.info("Executing in ITERATIVE mode", {
          iteration: iterativeState.iteration,
          action: aiResponse.action.type,
          continue: aiResponse.continue
        });
        
        // Validate single action
        const validationErrors = validateActions([aiResponse.action], loaded);
        if (validationErrors.length > 0) {
          // Action validation failed - store error and continue to next iteration
          logger.warn("Action validation failed in iteration", {
            iteration: iterativeState.iteration,
            errors: validationErrors
          });
          
          iterativeState.actionHistory.push({
            type: aiResponse.action.type,
            params: aiResponse.action.params,
            error: validationErrors.join('; '),
            startedAt: new Date(),
            finishedAt: new Date()
          });
          
          iterativeState.observations.push(
            aiResponse.observation || `Action validation failed: ${validationErrors.join('; ')}`
          );
          
          // Continue to next iteration (AI can adapt)
          iterativeState.iteration++;
          continue;
        }
        
        // ACT: Execute single action
        const { executeSingleAction } = await import("./actionExecutor");
        const actionResult = await executeSingleAction(
          aiResponse.action,
          loaded,
          loaded.agent.actions,
          executionId,
          agentId
        );
        
        // OBSERVE: Store result and create system memory entry
        iterativeState.actionHistory.push(actionResult);
        allActionResults.push(actionResult);
        
        // Add system memory entry for action result
        const systemMemoryEntry: MemoryEntry = actionResult.error ? {
          source: 'system',
          timestamp: new Date().toISOString(),
          type: 'error',
          payload: {
            action: actionResult.type,
            error: actionResult.error,
            params: actionResult.params
          }
        } : {
          source: 'system',
          timestamp: new Date().toISOString(),
          type: 'fact',
          payload: {
            action: actionResult.type,
            result: actionResult.result
          }
        };
        
        iterativeState.iterativeMemory.push(systemMemoryEntry);
        
        // Store AI's observation
        if (aiResponse.observation) {
          iterativeState.observations.push(aiResponse.observation);
        }
        
        // MEMORY: Append AI's memory entries
        if (aiResponse.memory && Array.isArray(aiResponse.memory)) {
          iterativeState.iterativeMemory.push(...aiResponse.memory);
        }
        
        // ============================================
        // REPLAN: Handle decision
        // ============================================
        // AI must choose: CONTINUE | ADJUST | RECOVER | ABORT
        // If no decision provided, infer from action result
        const decision = aiResponse.replanDecision || (actionResult.error ? 'RECOVER' : 'CONTINUE');
        iterativeState.currentDecision = decision;
        
        logger.info('Replanning decision', {
          decision,
          reason: aiResponse.replanReason,
          iteration: iterativeState.iteration,
          recoveryAttempts: iterativeState.recoveryAttempts
        });
        
        switch (decision) {
          case 'CONTINUE':
            // Goal on track, proceed with plan
            logger.info('CONTINUE: Proceeding as planned', {
              reason: aiResponse.replanReason
            });
            
            iterativeState.shouldContinue = aiResponse.continue ?? true;
            iterativeState.goalAchieved = aiResponse.goalAchieved ?? false;
            iterativeState.recoveryAttempts = 0;  // Reset recovery counter
            break;
          
          case 'ADJUST':
            // Minor adjustment needed
            logger.info('ADJUST: Modifying approach', {
              reason: aiResponse.replanReason,
              adjustments: aiResponse.adjustments
            });
            
            // Store adjustments
            if (aiResponse.adjustments) {
              iterativeState.adjustmentsMade.push(...aiResponse.adjustments);
              
              iterativeState.iterativeMemory.push({
                source: 'ai',
                timestamp: new Date().toISOString(),
                type: 'decision',
                payload: {
                  decision: 'ADJUST',
                  reason: aiResponse.replanReason,
                  adjustments: aiResponse.adjustments
                }
              });
            }
            
            iterativeState.shouldContinue = true;
            iterativeState.recoveryAttempts = 0;  // Reset recovery counter
            break;
          
          case 'RECOVER':
            // Error occurred, attempt recovery
            iterativeState.recoveryAttempts++;
            
            logger.warn('RECOVER: Attempting recovery', {
              attempt: iterativeState.recoveryAttempts,
              maxAttempts: iterativeState.maxRecoveryAttempts,
              reason: aiResponse.replanReason,
              strategy: aiResponse.recoveryStrategy
            });
            
            // Store recovery attempt
            iterativeState.iterativeMemory.push({
              source: 'system',
              timestamp: new Date().toISOString(),
              type: 'error',
              payload: {
                error: actionResult.error || 'Unknown error',
                recoveryAttempt: iterativeState.recoveryAttempts,
                strategy: aiResponse.recoveryStrategy
              }
            });
            
            // Check if max recovery attempts reached
            if (iterativeState.recoveryAttempts >= iterativeState.maxRecoveryAttempts) {
              logger.error('Max recovery attempts reached, aborting', {
                attempts: iterativeState.recoveryAttempts
              });
              
              iterativeState.currentDecision = 'ABORT';
              iterativeState.shouldContinue = false;
              iterativeState.lastError = `Max recovery attempts (${iterativeState.maxRecoveryAttempts}) exceeded`;
            } else {
              iterativeState.shouldContinue = true;
            }
            break;
          
          case 'ABORT':
            // Unrecoverable error, stop execution
            logger.error('ABORT: Stopping execution', {
              reason: aiResponse.replanReason
            });
            
            // Store abort decision
            iterativeState.iterativeMemory.push({
              source: 'ai',
              timestamp: new Date().toISOString(),
              type: 'decision',
              payload: {
                decision: 'ABORT',
                reason: aiResponse.replanReason
              }
            });
            
            iterativeState.shouldContinue = false;
            iterativeState.goalAchieved = false;
            iterativeState.lastError = aiResponse.replanReason || 'Execution aborted by AI';
            break;
          
          default:
            // Unknown decision, default to CONTINUE
            logger.warn('Unknown replan decision, defaulting to CONTINUE', { decision });
            iterativeState.shouldContinue = aiResponse.continue ?? true;
            iterativeState.goalAchieved = aiResponse.goalAchieved ?? false;
        }
        
        // Move to next iteration
        iterativeState.iteration++;
        
      } else {
        // No actions returned - treat as completion
        logger.info("No actions returned by AI, ending execution");
        break;
      }
    }
    
    // Check if we hit max iterations
    if (iterativeState.iteration > iterativeState.maxIterations && !iterativeState.goalAchieved) {
      logger.warn("Execution reached max iterations without goal achievement", {
        executionId,
        maxIterations: iterativeState.maxIterations
      });
    }
    
    // Persist final iterative memory to execution memory
    if (executionMode === 'iterative' && iterativeState.iterativeMemory.length > 0) {
      execution.memory = iterativeState.iterativeMemory as any;  // Store as array
    }
    
    // Calculate and deduct credits
    const creditsUsed = calculateCredits(iterativeState.totalTokensUsed, allActionResults.length);
    const creditDeducted = await deductCredits(ownerId, creditsUsed);
    
    if (!creditDeducted) {
      logger.warn("Insufficient credits", { ownerId, required: creditsUsed });
    }
    
    // Persist results
    execution.actionsExecuted = toExecutionActions(allActionResults);
    execution.creditsUsed = creditsUsed;
    execution.status = "success";
    execution.finishedAt = new Date();
    execution.outputPayload = {
      actionsCount: allActionResults.length,
      tokensUsed: iterativeState.totalTokensUsed,
      creditsUsed,
      executionMode,
      iterations: executionMode === 'iterative' ? iterativeState.iteration - 1 : 1,
      goalAchieved: iterativeState.goalAchieved
    };
    
    // Check for high-risk actions requiring approval
    if (loaded.agent.settings.approvalRequired) {
      const highRiskPrefixes = ["delete", "remove", "archive", "un"];
      const needsApproval = allActionResults.some(r => 
        highRiskPrefixes.some(p => r.type.toLowerCase().includes(p))
      );

      if (needsApproval) {
        execution.status = "pending";
        execution.approvalStatus = "pending";
        await execution.save();
        return { success: true, actionsExecuted: allActionResults.length, creditsUsed };
      }
    }

    // Check if any action failed
    const hasErrors = allActionResults.some(r => r.error);
    if (hasErrors) {
      execution.status = "failed";
      execution.error = "One or more actions failed";
    }
    
    await execution.save();

    // Emit live update
    SocketService.getInstance().emitToAgent(agentId, "execution:completed", {
      executionId: execution._id,
      status: execution.status,
      name: execution.name,
      actionsCount: allActionResults.length,
      executionMode,
      iterations: executionMode === 'iterative' ? iterativeState.iteration - 1 : 1
    });
    
    return {
      success: !hasErrors,
      actionsExecuted: allActionResults.length,
      creditsUsed,
      error: hasErrors ? "One or more actions failed" : undefined
    };
    
  } catch (error: any) {
    // Handle failures
    execution.status = "failed";
    execution.error = error.message;
    execution.errorStack = error.stack;
    execution.finishedAt = new Date();
    execution.retryCount = (execution.retryCount || 0) + 1;
    await execution.save();
    
    throw error; // Re-throw for BullMQ retry logic
  }
};

export const stopWorker = async (): Promise<void> => {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("Worker stopped");
  }
};

export default { startWorker, stopWorker };
