import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { logger } from "../services/logger";

// ============================================
// AI CALLER (OpenRouter via OpenAI SDK)
// ============================================
// Calls AI via OpenRouter using OpenAI-compatible SDK.
// Validates structured JSON response.
// ============================================

// ============================================
// STRUCTURED MEMORY ENTRY
// ============================================
// Append-only memory entries for tracking facts,
// errors, decisions, and constraints within execution.
// ============================================
export interface MemoryEntry {
  source: 'ai' | 'system' | 'action' | 'user';
  timestamp: string;  // ISO 8601 format
  type: 'fact' | 'error' | 'decision' | 'constraint';
  payload: Record<string, any>;
}

// ============================================
// DYNAMIC REPLANNING
// ============================================
// AI must explicitly choose a decision after each action
// ============================================
export enum ReplanDecision {
  CONTINUE = 'CONTINUE',   // Goal on track, proceed with plan
  ADJUST = 'ADJUST',       // Minor adjustment needed, modify approach
  RECOVER = 'RECOVER',     // Error occurred, attempt recovery
  ABORT = 'ABORT'          // Unrecoverable, stop execution
}

export interface AIAction {
  type: string;
  params: Record<string, any>;
}

// ============================================
// DUAL-MODE AI RESPONSE
// ============================================
// Supports both one-shot and iterative execution:
// - ONE-SHOT: AI returns actions[] array, all executed at once
// - ITERATIVE: AI returns single action + continue flag for loop
// ============================================
export interface AIResponse {
  // ONE-SHOT MODE (backward compatible)
  actions?: AIAction[];
  
  // ITERATIVE MODE fields (single action per iteration)
  action?: AIAction;           // Single action to execute
  observation?: string;        // AI's observation about previous result
  continue?: boolean;          // Should loop continue?
  goalAchieved?: boolean;      // Is the goal achieved?
  
  // DYNAMIC REPLANNING fields (new)
  replanDecision?: ReplanDecision;  // Explicit decision: CONTINUE/ADJUST/RECOVER/ABORT
  replanReason?: string;            // Why this decision was made
  recoveryStrategy?: string;        // If RECOVER, what's the plan
  adjustments?: string[];           // If ADJUST, what changes
  
  // COMMON FIELDS (both modes)
  executionName?: string;
  reasoning?: string;          // AI's decision-making explanation
  memory?: MemoryEntry[];      // Structured memory entries (append-only)
  rawResponse: string;
  tokensUsed: number;
}

let _gemini: GoogleGenerativeAI | null = null;

const normalizeGeminiModel = (model?: string) => {
  // STRICT HARDCODE: Always return gemini-1.5-pro-002 regardless of input
  return "gemini-1.5-pro-002";
};

const getGeminiClient = (): GoogleGenerativeAI => {
  if (!_gemini) {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    _gemini = new GoogleGenerativeAI(apiKey);
  }
  return _gemini;
};

const messagesToPrompt = (messages: any[]) => {
  return (messages || [])
    .map((m) => {
      const role = m?.role || "user";
      const content = typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "");
      return `${role.toUpperCase()}: ${content}`;
    })
    .join("\n\n");
};

export const callAI = async (
  systemPrompt: string,
  model: string = "gemini-1.5-pro-002",
  temperature: number = 0.7,
  maxTokens: number = 4096
): Promise<AIResponse> => {
  const startTime = Date.now();
  
  try {
    const gemini = getGeminiClient();
    const modelId = normalizeGeminiModel(model);

    logger.debug("Calling AI via Gemini", { model: modelId });

    const gModel = gemini.getGenerativeModel({
      model: modelId,
      systemInstruction:
        'You are an AI assistant that responds ONLY in valid JSON format. Your response must always be a JSON object with an "executionName" (short human-readable summary of the intent) and an "actions" array.',
    });

    const response = await gModel.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
      },
    });

    const rawResponse = response.response.text() || "{}";
    const tokensUsed = response.response.usageMetadata?.totalTokenCount || 0;
    
    logger.debug("AI response received", {
      model: modelId,
      tokensUsed,
      latencyMs: Date.now() - startTime
    });
    
    // Parse and validate response
    const parsed = parseAIResponse(rawResponse);
    
    return {
      // One-shot mode fields
      actions: parsed.actions,
      // Iterative mode fields
      action: parsed.action,
      observation: parsed.observation,
      continue: parsed.continue,
      goalAchieved: parsed.goalAchieved,
      // Common fields
      executionName: parsed.executionName,
      reasoning: parsed.reasoning,
      memory: parsed.memory,
      rawResponse,
      tokensUsed
    };
  } catch (error: any) {
    logger.error("AI call failed", {
      error: error.message,
      model,
      latencyMs: Date.now() - startTime
    });
    throw new Error(`AI call failed: ${error.message}`);
  }
};

// ============================================
// MEMORY VALIDATION
// ============================================
// Validates structured memory entries from AI response
// ============================================

// Validate a single memory entry
const validateMemoryEntry = (entry: any): entry is MemoryEntry => {
  return (
    entry &&
    typeof entry === 'object' &&
    ['ai', 'system', 'action', 'user'].includes(entry.source) &&
    typeof entry.timestamp === 'string' &&
    ['fact', 'error', 'decision', 'constraint'].includes(entry.type) &&
    entry.payload &&
    typeof entry.payload === 'object'
  );
};

// Validate and parse memory array from AI response
const validateAndParseMemory = (memory: any): MemoryEntry[] | undefined => {
  if (!Array.isArray(memory)) {
    logger.warn("Memory is not an array, ignoring", { memory });
    return undefined;
  }
  
  const validEntries: MemoryEntry[] = [];
  for (const entry of memory) {
    if (validateMemoryEntry(entry)) {
      validEntries.push(entry);
    } else {
      logger.warn("Invalid memory entry, skipping", { entry });
    }
  }
  
  return validEntries.length > 0 ? validEntries : undefined;
};

// Parse and validate AI response
// Supports DUAL-MODE execution:
// 1. ONE-SHOT: { actions: [...] } - Execute all at once
// 2. ITERATIVE: { action: {...}, continue: true } - Execute one, loop back
const parseAIResponse = (rawResponse: string): { 
  actions: AIAction[], 
  executionName?: string, 
  reasoning?: string, 
  memory?: MemoryEntry[],
  action?: AIAction, 
  observation?: string, 
  continue?: boolean, 
  goalAchieved?: boolean,
  replanDecision?: ReplanDecision,
  replanReason?: string,
  recoveryStrategy?: string,
  adjustments?: string[]
} => {
  try {
    const parsed = JSON.parse(rawResponse);
    
    // Validate structure
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Response is not an object");
    }
    
    // Validate and parse memory if present
    const validatedMemory = parsed.memory ? validateAndParseMemory(parsed.memory) : undefined;
    
    // DETECT MODE: Check for iterative mode first (single action)
    if (parsed.action && typeof parsed.action === "object") {
      // ITERATIVE MODE: Single action with continuation control
      if (!validateAction(parsed.action)) {
        throw new Error("Invalid action in iterative mode");
      }
      
      // Validate replan decision
      let replanDecision = parsed.replanDecision;
      if (replanDecision) {
        const validDecisions = ['CONTINUE', 'ADJUST', 'RECOVER', 'ABORT'];
        if (!validDecisions.includes(replanDecision)) {
          logger.warn('Invalid replan decision, defaulting to CONTINUE', { decision: replanDecision });
          replanDecision = 'CONTINUE';
        }
      }
      
      return {
        actions: [], // Empty for iterative mode
        action: {
          type: parsed.action.type,
          params: parsed.action.params || {}
        },
        observation: parsed.observation,
        continue: parsed.continue ?? false,  // Default to false (stop after one iteration)
        goalAchieved: parsed.goalAchieved ?? false,
        replanDecision: replanDecision as ReplanDecision,
        replanReason: parsed.replanReason,
        recoveryStrategy: parsed.recoveryStrategy,
        adjustments: parsed.adjustments,
        executionName: parsed.executionName,
        reasoning: parsed.reasoning,
        memory: validatedMemory
      };
    }
    
    // ONE-SHOT MODE: Multiple actions (backward compatible)
    if (!Array.isArray(parsed.actions)) {
      // If no actions array but has action-like properties, wrap it
      if (parsed.type && parsed.params) {
        return { actions: [parsed], executionName: parsed.executionName, reasoning: parsed.reasoning, memory: validatedMemory };
      }
      return { actions: [], executionName: parsed.executionName, reasoning: parsed.reasoning, memory: validatedMemory };
    }
    
    // Validate each action in one-shot mode
    const validActions: AIAction[] = [];
    for (const action of parsed.actions) {
      if (validateAction(action)) {
        validActions.push({
          type: action.type,
          params: action.params || {}
        });
      } else {
        logger.warn("Invalid action in AI response", { action });
      }
    }
    
    return { 
      actions: validActions,
      executionName: parsed.executionName,
      reasoning: parsed.reasoning,
      memory: validatedMemory
    };
  } catch (error: any) {
    logger.error("Failed to parse AI response", { 
      error: error.message,
      rawResponse: rawResponse.substring(0, 500)
    });
    throw new Error(`Invalid AI response: ${error.message}`);
  }
};

// Validate a single action
const validateAction = (action: any): boolean => {
  if (!action || typeof action !== "object") return false;
  if (typeof action.type !== "string" || action.type.trim() === "") return false;
  if (action.params !== undefined && typeof action.params !== "object") return false;
  return true;
};


export const callChat = async (
  messages: any[],
  model: string = "gemini-1.5-pro-002",
  temperature: number = 0.7
): Promise<{ response: string; actions?: AIAction[] }> => {
  const startTime = Date.now();
  
  try {
    const gemini = getGeminiClient();
    const modelId = normalizeGeminiModel(model);
    
    // Add system instruction for JSON format if not present
    const systemInstruction = `
      You are an AI assistant.
      RESPONSE FORMAT:
      You MUST respond with a valid JSON object containing:
      1. "response": A conversational string response to the user.
      2. "actions": An optional array of actions to execute (if any).
    `;

    // Ensure we don't duplicate system prompt if one exists, but effectively we want to enforce JSON
    // Best practice: Prepend a system message or append to the last user message if needed.
    // Here we'll just prepend a system message.
    
    const prompt = `${systemInstruction}\n\n${messagesToPrompt(messages)}`;

    logger.debug("Calling Chat AI", { model: modelId, messageCount: (messages || []).length });

    const gModel = gemini.getGenerativeModel({
      model: modelId,
      systemInstruction,
    });

    const completion = await gModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    });

    const rawResponse = completion.response.text() || "{}";
    
    let parsed;
    try {
        parsed = JSON.parse(rawResponse);
    } catch (e) {
        // Fallback if model fails to return JSON
        return { response: rawResponse, actions: [] };
    }

    return {
        response: parsed.response || "I processed your request.",
        actions: Array.isArray(parsed.actions) ? parsed.actions : (parsed.action ? [parsed.action] : [])
    };

  } catch (error: any) {
    logger.error("Chat AI call failed", { error: error.message, latencyMs: Date.now() - startTime });
    throw error;
  }
};

export const callChatStream = async function* (
  messages: any[],
  model: string = "gemini-1.5-pro-002",
  temperature: number = 0.7
): AsyncGenerator<string, void, unknown> {
  try {
    const gemini = getGeminiClient();
    const modelId = normalizeGeminiModel(model);

    logger.debug("Calling Chat AI (Stream)", { model: modelId, messageCount: messages.length });

    const prompt = messagesToPrompt(messages);
    const gModel = gemini.getGenerativeModel({ model: modelId });
    const stream = await gModel.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature },
    });

    for await (const chunk of stream.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (error: any) {
    logger.error("Chat AI stream failed", { error: error.message });
    throw error;
  }
};

export default { callAI, callChat, callChatStream };

