import { BaseLlm } from '@google/adk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiLlm {
  private client: GoogleGenerativeAI;
  private modelName: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.client = new GoogleGenerativeAI(opts.apiKey);
    this.modelName = opts.model;
  }

  async *generateContentAsync(
    request: any,
    stream = false
  ): AsyncGenerator<any> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
    });

    // ADK already assembled contents + tools for you
    const response = await model.generateContent({
      contents: request.contents,
      generationConfig: request.config,
      tools: request.toolsDict
        ? Object.values(request.toolsDict).map((t: any) => t.toOpenApi?.())
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

export default GeminiLlm;
export type { GeminiLlm as GeminiLlmType };
