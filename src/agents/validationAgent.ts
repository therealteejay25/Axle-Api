import { ValidationRequest, ValidationResponse } from "../utils/agentTypes";
import { AIService } from "../services/aiService";

export class ValidationAgent {
  private aiService: AIService;
  private readonly COMMAND_TYPES = [
    "script", // Script generation and execution
    "general", // Generic AI commands and repo edits
    "pr", // Pull request operations
    "cron", // Scheduled tasks
    "cicd", // CI/CD operations
  ] as const;

  constructor() {
    this.aiService = new AIService();
  }

  private buildPrompt(request: ValidationRequest): string {
    const { prompt, context } = request;

    let systemPrompt = `You are a command validation agent. Your task is to:
1. Analyze the user's command
2. Classify it into one of these categories: ${this.COMMAND_TYPES.join(", ")}
3. Provide a confidence score (0-1)
4. Extract relevant metadata

Context:
- Script: Code generation, automation scripts, file operations
- General: AI assistance, code explanations, simple edits
- PR: Creating, reviewing, or merging pull requests
- Cron: Scheduling recurring tasks, automated jobs
- CICD: Testing, building, deploying code

Command to analyze: "${prompt}"
`;

    if (context) {
      systemPrompt += `\nRepository Context:
Owner: ${context.owner}
Repo: ${context.repo}
Branch: ${context.branch}
${context.path ? `Path: ${context.path}` : ""}`;
    }

    return systemPrompt;
  }

  private parseAIResponse(response: string): ValidationResponse["data"] {
    try {
      // Remove any markdown formatting if present
      response = response.replace(/```json\n?|\n?```/g, "");
      const parsed = JSON.parse(response);

      if (!this.COMMAND_TYPES.includes(parsed.type as any)) {
        throw new Error(`Invalid command type: ${parsed.type}`);
      }

      return {
        type: parsed.type,
        confidence: parsed.confidence,
        metadata: parsed.metadata || {},
      };
    } catch (err) {
      console.error("Error parsing AI response:", err);
      // Fallback to simple heuristic analysis
      return this.fallbackAnalysis(response);
    }
  }

  private fallbackAnalysis(text: string): ValidationResponse["data"] {
    const lowered = text.toLowerCase();

    // Simple keyword matching with confidence scores
    const matches = {
      script:
        lowered.match(/script|code|generate|create file|automation/g)?.length ||
        0,
      general:
        lowered.match(/explain|help|what|how|analyze|review/g)?.length || 0,
      pr: lowered.match(/pull request|pr|merge|review|branch/g)?.length || 0,
      cron:
        lowered.match(/schedule|cron|periodic|daily|weekly|monthly/g)?.length ||
        0,
      cicd: lowered.match(/test|build|deploy|ci|cd|pipeline/g)?.length || 0,
    };

    const total = Object.values(matches).reduce((a, b) => a + b, 0);
    let maxType = "general" as const;
    let maxScore = 0;

    for (const [type, score] of Object.entries(matches)) {
      if (score > maxScore) {
        maxScore = score;
        maxType = type as any;
      }
    }

    return {
      type: maxType,
      confidence: total > 0 ? maxScore / total : 0.6,
      metadata: { matches },
    };
  }

  async validate(request: ValidationRequest): Promise<ValidationResponse> {
    try {
      const prompt = this.buildPrompt(request);

      const aiResponse = await this.aiService.complete({
        prompt,
        model: request.settings?.aiModel || "gpt-5-mini",
        temperature: 0.3,
        maxTokens: 500,
        format: "json",
        schema: {
          type: "object",
          properties: {
            type: { type: "string", enum: this.COMMAND_TYPES },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            metadata: { type: "object", additionalProperties: true },
          },
          required: ["type", "confidence"],
        },
      });

      const result = this.parseAIResponse(aiResponse);

      return {
        success: true,
        data: result,
      };
    } catch (err) {
      console.error("Validation Agent Error:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
