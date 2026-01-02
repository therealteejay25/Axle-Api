import { callChatStream } from "../worker/aiCaller";
import { ChatSession } from "../models/ChatSession";
import { GodAgentService } from "./GodAgentService";
import { logger } from "./logger";
import { getAvailableToolDefinitions } from "../adapters/toolDefinitions";

export class AxleChatbot {
  /**
   * Processes a user message and yields SSE events.
   */
  static async *processMessageStream(userId: string, message: string): AsyncGenerator<{ type: string; data: any }, void, unknown> {
    // 1. Load or create chat session
    let session = await ChatSession.findOne({ userId });
    if (!session) {
      session = await ChatSession.create({ userId, messages: [] });
    }

    // 2. Add user message
    session.messages.push({ role: "user", content: message, timestamp: new Date() });

    // 3. Keep latest 20 messages
    const history = session.messages.slice(-20).map(m => ({
      role: m.role,
      content: m.content
    }));

    // 4. Build system prompt
    const dataSummary = await GodAgentService.getDataSummary(userId);

    const connectedIntegrations = (dataSummary.integrations || []).map((i: any) => i.provider);
    const availableTools = getAvailableToolDefinitions(connectedIntegrations).map((t) => ({
      name: t.name,
      description: t.description,
      whenToUse: t.whenToUse,
      parameters: t.parameters,
      provider: (t as any).provider,
      capability: (t as any).capability
    }));

    const toolMemory = Array.isArray((session.context as any)?.toolMemory)
      ? ((session.context as any).toolMemory as any[]).slice(-10)
      : [];

    const systemPrompt = `
      You are the Axle God Agent.
      
      CONTEXT:
      - Agents: ${JSON.stringify(dataSummary.agents.map(a => ({ id: a._id.toString(), name: a.name, status: a.status }))) }
      - Executions: ${JSON.stringify(dataSummary.recentExecutions.slice(0, 3).map(e => ({ status: e.status }))) }
      - Connected integrations: ${JSON.stringify((dataSummary.integrations || []).map((i: any) => ({ provider: i.provider, status: i.status, tokenExpiresAt: i.tokenExpiresAt, scopes: i.scopes, lastUsedAt: i.lastUsedAt }))) }
      - Tool memory (recent tool calls and results): ${JSON.stringify(toolMemory) }
      
      CAPABILITIES:
      You can call tools. To call a tool, output a single line JSON block wrapped in tags:
      <tool>{"type": "tool_name", "params": {...}}</tool>

      TOOLING RULES:
      - Only call tools listed in AVAILABLE_TOOLS.
      - Params MUST match the tool schema exactly (use only listed keys, and required fields must be present).
      - If you need missing information, call a READ tool first.
      - For destructive actions, ask the user for confirmation by calling the tool with {"confirmed": true} only after they agree.
      
      AVAILABLE_TOOLS:
      - manage_agent: {"agentId": string, "action": "pause"|"resume"|"delete"}
      - ${JSON.stringify(availableTools)}
      
      INSTRUCTIONS:
      - Stream your thought process naturally to the user.
      - When ready to act, output the <tool> JSON block on a new line.
      - Do NOT output markdown code blocks for the JSON. Just the raw tags.
    `;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history
    ];

    let fullResponse = "";
    let buffer = "";

    try {
      const stream = callChatStream(messages);

      for await (const chunk of stream) {
        buffer += chunk;
        
        // Check for complete <tool>...</tool> block
        // We use a loop to handle multiple tools or text + tool in one chunk
        while (true) {
          const startIdx = buffer.indexOf("<tool>");
          const endIdx = buffer.indexOf("</tool>");

          if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
             // 1. Flush pre-tool text
             const textBefore = buffer.slice(0, startIdx);
             if (textBefore) {
                 yield { type: "text", data: textBefore };
                 fullResponse += textBefore;
             }
             
             // 2. Process Tool
             const rawTool = buffer.slice(startIdx + 6, endIdx); // 6 = len("<tool>")
             try {
                const action = JSON.parse(rawTool);
                yield { type: "tool_start", data: { tool: action.type, params: action.params } };

                let result;
                if (action.type === "manage_agent") {
                    result = await GodAgentService.manageAgent(userId, action.params.agentId, action.params.action);
                } else {
                    result = await GodAgentService.executeTool(userId, action.type, action.params);
                }

                // Persist lightweight tool memory for better multi-turn reasoning
                const nextToolMemory = Array.isArray((session.context as any)?.toolMemory)
                  ? ([...((session.context as any).toolMemory as any[]), { tool: action.type, params: action.params, result, timestamp: new Date() }])
                  : ([{ tool: action.type, params: action.params, result, timestamp: new Date() }]);
                (session.context as any).toolMemory = nextToolMemory.slice(-20);
                
                yield { type: "tool_result", data: { tool: action.type, result } };

             } catch (e: any) {
                yield { type: "tool_error", data: { error: e.message, raw: rawTool } };
             }

             // 3. Remove processed part from buffer
             buffer = buffer.slice(endIdx + 7); // 7 = len("</tool>")

          } else if (startIdx === -1) {
              // No tool start tag in buffer, safe to flush text
              // BUT be careful not to flush partial "<tool" at the end
              // Simple heuristic: flush everything up to the last "<"
              const lastBracket = buffer.lastIndexOf("<");
              if (lastBracket !== -1) {
                  const safeText = buffer.slice(0, lastBracket);
                  if (safeText) {
                      yield { type: "text", data: safeText };
                      fullResponse += safeText;
                      buffer = buffer.slice(lastBracket);
                  }
                  // Break loop to wait for more chunks to complete the tag
                  break; 
              } else {
                  // No tags, flush all
                  yield { type: "text", data: buffer };
                  fullResponse += buffer;
                  buffer = "";
                  break;
              }
          } else {
              // We have a start tag but no end tag yet
              // Flush text before start tag
              if (startIdx > 0) {
                  const textBefore = buffer.slice(0, startIdx);
                  yield { type: "text", data: textBefore };
                  fullResponse += textBefore;
                  buffer = buffer.slice(startIdx);
              }
              // Wait for more chunks
              break;
          }
        }
      }
      
      // Flush remaining buffer
      if (buffer) {
          yield { type: "text", data: buffer };
          fullResponse += buffer;
      }

      // Save Assistant Response
      session.messages.push({
        role: "assistant", 
        content: fullResponse, 
        timestamp: new Date()
      });
      session.lastInteractionAt = new Date();
      await session.save();

      yield { type: "done", data: {} };

    } catch (err: any) {
      logger.error("Stream failed", err);
      yield { type: "error", data: err.message };
    }
  }
}
