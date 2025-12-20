"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
const openai_1 = require("openai");
class Agent {
    client;
    name;
    instructions;
    model;
    tools;
    maxIterations;
    constructor(config) {
        const apiKey = "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";
        // Ensure OPENAI_API_KEY is set for libraries that look for it
        if (!process.env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = apiKey;
        }
        this.client = new openai_1.OpenAI({
            apiKey: apiKey,
        });
        this.name = config.name;
        this.instructions = config.instructions;
        this.model = config.model || "gpt-4o";
        this.tools = config.tools || [];
        this.maxIterations = config.maxIterations || 10;
    }
    /**
     * Convert our tool format to OpenAI ChatCompletionTool format
     */
    convertToolsToOpenAIFormat() {
        return this.tools.map((tool) => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));
    }
    /**
     * Find and execute a tool by name
     */
    async executeTool(toolName, params, context) {
        const tool = this.tools.find((t) => t.name === toolName);
        if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
        }
        return tool.execute(params, context);
    }
    /**
     * Run the agentic loop
     */
    async run(input, options = {}) {
        const messages = [
            {
                role: "user",
                content: input,
            },
        ];
        let iteration = 0;
        const tools = this.convertToolsToOpenAIFormat();
        while (iteration < this.maxIterations) {
            iteration++;
            // Get response from OpenAI
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages,
                system: this.instructions,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? "auto" : undefined,
            });
            const choice = response.choices[0];
            // If no tool call, return the final response
            if (!choice.message.tool_calls ||
                choice.message.tool_calls.length === 0) {
                return choice.message.content || "No response";
            }
            // Add assistant's response to messages
            messages.push({
                role: "assistant",
                content: choice.message.content || "",
                tool_calls: choice.message.tool_calls,
            });
            // Process each tool call
            for (const toolCall of choice.message.tool_calls) {
                let toolResult;
                try {
                    const params = JSON.parse(toolCall.function.arguments);
                    toolResult = await this.executeTool(toolCall.function.name, params, {
                        ...options.context,
                        userId: options.userId,
                        caller: this.name,
                    });
                }
                catch (error) {
                    toolResult = `Error: ${error.message}`;
                }
                // Add tool result to messages
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult),
                });
            }
        }
        return `Max iterations (${this.maxIterations}) reached`;
    }
}
exports.Agent = Agent;
