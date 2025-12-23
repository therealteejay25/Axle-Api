import OpenAI from "openai";
import { env } from "../config/env";
import { logger } from "../services/logger";

// ============================================
// AI CALLER (OpenRouter via OpenAI SDK)
// ============================================
// Calls AI via OpenRouter using OpenAI-compatible SDK.
// Validates structured JSON response.
// ============================================

export interface AIAction {
  type: string;
  params: Record<string, any>;
}

export interface AIResponse {
  actions: AIAction[];
  executionName?: string; // Human-readable name for the log
  rawResponse: string;
  tokensUsed: number;
}

let _openai: OpenAI | null = null;

const getOpenAICallback = (): OpenAI => {
  if (!_openai) {
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is not set");
    }
    _openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey
    });
  }
  return _openai;
};

export const callAI = async (
  systemPrompt: string,
  model: string = "google/gemini-2.0-flash-001",
  temperature: number = 0.7,
  maxTokens: number = 4096
): Promise<AIResponse> => {
  const startTime = Date.now();
  
  try {
    const openai = getOpenAICallback();
    
    logger.debug("Calling AI via OpenRouter", { model });

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that responds ONLY in valid JSON format. Your response must always be a JSON object with an "executionName" (short human-readable summary of the intent) and an "actions" array.`
        },
        {
          role: "user",
          content: systemPrompt
        }
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
      executionName: (parsed as any).executionName,
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
const parseAIResponse = (rawResponse: string): { actions: AIAction[], executionName?: string } => {
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
    
    return { 
      actions: validActions,
      executionName: parsed.executionName 
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

export default { callAI };
