import { callChatStream } from "../worker/aiCaller";
import { ChatSession } from "../models/ChatSession";
import { GodAgentService } from "./GodAgentService";
import { logger } from "./logger";

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
    const systemPrompt = `
      You are the Axle God Agent.
      
      CONTEXT:
      - Agents: ${JSON.stringify(dataSummary.agents.map(a => ({ id: a._id.toString(), name: a.name, status: a.status })))}
      - Executions: ${JSON.stringify(dataSummary.recentExecutions.slice(0, 3).map(e => ({ status: e.status })))}
      
      CAPABILITIES:
      You can call tools. To call a tool, output a single line JSON block wrapped in tags:
      <tool>{"type": "tool_name", "params": {...}}</tool>
      
      Available Tools:
      - manage_agent (params: agentId, action: "pause"|"resume"|"delete")
      - github_list_repos (params: query)
      - slack_send_message (params: channel, text)
      - google_calendar_list (params: timeMin)
      
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
