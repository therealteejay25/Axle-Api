import { callAI } from "../worker/aiCaller";
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
      - Respond in JSON format.
      - If you decide to perform an action, include an "action" field with "type" and "params".
      - "type" for tool execution: the full tool name (e.g., "slack_send_message").
      - "type" for agent management: "manage_agent" with "params": { "agentId", "action": "pause" | "resume" | "delete" }.
      - Include a "response" field with a human-friendly message for the user.
      
      Example:
      {
        "response": "I've paused the GitHub Monitoring agent for you.",
        "action": { "type": "manage_agent", "params": { "agentId": "...", "action": "pause" } }
      }
    `;

    try {
      // 4. Call AI
      const aiResponse = await callAI(systemPrompt, "google/gemini-2.0-flash-001", 0.5);
      const parsed = JSON.parse(aiResponse.rawResponse);

      let actionResult = null;

      // 5. Execute action if requested
      if (parsed.action) {
        if (parsed.action.type === "manage_agent") {
          actionResult = await GodAgentService.manageAgent(
            userId,
            parsed.action.params.agentId,
            parsed.action.params.action
          );
        } else {
          actionResult = await GodAgentService.executeTool(
            userId,
            parsed.action.type,
            parsed.action.params
          );
        }
      }

      // 6. Add assistant message and save session
      session.messages.push({
        role: "assistant",
        content: parsed.response,
        timestamp: new Date(),
        metadata: { action: parsed.action, result: actionResult }
      });
      session.lastInteractionAt = new Date();
      await session.save();

      return {
        response: parsed.response,
        actionResult,
        sessionId: session._id
      };
    } catch (error: any) {
      logger.error("Chatbot processing failed", { error: error.message });
      throw error;
    }
  }
}
