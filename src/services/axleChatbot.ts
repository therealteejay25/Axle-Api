import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";
import { ChatSession } from "../models/ChatSession";
import { GodAgentService } from "./GodAgentService";
import { logger } from "./logger";
import { env } from "../config/env";
import { getAllGodAgentTools } from "./god-agent-tools";
import { ToolRegistry } from "../capabilities/registry";
import { FunctionTool } from "@google/adk";

import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

// Manual Zod to Gemini Schema Converter
// Robust against version mismatches by using typeName strings
function zodToGeminiSchema(schema: any): any {
  if (!schema || !schema._def) return { type: "object", properties: {} };

  const def = schema._def;
  // Fallback: Zod v3 uses typeName, Zod v4 might use type
  const typeName = def.typeName || (def.type ? `Zod${def.type.charAt(0).toUpperCase() + def.type.slice(1)}` : 'Unknown');

  // Handle Wrappers
  if (typeName === "ZodOptional" || typeName === "ZodNullable") {
    return zodToGeminiSchema(def.innerType);
  }
  if (typeName === "ZodDefault") {
    return zodToGeminiSchema(def.innerType);
  }
  if (typeName === "ZodEffects") {
    return zodToGeminiSchema(def.schema);
  }

  // Base Types
  if (typeName === "ZodString") {
    const s: any = { type: "string" };
    if (schema.description) s.description = schema.description;
    return s;
  }
  if (typeName === "ZodNumber") {
    const s: any = { type: "number" };
    if (schema.description) s.description = schema.description;
    return s;
  }
  if (typeName === "ZodBoolean") {
    const s: any = { type: "boolean" };
    if (schema.description) s.description = schema.description;
    return s;
  }
  if (typeName === "ZodEnum") {
    const s: any = { type: "string", enum: def.values };
    if (schema.description) s.description = schema.description;
    return s;
  }
  if (typeName === "ZodArray") {
    return {
      type: "array",
      items: zodToGeminiSchema(def.type),
      description: schema.description
    };
  }
  if (typeName === "ZodObject") {
    const properties: any = {};
    const required: string[] = [];
    
    // def.shape() is a function in some versions, object in others?
    // Usually def.shape() returns the object.
    const shape = typeof def.shape === 'function' ? def.shape() : def.shape;

    for (const key in shape) {
      const fieldSchema = shape[key];
      properties[key] = zodToGeminiSchema(fieldSchema);
      
      // Determine required: Not Optional, Nullable, or Default
      const fieldDef = fieldSchema._def;
      const fieldTypeName = fieldDef.typeName || (fieldDef.type ? `Zod${fieldDef.type.charAt(0).toUpperCase() + fieldDef.type.slice(1)}` : 'Unknown');
      
      if (fieldTypeName !== "ZodOptional" && 
          fieldTypeName !== "ZodNullable" && 
          fieldTypeName !== "ZodDefault") {
        required.push(key);
      }
    }

    const output: any = { type: "object", properties };
    if (schema.description) output.description = schema.description;
    if (required.length > 0) output.required = required;
    return output;
  }
  if (typeName === "ZodRecord") {
      return { type: "object", description: "key-value pairs" };
  }
  if (typeName === "ZodAny" || typeName === "ZodUnknown") {
      return { type: "object", properties: {}, description: "Any value" };
  }

  // Fallback
  return { type: "string", description: "Unknown type" };
}

function toGeminiTools(tools: FunctionTool[]) {
  const functionDeclarations = tools.map((t: any) => {
    // ADK FunctionTool keeps the Zod schema in definition.parameters or parameters
    const zodSchema = t.definition ? t.definition.parameters : t.parameters;
    
    // Use manual converter
    const jsonSchema = zodToGeminiSchema(zodSchema);

    // Strict safety for Gemini
    if (!jsonSchema.type) jsonSchema.type = "object";
    if (jsonSchema.type === "object" && !jsonSchema.properties) jsonSchema.properties = {};

    return {
      name: t.definition ? t.definition.name : t.name,
      description: t.definition ? t.definition.description : t.description,
      parameters: jsonSchema
    };
  });
  return [{ functionDeclarations }];
}

function getGeminiClient(): GoogleGenerativeAI {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not found");
    return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

export class AxleChatbot {
  /**
   * Processes a user message and yields SSE events with native Gemini Tool Calling.
   */
  static async *processMessageStream(userId: string, message: string): AsyncGenerator<{ type: string; data: any }, void, unknown> {
    // 1. Load or create chat session
    let session = await ChatSession.findOne({ userId });
    if (!session) {
      session = await ChatSession.create({ userId, messages: [] });
    }

    // 2. Prepare Context & Tools
    const dataSummary = await GodAgentService.getDataSummary(userId);
    
    // Build Integration Map for ToolRegistry
    const integrationsMap = new Map();
    (dataSummary.integrations || []).forEach((i: any) => {
        integrationsMap.set(i.provider, {
            ...i,
            // Mocking secure token access for registry - in real app avoid passing full tokens in context if not needed
            // But registry needs them for execution.
            // GodAgentService.executeTool handled this securely.
            // Here we rely on the tools having access to what they need via context.
        });
    });

    // 2a. Platform Tools
    const platformTools = getAllGodAgentTools();
    
    // 2b. Integration Tools (GitHub, X, etc.)
    // We fetch ALL valid tools for the user
    // Note: This could be large. In production, we might want dynamic selection.
    const integrationTools = await ToolRegistry.getToolsForAgent(integrationsMap, ['*']);
    
    const allTools = [...platformTools, ...integrationTools];
    
    // Create a map for execution lookups
    const toolMap = new Map<string, FunctionTool>();
    allTools.forEach(t => toolMap.set(t.name, t));

    // 3. Initialize Gemini Chat
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp", // Using latest capable model
        tools: toGeminiTools(allTools),
        systemInstruction: `
            You are the Axle God Agent.
            You have FULL control over the Axle platform and connected integrations.
            
            USER CONTEXT:
            - Agents: ${dataSummary.agents.length} agents
            - Connected: ${(dataSummary.integrations || []).map((i: any) => i.provider).join(", ")}
            
            BEHAVIOR:
            - You are powerful, helpful, and proactive.
            - Always use tools to fetch real data. Don't guess.
            - If a user asks to do something, PLAN it, then EXECUTE it.
            - Show your thinking process.
        `
    });

    // 4. Load History
    // Convert DB messages to Gemini Content format
    const history: Content[] = session.messages.slice(-20).map(m => {
        // Simple mapping. Complex tool history reconstruction is harder 
        // without storing structure. For now, treating past messages as text.
        // IMPROVEMENT: Store structure in DB to support native history reconstruction.
        return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        };
    });

    const chat = model.startChat({
        history,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
        }
    });

    // 5. Processing Loop
    // We use a loop to handle multiple turns (tool calls) for a single user request
    let currentMessage = message;
    let keepGoing = true;
    let turnCount = 0;
    const MAX_TURNS = 10;

    // Helper to run tool
    const executeTool = async (name: string, args: any) => {
        const tool = toolMap.get(name);
        if (!tool) throw new Error(`Tool ${name} not found`);
        
        // Context for the tool
        const context = {
            userId,
            integrations: integrationsMap,
            executionId: "chat-" + Date.now()
        };
        
        return tool.execute(args, context);
    };

    try {
        while (keepGoing && turnCount < MAX_TURNS) {
            turnCount++;
            yield { type: "thinking", data: "Processing..." };

            const result = await chat.sendMessageStream(currentMessage);
            
            let functionCalls: any[] = [];
            let textBuffer = "";

            // Stream response
            for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) {
                    textBuffer += text;
                    yield { type: "text_delta", data: text };
                }
                
                // Check for function calls in this chunk (Gemini SDK aggregates, but we can inspect parts)
                // Note: standard SDK requires waiting for full response to reliably get calls, 
                // but `chunk.functionCalls` exists if supported by current SDK version.
                // We'll rely on the aggregate response for execution, but could stream intent if available.
            }
            
            const response = await result.response;
            const calls = response.functionCalls();
            
            // Save Assistant Turn (Text only part)
            if (textBuffer) {
                 session.messages.push({
                    role: "assistant",
                    content: textBuffer,
                    timestamp: new Date()
                });
            }

            if (calls && calls.length > 0) {
                yield { type: "text_delta", data: "\n" }; // New line for visual separation
                
                const functionResponses: Part[] = [];

                for (const call of calls) {
                    yield { type: "tool_call", data: { 
                        tool: call.name, 
                        params: call.args 
                    }};

                    let toolResult;
                    try {
                        // yield { type: "tool_stream", data: { tool: call.name, status: "running" } }; 
                        // Visual implementation handled by frontend via tool_call
                        
                        toolResult = await executeTool(call.name, call.args);
                        
                        yield { type: "tool_result", data: { 
                            tool: call.name, 
                            result: toolResult 
                        }};
                        
                    } catch (err: any) {
                        toolResult = { error: err.message };
                        yield { type: "tool_error", data: { 
                            tool: call.name, 
                            error: err.message 
                        }};
                    }

                    // Save Tool Interaction to DB (optional, simplified)
                    // session.messages.push({ role: "tool"... }) - logic needed for full reconstruction

                    functionResponses.push({
                        functionResponse: {
                            name: call.name,
                            response: { result: toolResult }
                        }
                    });
                }

                // Send results back to model
                // Note: sendMessageStream with function responses isn't direct. 
                // We need to advance the chat history manually or use the simpler pattern?
                // Actually `chat` keeps state. We just send the response parts as the next "user" message 
                // (technically it's a 'function' role msg, but SDK handles it via sendMessage).
                // Wait, Gemini SDK `sendMessage` expects UserInput.
                // Providing `functionResponses` is the correct way for the next turn.
                
                // NOTE: We pass the function responses array directly to sendMessage.
                const nextMsg = functionResponses;
                
                // We don't send text 'message' again, we send the function output.
                // The loop handles the re-prompting.
                // However, `sendMessageStream` signature might be tricky with Part[].
                // It accepts string | Array<string | Part>.
                
                // Reset currentMessage to be the function responses
                // This counts as the user 'input' for the next turn in the chat object state machine
                // (representing the function output available for the model).
                currentMessage = nextMsg as any;
                
            } else {
                keepGoing = false;
            }
        }
    } catch (err: any) {
        logger.error("Chat Error", err);
        yield { type: "error", data: err.message };
    } finally {
        // Save session
        await session.save();
        yield { type: "done", data: {} };
    }
  }
}
