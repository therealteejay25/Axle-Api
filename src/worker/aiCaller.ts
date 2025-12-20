import OpenAI from "openai";
import { env } from "../config/env";
import { logger } from "../services/logger";

// ============================================
// AI CALLER
// ============================================
// Calls AI and validates structured JSON response.
// AI NEVER makes network calls.
// AI returns structured actions for backend to execute.
// ============================================

export interface AIAction {
  type: string;
  params: Record<string, any>;
}

export interface AIResponse {
  actions: AIAction[];
  rawResponse: string;
  tokensUsed: number;
}

let _openai: OpenAI | null = null;

const getOpenAI = (): OpenAI => {
  if (!_openai) {
    if (!env.OPENAI_KEY) {
      throw new Error("OPENAI_KEY environment variable is not set");
    }
    _openai = new OpenAI({
      apiKey: env.OPENAI_KEY,
      baseURL: env.OPENAI_API_BASE
    });
  }
  return _openai;
};

export const callAI = async (
  systemPrompt: string,
  model: string = "gpt-4o",
  temperature: number = 0.7,
  maxTokens: number = 1024
): Promise<AIResponse> => {
  const startTime = Date.now();
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt }
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    });
    
    const rawResponse = response.choices[0]?.message?.content || "{}";
    const tokensUsed = response.usage?.total_tokens || 0;
    
    logger.debug("AI response received", {
      model,
      tokensUsed,
      latencyMs: Date.now() - startTime
    });
    
    // Parse and validate response
    const parsed = parseAIResponse(rawResponse);
    
    return {
      actions: parsed.actions,
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

// Parse and validate AI response
const parseAIResponse = (rawResponse: string): { actions: AIAction[] } => {
  try {
    const parsed = JSON.parse(rawResponse);
    
    // Validate structure
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Response is not an object");
    }
    
    // Ensure actions array exists
    if (!Array.isArray(parsed.actions)) {
      // If no actions array but has action-like properties, wrap it
      if (parsed.type && parsed.params) {
        return { actions: [parsed] };
      }
      return { actions: [] };
    }
    
    // Validate each action
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
    
    return { actions: validActions };
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

export default { callAI };
