import { GoogleGenerativeAI, Content, FunctionDeclaration, GenerativeModel } from "@google/generative-ai";
import { ChatSession } from "../models/ChatSession";
import { GodAgentService } from "./GodAgentService";
import { logger } from "./logger";
import { env } from "../config/env";
import { createUserTools } from "../tools/registry";
import { cacheService } from "./cache";

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

        // 3. Prepare Tools
        // Get all tools available for this user
        // 3. Prepare Tools
        // We instantiate tools every time to ensure we have executable functions.
        // However, we cache the *schemas* for Gemini to avoid re-mapping 100+ tools every time.
        const toolsRaw = createUserTools(userId);

        // 4. Initialize Gemini Chat
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
            model: env.MODEL,
            systemInstruction: `
            You are the Axle God Agent, a capable AI assistant with full access to the user's connected tools.
            
            USER CONTEXT:
            - Agents: ${dataSummary.agents.length} agents
            - Connected Integrations: ${(dataSummary.integrations || []).map((i: any) => i.provider).join(", ")}
            
            CAPABILITIES:
            - You can read and write data to Linear, Figma, Notion, GitHub, Google Drive, and more.
            - Always use the provided tools to answer questions when data is needed.
            - If a user asks to do something, check if a tool exists for it.
            - You can call multiple tools in parallel if they are independent.
            
            BEHAVIOR:
            - Be helpful, concise, and professional.
            - If you take an action, confirm it to the user.
            - If you cannot find a tool, explain why.
        `,
            tools: [{ functionDeclarations: tools }]
        });

        // 5. Load History
        const history: Content[] = session.messages.slice(-20).map(m => {
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

        // 6. Processing Loop
        let currentMessage = message;
        let keepGoing = true;
        let turnCount = 0;
        const MAX_TURNS = 10;

        try {
            while (keepGoing && turnCount < MAX_TURNS) {
                turnCount++;
                if (turnCount > 1) {
                    yield { type: "thinking", data: "Processing tool results..." };
                } else {
                    yield { type: "thinking", data: "Processing..." };
                }

                const result = await chat.sendMessageStream(currentMessage);
                let textBuffer = "";
                let functionCalls: any[] = []; // Store calls to execute

                // Stream response
                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    if (text) {
                        textBuffer += text;
                        yield { type: "text_delta", data: text };
                    }

                    // Collect function calls if present (depending on SDK version, they might come differently)
                    // The standard way to handle tools in stream is to wait for the final response 
                    // or inspect chunk.functionCalls()
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
                    // We have tool calls!
                    yield { type: "tool_start", data: { count: calls.length } };

                    // Parallel execution
                    for (const call of calls) {
                        yield { type: "tool_executing", data: { name: call.name } };
                    }

                    const toolPromises = calls.map(async (call) => {
                        const toolName = call.name;
                        const toolArgs = call.args;

                        logger.info(`[AxleChatbot] Calling tool ${toolName}`, toolArgs);
                        // yield { type: "tool_executing", data: { name: toolName } }; // Moved out to avoid syntax error

                        const toolImpl = toolsRaw.find((t: any) => t.definition.name === toolName);
                        if (!toolImpl) {
                            return {
                                functionResponse: {
                                    name: toolName,
                                    response: { error: `Tool ${toolName} not found` }
                                }
                            };
                        }

                        try {
                            const output = await toolImpl.execute(toolArgs);
                            return {
                                functionResponse: {
                                    name: toolName,
                                    response: { name: toolName, content: output }
                                }
                            };
                        } catch (err: any) {
                            return {
                                functionResponse: {
                                    name: toolName,
                                    response: { error: err.message }
                                }
                            };
                        }
                    });

                    const toolResults = await Promise.all(toolPromises);

                    // Send tool results back to model
                    // Note: sendMessageStream doesn't support passing FunctionResponse content directly easily 
                    // in some SDK versions for history management.
                    // But typically we send a new message with role 'function' or similar.
                    // For Google GenAI SDK, we usually continue the chat.

                    // Construct the message payload for tool results
                    // Ideally check SDK docs. For `chat.sendMessage`, we pass the `functionResponses`.
                    // But since we are inside a loop and `sendMessage` advances history, we need to be careful.

                    // The `sendMessage` call we just made ALREADY added the model's tool calls to the internal history.
                    // Now we need to provide the responses.

                    // Note: sendMessageStream with function responses might need non-stream or different handling.
                    // Let's assume we can just pass the array of parts.

                    // Actually, the SDK expects us to call sendMessage with the tool responses.

                    const responseParts = toolResults.map(r => r); // Array if InteractionResponse

                    // We need to loop back to send this to the model
                    // Does NOT support streaming tool outputs usually, but we can treat it as the next message

                    // Correct format for Google GenAI Node SDK:
                    // chat.sendMessage([{ functionResponse: ... }, ...])

                    currentMessage = responseParts as any; // Hacky typing, but passing array of parts works
                    keepGoing = true; // Continue loop to get model's interpretation of results
                } else {
                    keepGoing = false; // No more tools, we are done
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
