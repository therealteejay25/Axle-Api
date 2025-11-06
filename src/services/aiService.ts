import OpenAI from "openai";
import { BaseResponse } from "../utils/agentTypes";

export interface AIRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  format?: "text" | "json";
  schema?: Record<string, any>;
  stop?: string[];
  language?: string;
  systemPrompt?: string;
}

export interface AIResponse extends BaseResponse {
  data?: string;
}

export class AIService {
  private openai: OpenAI;
  private cache: Map<string, { response: string; timestamp: number }>;
  private translations: Map<string, Map<string, string>>;
  private readonly DEFAULT_MODEL = "gpt-5-mini";

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE || "https://api.algion.dev/v1",
    });
    this.cache = new Map();
    this.translations = this.initTranslations();
  }

  private initTranslations(): Map<string, Map<string, string>> {
    // Initialize with some common translations for system messages
    const translations = new Map();

    // English (default)
    const en = new Map([
      [
        "system_intro",
        "You are an AI assistant focused on code and software development.",
      ],
      ["error", "An error occurred"],
      ["processing", "Processing your request"],
      ["success", "Successfully completed"],
      ["invalid_format", "The response format is invalid"],
    ]);
    translations.set("en", en);

    // Spanish
    const es = new Map([
      [
        "system_intro",
        "Eres un asistente de IA enfocado en código y desarrollo de software.",
      ],
      ["error", "Se produjo un error"],
      ["processing", "Procesando su solicitud"],
      ["success", "Completado con éxito"],
      ["invalid_format", "El formato de respuesta no es válido"],
    ]);
    translations.set("es", es);

    // Add more languages as needed

    return translations;
  }

  private getTranslation(key: string, language = "en"): string {
    const langMap =
      this.translations.get(language) || this.translations.get("en")!;
    return langMap.get(key) || key;
  }

  private buildSystemPrompt(options: AIRequestOptions): string {
    const { format, schema, language = "en", systemPrompt } = options;

    let prompt = systemPrompt || this.getTranslation("system_intro", language);
    prompt += "\n\n";

    if (format === "json") {
      prompt += `Please provide your response in JSON format.${
        schema
          ? `\n\nResponse must conform to this schema:\n${JSON.stringify(
              schema,
              null,
              2
            )}`
          : ""
      }`;
    }

    return prompt;
  }

  private async translate(text: string, targetLang: string): Promise<string> {
    if (targetLang === "en") return text;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following text to ${targetLang} while preserving any code blocks or technical terms:`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
      });

      return response.choices[0].message.content?.trim() || text;
    } catch (err) {
      console.error("Translation error:", err);
      return text; // Fallback to original text
    }
  }

  private getCacheKey(prompt: string, options: AIRequestOptions): string {
    // Include relevant options in cache key
    const keyParts = {
      prompt,
      model: options.model,
      temperature: options.temperature,
      format: options.format,
      language: options.language,
    };
    return JSON.stringify(keyParts);
  }

  private isValidResponse(
    response: string,
    options: AIRequestOptions
  ): boolean {
    if (!options.format || options.format === "text") return true;

    if (options.format === "json") {
      try {
        const parsed = JSON.parse(response);
        if (options.schema) {
          // Basic schema validation
          for (const key of options.schema.required || []) {
            if (!(key in parsed)) return false;
          }
          // Type validation for specific fields could be added here
        }
        return true;
      } catch {
        return false;
      }
    }

    return true;
  }

  async complete(request: {
    prompt: string;
    options?: AIRequestOptions;
  }): Promise<string> {
    const options = {
      model: this.DEFAULT_MODEL,
      temperature: 0.7,
      maxTokens: 2000,
      format: "text" as const,
      language: "en",
      ...request.options,
    };

    try {
      const cacheKey = this.getCacheKey(request.prompt, options);
      const cached = this.cache.get(cacheKey);

      // Return cached response if it's less than 5 minutes old
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.response;
      }

      const systemPrompt = this.buildSystemPrompt(options);

      const completion = await this.openai.chat.completions.create({
        model: options.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request.prompt },
        ],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stop: options.stop,
      });

      let response = completion.choices[0].message.content?.trim() || "";

      // Validate response format
      if (!this.isValidResponse(response, options)) {
        throw new Error(
          this.getTranslation("invalid_format", options.language)
        );
      }

      // Translate if needed
      if (options.language !== "en") {
        response = await this.translate(response, options.language);
      }

      // Cache the response
      this.cache.set(cacheKey, {
        response,
        timestamp: Date.now(),
      });

      return response;
    } catch (err) {
      console.error("AI Service Error:", err);
      throw new Error(
        typeof err.message === "string"
          ? err.message
          : this.getTranslation("error", options.language)
      );
    }
  }

  // Utility method to clean up expired cache entries
  cleanCache(maxAge = 30 * 60 * 1000): void {
    // Default 30 minutes
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
  }

  // Initialize cache cleanup interval
  startCacheCleanup(interval = 15 * 60 * 1000): void {
    // Default 15 minutes
    setInterval(() => this.cleanCache(), interval);
  }
}
