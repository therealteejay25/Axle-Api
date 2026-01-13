import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { ChatSession } from "../models/ChatSession";
import { GodAgentService } from "./GodAgentService";
import { logger } from "./logger";
import { env } from "../config/env";

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

    // 2. Prepare Context
    const dataSummary = await GodAgentService.getDataSummary(userId);

    // 3. Initialize Gemini Chat
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro-002", // Using latest capable model
        systemInstruction: `
            You are the Axle God Agent.
            You have FULL control over the Axle platform and connected integrations.
            
            USER CONTEXT:
            - Agents: ${dataSummary.agents.length} agents
            - Connected: ${(dataSummary.integrations || []).map((i: any) => i.provider).join(", ")}
            
            BEHAVIOR:
            - You are powerful, helpful, and proactive.
            - Provide a clear plan and guidance, but do not call tools.
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

    try {
        while (keepGoing && turnCount < MAX_TURNS) {
            turnCount++;
            yield { type: "thinking", data: "Processing..." };

            const result = await chat.sendMessageStream(currentMessage);
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
            void response;
            
            // Save Assistant Turn (Text only part)
            if (textBuffer) {
                session.messages.push({
                    role: "assistant",
                    content: textBuffer,
                    timestamp: new Date()
                });
            }

            keepGoing = false;
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
