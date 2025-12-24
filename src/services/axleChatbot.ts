import { callChat } from "../worker/aiCaller";
import { ChatSession } from "../models/ChatSession";
import { GodAgentService } from "./GodAgentService";
import { logger } from "./logger";

export class AxleChatbot {
  /**
   * Processes a user message.
   */
  static async processMessage(userId: string, message: string) {
    // 1. Load or create chat session
    let session = await ChatSession.findOne({ userId });
    if (!session) {
      session = await ChatSession.create({ userId, messages: [] });
    }

    // 2. Add user message
    session.messages.push({ role: "user", content: message, timestamp: new Date() });

    // 3. Build system prompt for God Agent
    const dataSummary = await GodAgentService.getDataSummary(userId);
    const systemPrompt = `
      You are the Axle God Agent, the central intelligence of the Axle platform.
      You have access to all user tools, agents, and data.
      
      USER DATA SUMMARY:
      - Agents: ${JSON.stringify(dataSummary.agents.map(a => ({ id: a._id, name: a.name, status: a.status })))}
      - Recent Executions: ${JSON.stringify(dataSummary.recentExecutions.map(e => ({ id: e._id, status: e.status, startedAt: e.startedAt })))}
      
      YOUR CAPABILITIES:
      1. Execute Tools: Call any tool in the Axle registry (prefix with integration e.g., github_, slack_).
      2. Manage Agents: Pause, resume, or delete agents.
      3. Explain Data: Answer questions about agent history, logs, or blueprints.
      
      INSTRUCTIONS:
      - You are chatting with the user. Be helpful, concise, and professional.
      - If the user asks to perform an action, generate the corresponding action in the "actions" array.
      - Supported actions: 
        - Tool execution: { "type": "tool_name", "params": { ... } }
        - Agent management: { "type": "manage_agent", "params": { "agentId", "action": "pause" | "resume" | "delete" } }
    `;

    try {
      // 4. Prepare Context (Last 20 messages)
      // Map session messages to OpenAI format
      const history = session.messages.slice(-20).map(m => ({
        role: m.role,
        content: m.content
      }));

      // 5. Call AI
      // We pass the system prompt as the first message for context
      const messages = [
        { role: "system", content: systemPrompt },
        ...history
      ];
      
      const aiResponse = await callChat(messages, "google/gemini-2.0-flash-001", 0.5);
      
      let actionResult = null;

      // 6. Execute actions if requested
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        // Execute sequentially for now
        for (const action of aiResponse.actions) {
             if (action.type === "manage_agent") {
                actionResult = await GodAgentService.manageAgent(
                    userId,
                    action.params.agentId,
                    action.params.action
                );
             } else {
                actionResult = await GodAgentService.executeTool(
                    userId,
                    action.type,
                    action.params
                );
             }
        }
      }

      // 7. Add assistant message and save session
      session.messages.push({
        role: "assistant",
        content: aiResponse.response,
        timestamp: new Date(),
        metadata: { 
            action: aiResponse.actions?.[0], // Legacy support for single action UI
            result: actionResult 
        }
      });
      session.lastInteractionAt = new Date();
      await session.save();

      return {
        response: aiResponse.response,
        actionResult,
        sessionId: session._id
      };
    } catch (error: any) {
      logger.error("Chatbot processing failed", { error: error.message });
      throw error;
    }
  }
}
