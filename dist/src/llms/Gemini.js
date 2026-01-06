"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiLlm = void 0;
const generative_ai_1 = require("@google/generative-ai");
class GeminiLlm {
    client;
    modelName;
    constructor(opts) {
        this.client = new generative_ai_1.GoogleGenerativeAI(opts.apiKey);
        this.modelName = opts.model;
    }
    async *generateContentAsync(request, stream = false) {
        const model = this.client.getGenerativeModel({
            model: this.modelName,
        });
        // ADK already assembled contents + tools for you
        const response = await model.generateContent({
            contents: request.contents,
            generationConfig: request.config,
            tools: request.toolsDict
                ? Object.values(request.toolsDict).map((t) => t.toOpenApi?.())
                : undefined,
        });
        yield {
            content: {
                parts: [{ text: response.response.text() }],
            },
            partial: false,
        };
    }
}
exports.GeminiLlm = GeminiLlm;
exports.default = GeminiLlm;
