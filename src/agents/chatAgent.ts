import { BaseAgent } from "./baseAgent";
import { AgentMessage, AgentContext, AgentConfig } from "./baseAgent";
import { AIService } from "../services/aiService";

interface ConversationMemory {
  context: string[];
  userPreferences: {
    technicalLevel: "beginner" | "intermediate" | "expert";
    preferredExplanationStyle: "detailed" | "concise" | "examples";
    commonQuestions: Set<string>;
    interests: Set<string>;
  };
  interactionHistory: {
    timestamp: Date;
    query: string;
    response: string;
    successful: boolean;
  }[];
}

export class ChatAgent extends BaseAgent {
  private aiService: AIService;
  private conversations: Map<string, ConversationMemory>;
  private readonly MAX_CONTEXT_SIZE = 10;
  private readonly MAX_HISTORY_SIZE = 20;

  constructor(config: AgentConfig) {
    super({
      ...config,
      capabilities: [
        "natural_language_processing",
        "context_understanding",
        "personalization",
        "learning",
        ...config.capabilities,
      ],
    });

    this.aiService = new AIService();
    this.conversations = new Map();
  }

  async chat(userId: string, message: string): Promise<string> {
    try {
      // Initialize or get user's conversation memory
      let memory = this.conversations.get(userId);
      if (!memory) {
        memory = this.initializeConversationMemory();
        this.conversations.set(userId, memory);
      }

      // Analyze user's technical level and preferences from message
      await this.updateUserPreferences(memory, message);

      // Build conversational context
      const context = this.buildContext(memory, message);

      // Generate response
      const response = await this.generateResponse(memory, message, context);

      // Update conversation memory
      this.updateMemory(memory, message, response);

      return response;
    } catch (error) {
      console.error("Chat error:", error);
      return "I apologize, but I'm having trouble understanding. Could you rephrase that in simpler terms?";
    }
  }

  private initializeConversationMemory(): ConversationMemory {
    return {
      context: [],
      userPreferences: {
        technicalLevel: "beginner",
        preferredExplanationStyle: "examples",
        commonQuestions: new Set(),
        interests: new Set(),
      },
      interactionHistory: [],
    };
  }

  private async updateUserPreferences(
    memory: ConversationMemory,
    message: string
  ) {
    // Analyze message complexity
    const complexity = await this.analyzeComplexity(message);
    if (complexity.technicalTerms > 5) {
      memory.userPreferences.technicalLevel = "expert";
    } else if (complexity.technicalTerms > 2) {
      memory.userPreferences.technicalLevel = "intermediate";
    }

    // Update interests based on topics mentioned
    const topics = await this.extractTopics(message);
    topics.forEach((topic) => memory.userPreferences.interests.add(topic));

    // Track common questions
    if (this.isQuestion(message)) {
      memory.userPreferences.commonQuestions.add(
        this.normalizeQuestion(message)
      );
    }

    // Detect preferred explanation style
    if (message.toLowerCase().includes("example")) {
      memory.userPreferences.preferredExplanationStyle = "examples";
    } else if (message.toLowerCase().includes("detail")) {
      memory.userPreferences.preferredExplanationStyle = "detailed";
    } else if (
      message.toLowerCase().includes("quick") ||
      message.toLowerCase().includes("brief")
    ) {
      memory.userPreferences.preferredExplanationStyle = "concise";
    }
  }

  private buildContext(
    memory: ConversationMemory,
    currentMessage: string
  ): string {
    const context: string[] = [];

    // Add recent conversation context
    context.push(...memory.context.slice(-this.MAX_CONTEXT_SIZE));

    // Add user preferences context
    const prefs = memory.userPreferences;
    context.push(`User is at ${prefs.technicalLevel} technical level.`);
    context.push(
      `User prefers ${prefs.preferredExplanationStyle} explanations.`
    );

    // Add relevant past interactions
    const relevantHistory = this.findRelevantHistory(memory, currentMessage);
    context.push(
      ...relevantHistory.map(
        (h) => `Previously discussed: ${h.query} -> ${h.response}`
      )
    );

    return context.join("\n");
  }

  private async generateResponse(
    memory: ConversationMemory,
    message: string,
    context: string
  ): Promise<string> {
    const prompt = this.buildPrompt(memory.userPreferences, message, context);

    const response = await this.aiService.complete({
      prompt,
      options: {
        temperature: 0.7,
        format: "json",
        schema: {
          type: "object",
          properties: {
            response: { type: "string" },
            explanation: { type: "string" },
            examples: { type: "array", items: { type: "string" } },
            nextSteps: { type: "array", items: { type: "string" } },
          },
          required: ["response"],
        },
      },
    });

    const result = JSON.parse(response);

    // Format response based on user preferences
    return this.formatResponse(result, memory.userPreferences);
  }

  private buildPrompt(
    preferences: ConversationMemory["userPreferences"],
    message: string,
    context: string
  ): string {
    return `You are an expert AI assistant specialized in making complex technical concepts easy to understand. 
Your goal is to help users regardless of their technical expertise.

User Profile:
- Technical Level: ${preferences.technicalLevel}
- Preferred Style: ${preferences.preferredExplanationStyle}
- Interests: ${Array.from(preferences.interests).join(", ")}

Recent Context:
${context}

Current Message: ${message}

Provide a response that:
1. Matches their technical level
2. Uses their preferred explanation style
3. Includes relevant examples
4. Suggests next steps or related topics
5. Uses simple analogies for complex concepts
6. Breaks down complex tasks into simple steps
7. Provides encouragement and positive reinforcement

Response Format:
{
  "response": "Main response in clear, friendly language",
  "explanation": "Additional technical details if needed",
  "examples": ["Practical examples"],
  "nextSteps": ["Suggested next actions"]
}`;
  }

  private formatResponse(
    result: any,
    preferences: ConversationMemory["userPreferences"]
  ): string {
    let response = result.response;

    if (
      preferences.preferredExplanationStyle === "detailed" &&
      result.explanation
    ) {
      response += `\n\nMore Details:\n${result.explanation}`;
    }

    if (
      preferences.preferredExplanationStyle === "examples" &&
      result.examples?.length
    ) {
      response += `\n\nExamples:\n${result.examples
        .map((ex: string) => `- ${ex}`)
        .join("\n")}`;
    }

    if (result.nextSteps?.length) {
      response += `\n\nNext Steps:\n${result.nextSteps
        .map((step: string) => `- ${step}`)
        .join("\n")}`;
    }

    return response;
  }

  private updateMemory(
    memory: ConversationMemory,
    message: string,
    response: string
  ) {
    // Update context
    memory.context.push(`User: ${message}`);
    memory.context.push(`Assistant: ${response}`);

    // Trim context if too long
    if (memory.context.length > this.MAX_CONTEXT_SIZE) {
      memory.context = memory.context.slice(-this.MAX_CONTEXT_SIZE);
    }

    // Update interaction history
    memory.interactionHistory.push({
      timestamp: new Date(),
      query: message,
      response,
      successful: true,
    });

    // Trim history if too long
    if (memory.interactionHistory.length > this.MAX_HISTORY_SIZE) {
      memory.interactionHistory = memory.interactionHistory.slice(
        -this.MAX_HISTORY_SIZE
      );
    }
  }

  private async analyzeComplexity(
    message: string
  ): Promise<{ technicalTerms: number }> {
    // Implement complexity analysis
    const technicalTerms = (
      message.match(
        /\b(api|function|code|database|server|client|git|deploy|component|interface|class|method|variable|framework|library|dependency|middleware|endpoint|request|response|async|promise|callback|iteration|recursion|algorithm|data structure)\b/gi
      ) || []
    ).length;

    return { technicalTerms };
  }

  private async extractTopics(message: string): Promise<string[]> {
    // Extract topics from message
    const topics = new Set<string>();

    const patterns = {
      frontend: /\b(react|vue|angular|html|css|javascript|dom|component|ui|ux)\b/i,
      backend: /\b(api|server|database|sql|node|express|django|flask|rest|graphql)\b/i,
      devops: /\b(docker|kubernetes|aws|azure|ci|cd|deploy|pipeline|container)\b/i,
      general: /\b(programming|coding|software|development|git|github|testing|debug)\b/i,
    };

    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) {
        topics.add(category);
      }
    }

    return Array.from(topics);
  }

  private isQuestion(message: string): boolean {
    return (
      /^(what|how|why|when|where|who|can|could|would|will|do|does|did|is|are|am|should|shouldn't|shall)\b/i.test(
        message
      ) || message.endsWith("?")
    );
  }

  private normalizeQuestion(message: string): string {
    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private findRelevantHistory(
    memory: ConversationMemory,
    currentMessage: string
  ): ConversationMemory["interactionHistory"] {
    return memory.interactionHistory
      .filter((h) => {
        const similarity = this.calculateSimilarity(h.query, currentMessage);
        return similarity > 0.5;
      })
      .slice(-3);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }
}
