"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const router = (0, express_1.Router)();
// Initialize Anthropic Claude client
const client = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
});
/**
 * POST /api/chat
 * Simple chat endpoint for testing
 *
 * Body:
 * {
 *   "message": "Your question here"
 * }
 */
router.post("/", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({
                success: false,
                error: "Message is required",
            });
        }
        // Call Claude API
        const response = await client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 2000,
            messages: [
                {
                    role: "user",
                    content: message,
                },
            ],
        });
        const content = response.content[0]?.type === "text" ? response.content[0].text : "";
        return res.json({
            success: true,
            data: {
                message: content,
                model: response.model,
                usage: {
                    input_tokens: response.usage?.input_tokens,
                    output_tokens: response.usage?.output_tokens,
                },
            },
        });
    }
    catch (error) {
        console.error("Chat error:", error);
        return res.status(500).json({
            success: false,
            error: error?.message || "Failed to get chat response",
        });
    }
});
/**
 * POST /api/chat/stream
 * Streaming chat endpoint for testing
 *
 * Body:
 * {
 *   "message": "Your question here"
 * }
 */
router.post("/stream", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({
                success: false,
                error: "Message is required",
            });
        }
        // Set headers for streaming
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        // Call Claude API with streaming
        const stream = await client.messages.stream({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 2000,
            messages: [
                {
                    role: "user",
                    content: message,
                },
            ],
        });
        // Stream chunks to client
        for await (const event of stream) {
            if (event.type === "content_block_delta" &&
                event.delta?.type === "text_delta") {
                res.write(`data: ${JSON.stringify({ chunk: event.delta.text })}\n\n`);
            }
        }
        res.write("data: [DONE]\n\n");
        res.end();
    }
    catch (error) {
        console.error("Chat stream error:", error);
        res.write(`data: ${JSON.stringify({
            error: error?.message || "Stream error",
        })}\n\n`);
        res.end();
    }
});
/**
 * POST /api/chat/test
 * Test endpoint to verify Claude connection
 */
router.post("/test", async (req, res) => {
    try {
        const response = await client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 100,
            messages: [
                {
                    role: "user",
                    content: "Say 'Hello! The Axle API is working correctly with Claude.'",
                },
            ],
        });
        return res.json({
            success: true,
            message: "Claude connection successful",
            data: {
                response: response.content[0]?.type === "text" ? response.content[0].text : "",
                model: response.model,
            },
        });
    }
    catch (error) {
        console.error("Test error:", error);
        return res.status(500).json({
            success: false,
            error: error?.message || "Connection test failed",
            apiKeySet: !!process.env.ANTHROPIC_API_KEY || !!process.env.CLAUDE_API_KEY,
        });
    }
});
exports.default = router;
