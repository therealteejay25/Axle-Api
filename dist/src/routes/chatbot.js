"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const axleChatbot_1 = require("../services/axleChatbot");
const ChatSession_1 = require("../models/ChatSession");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
/**
 * Handle user messages to the chatbot with STREAMING (SSE).
 */
router.post("/stream", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "message is required" });
        }
        // Set headers for SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const stream = axleChatbot_1.AxleChatbot.processMessageStream(req.user.id, message);
        for await (const event of stream) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        res.end();
    }
    catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
        else {
            res.write(`data: ${JSON.stringify({ type: "error", data: err.message })}\n\n`);
            res.end();
        }
    }
});
/**
 * Handle user messages to the chatbot (Legacy non-stream).
 * Aggregates the SSE stream into a single JSON response so
 * existing frontend clients expecting a simple payload keep working.
 */
router.post("/message", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "message is required" });
        }
        const stream = axleChatbot_1.AxleChatbot.processMessageStream(req.user.id, message);
        let content = "";
        const tools = [];
        for await (const event of stream) {
            if (event.type === "text_delta") {
                content += event.data;
            }
            else if (event.type === "tool_call") {
                // Just track that a tool was called, results come in tool_result
                // For legacy response, we might want to show the tool call details
                tools.push({
                    tool: event.data.tool,
                    params: event.data.params,
                    status: "pending"
                });
            }
            else if (event.type === "tool_result") {
                // Find the pending tool (or just push result)
                const toolIdx = tools.findIndex(t => t.tool === event.data.tool && t.status === "pending");
                if (toolIdx !== -1) {
                    tools[toolIdx].result = event.data.result;
                    tools[toolIdx].status = "success";
                }
                else {
                    tools.push({
                        tool: event.data.tool,
                        result: event.data.result,
                        status: "success"
                    });
                }
            }
            else if (event.type === "tool_error") {
                const toolIdx = tools.findIndex(t => t.tool === event.data.tool && t.status === "pending");
                if (toolIdx !== -1) {
                    tools[toolIdx].error = event.data.error;
                    tools[toolIdx].status = "error";
                }
                else {
                    tools.push({
                        tool: event.data.tool,
                        error: event.data.error,
                        status: "error"
                    });
                }
            }
        }
        res.json({
            message: {
                role: "assistant",
                content,
                tools
            }
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * Get chat history for the user.
 */
router.get("/history", async (req, res) => {
    try {
        const session = await ChatSession_1.ChatSession.findOne({ userId: req.user.id }).lean();
        res.json({ messages: session?.messages || [] });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * Clear chat history.
 */
router.delete("/history", async (req, res) => {
    try {
        await ChatSession_1.ChatSession.deleteOne({ userId: req.user.id });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
