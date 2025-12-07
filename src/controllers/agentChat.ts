import { Request, Response } from "express";
import { Agent } from "../models/Agent";
import { runAgentById } from "../services/agentRunner";
import { logger } from "../lib/logger";
import { z } from "zod";

const ChatMessageSchema = z.object({
  message: z.string().min(1),
  threadId: z.string().optional(), // If provided, continues existing conversation
});

/**
 * Chat with a specific agent (conversational interface).
 * Maintains conversation history per thread.
 */
export const chatWithAgentController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;

  try {
    // Validate input
    const validated = ChatMessageSchema.parse(req.body);
    const { message, threadId } = validated;

    // Get agent from database
    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Verify ownership
    if (agent.ownerId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Enable chatbot if not already enabled
    if (!agent.chatbot) {
      agent.chatbot = { enabled: true, conversations: [] };
    }

    // Get or create conversation thread
    const finalThreadId = threadId || `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let conversation = agent.chatbot.conversations.find(
      (c: any) => c.threadId === finalThreadId
    );

    if (!conversation) {
      conversation = {
        threadId: finalThreadId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      agent.chatbot.conversations.push(conversation);
    }

    // Add user message to conversation history
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });
    conversation.updatedAt = new Date();

    // Build context-aware prompt with conversation history
    const conversationHistory = conversation.messages
      .slice(-10) // Last 10 messages for context
      .map((m: any) => `${m.role === "user" ? "User" : "Agent"}: ${m.content}`)
      .join("\n");

    const contextualPrompt = `You are ${agent.name}${agent.description ? ` - ${agent.description}` : ""}.

Previous conversation:
${conversationHistory}

Current user message: ${message}

Respond naturally and helpfully. Use your tools and capabilities to assist the user.`;

    // Run agent with contextual prompt
    const result = await runAgentById(userId, id, contextualPrompt);

    // Extract agent's response (could be from result.message, result.text, or result itself)
    const agentResponse =
      result?.message ||
      result?.text ||
      result?.response ||
      (typeof result === "string" ? result : JSON.stringify(result));

    // Add agent response to conversation history
    conversation.messages.push({
      role: "assistant",
      content: agentResponse,
      timestamp: new Date(),
    });
    conversation.updatedAt = new Date();

    // Save updated conversation
    await agent.save();

    logger.info(
      `[${correlationId}] Agent chat completed: ${id}, thread: ${finalThreadId}`
    );

    res.json({
      threadId: finalThreadId,
      response: agentResponse,
      result, // Include full result for debugging/advanced use cases
      conversationLength: conversation.messages.length,
    });
  } catch (err) {
    logger.error(`[${correlationId}] Agent chat failed`, err);
    if ((err as any)?.name === "ZodError") {
      return res.status(400).json({
        error: "Validation error",
        details: (err as any)?.errors,
      });
    }
    res.status(500).json({ error: "Unable to process chat message" });
  }
};

/**
 * Get conversation history for an agent thread.
 */
export const getAgentConversationController = async (
  req: Request,
  res: Response
) => {
  const { id, threadId } = req.params;
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;

  try {
    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (agent.ownerId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const conversation = agent.chatbot?.conversations?.find(
      (c: any) => c.threadId === threadId
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation thread not found" });
    }

    res.json({ conversation });
  } catch (err) {
    logger.error(`[${correlationId}] Get conversation failed`, err);
    res.status(500).json({ error: "Unable to get conversation" });
  }
};

/**
 * List all conversation threads for an agent.
 */
export const listAgentConversationsController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;

  try {
    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (agent.ownerId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const conversations =
      agent.chatbot?.conversations?.map((c: any) => ({
        threadId: c.threadId,
        messageCount: c.messages?.length || 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        lastMessage:
          c.messages && c.messages.length > 0
            ? c.messages[c.messages.length - 1].content.slice(0, 100)
            : null,
      })) || [];

    res.json({ conversations });
  } catch (err) {
    logger.error(`[${correlationId}] List conversations failed`, err);
    res.status(500).json({ error: "Unable to list conversations" });
  }
};

export default {};

