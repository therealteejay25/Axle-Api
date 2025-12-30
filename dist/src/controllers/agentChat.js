"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAgentConversationsController = exports.getAgentConversationController = exports.chatWithAgentController = void 0;
const Agent_1 = require("../models/Agent");
const agentRunner_1 = require("../services/agentRunner");
const logger_1 = require("../lib/logger");
const zod_1 = require("zod");
const ChatMessageSchema = zod_1.z.object({
    message: zod_1.z.string().min(1),
    threadId: zod_1.z.string().optional(), // If provided, continues existing conversation
});
/**
 * Chat with a specific agent (conversational interface).
 * Maintains conversation history per thread.
 */
const chatWithAgentController = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const correlationId = req.correlationId;
    try {
        // Validate input
        const validated = ChatMessageSchema.parse(req.body);
        const { message, threadId } = validated;
        // Get agent from database
        const agent = await Agent_1.Agent.findById(id);
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
        const finalThreadId = threadId ||
            `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        let conversation = agent.chatbot.conversations.find((c) => c.threadId === finalThreadId);
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
            .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.content}`)
            .join("\n");
        const contextualPrompt = `You are ${agent.name}${agent.description ? ` - ${agent.description}` : ""}.

Previous conversation:
${conversationHistory}

Current user message: ${message}

Respond naturally and helpfully. Use your tools and capabilities to assist the user.`;
        // Run agent with contextual prompt
        const result = await (0, agentRunner_1.runAgentById)(userId, id, contextualPrompt);
        // Extract agent's response (could be from result.message, result.text, or result itself)
        const agentResponse = result?.message ||
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
        logger_1.logger.info(`[${correlationId}] Agent chat completed: ${id}, thread: ${finalThreadId}`);
        res.json({
            threadId: finalThreadId,
            response: agentResponse,
            result, // Include full result for debugging/advanced use cases
            conversationLength: conversation.messages.length,
        });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Agent chat failed`, err);
        if (err?.name === "ZodError") {
            return res.status(400).json({
                error: "Validation error",
                details: err?.errors,
            });
        }
        res.status(500).json({ error: "Unable to process chat message" });
    }
};
exports.chatWithAgentController = chatWithAgentController;
/**
 * Get conversation history for an agent thread.
 */
const getAgentConversationController = async (req, res) => {
    const { id, threadId } = req.params;
    const userId = req.userId;
    const correlationId = req.correlationId;
    try {
        const agent = await Agent_1.Agent.findById(id);
        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }
        if (agent.ownerId !== userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        const conversation = agent.chatbot?.conversations?.find((c) => c.threadId === threadId);
        if (!conversation) {
            return res.status(404).json({ error: "Conversation thread not found" });
        }
        res.json({ conversation });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] Get conversation failed`, err);
        res.status(500).json({ error: "Unable to get conversation" });
    }
};
exports.getAgentConversationController = getAgentConversationController;
/**
 * List all conversation threads for an agent.
 */
const listAgentConversationsController = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const correlationId = req.correlationId;
    try {
        const agent = await Agent_1.Agent.findById(id);
        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }
        if (agent.ownerId !== userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        const conversations = agent.chatbot?.conversations?.map((c) => ({
            threadId: c.threadId,
            messageCount: c.messages?.length || 0,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            lastMessage: c.messages && c.messages.length > 0
                ? c.messages[c.messages.length - 1].content.slice(0, 100)
                : null,
        })) || [];
        res.json({ conversations });
    }
    catch (err) {
        logger_1.logger.error(`[${correlationId}] List conversations failed`, err);
        res.status(500).json({ error: "Unable to list conversations" });
    }
};
exports.listAgentConversationsController = listAgentConversationsController;
exports.default = {};
