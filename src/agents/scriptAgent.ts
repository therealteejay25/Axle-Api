import {
  ScriptRequest,
  ScriptResponse,
  RepoContext,
} from "../utils/agentTypes";
import { AIService } from "../services/aiService";
import { getRepoContents, buildFileIndex } from "../services/githubSevice";

export class ScriptAgent {
  private aiService: AIService;
  private readonly MAX_CONTEXT_SIZE = 10000; // Maximum characters of context to send
  private readonly SUPPORTED_LANGUAGES = [
    "javascript",
    "typescript",
    "python",
    "bash",
    "ruby",
    "go",
  ];

  constructor() {
    this.aiService = new AIService();
  }

  private async getRepoContext(context: RepoContext): Promise<string> {
    try {
      // Get file index if not provided
      if (!context.fileList) {
        context.fileList = await buildFileIndex(
          context.token!,
          context.owner,
          context.repo,
          context.path,
          context.branch
        );
      }

      let contextContent = "";
      let totalSize = 0;

      // Filter and sort files by relevance
      const relevantFiles = context.fileList
        .filter((file) => {
          // Skip non-code files and certain directories
          const skipPatterns = [
            /node_modules/,
            /\.git/,
            /\.(png|jpg|gif|svg|woff|ttf|eot)$/,
            /\.(lock|log)$/,
            /dist/,
            /build/,
          ];
          return !skipPatterns.some((pattern) => file.path.match(pattern));
        })
        .sort((a, b) => {
          // Prioritize configuration and main files
          const aScore = this.getFileRelevanceScore(a.path);
          const bScore = this.getFileRelevanceScore(b.path);
          return bScore - aScore;
        });

      // Get contents of most relevant files
      for (const file of relevantFiles) {
        if (totalSize >= this.MAX_CONTEXT_SIZE) break;

        try {
          const content = await getRepoContents(
            context.token!,
            context.owner,
            context.repo,
            file.path,
            context.branch
          );

          if (!Array.isArray(content) && content.type === "file") {
            let fileContent = "";
            if (typeof content.content === "string") {
              fileContent = Buffer.from(content.content, "base64").toString(
                "utf-8"
              );
            }
            const fileEntry = `File: ${file.path}\n\n${fileContent}\n\n`;

            if (totalSize + fileEntry.length <= this.MAX_CONTEXT_SIZE) {
              contextContent += fileEntry;
              totalSize += fileEntry.length;
            }
          }
        } catch (err) {
          console.error(`Error getting content for ${file.path}:`, err);
          continue;
        }
      }

      return contextContent;
    } catch (err) {
      console.error("Error getting repo context:", err);
      return "";
    }
  }

  private getFileRelevanceScore(filePath: string): number {
    let score = 0;
    const lowerPath = filePath.toLowerCase();

    // Configuration files
    if (/package\.json|tsconfig\.json|\.env.*|config\./i.test(lowerPath))
      score += 5;

    // Main application files
    if (/^(src|app)\//i.test(lowerPath)) score += 4;
    if (/index\.(ts|js|py)$/i.test(lowerPath)) score += 3;

    // Test files (lower priority for context)
    if (/test|spec/i.test(lowerPath)) score -= 2;

    // Documentation
    if (/\.(md|txt)$/i.test(lowerPath)) score += 1;

    return score;
  }

  private buildPrompt(request: ScriptRequest, repoContext: string): string {
    const { prompt, settings = {} } = request;

    let systemPrompt = `You are an expert programming assistant specialized in generating high-quality, production-ready code. Your task is to create a script based on the user's requirements.

Required output format:
{
  "script": "The generated code",
  "language": "Programming language used",
  "description": "Brief description of what the script does",
  "inputs": ["Required inputs/dependencies"],
  "outputs": ["Expected outputs/effects"]
}

${repoContext ? `Repository context:\n${repoContext}\n` : ""}

Constraints:
- Use ${settings.language || "the most appropriate"} programming language
${settings.framework ? `- Use the ${settings.framework} framework\n` : ""}
${settings.target ? `- Target environment: ${settings.target}\n` : ""}
- Follow best practices and conventions
- Include error handling
- Add necessary comments for complex logic
- Consider performance and security implications

User request: ${prompt}

Generate a complete, production-ready solution that addresses all requirements.`;

    return systemPrompt;
  }

  async generateScript(request: ScriptRequest): Promise<ScriptResponse> {
    try {
      // Get repository context if available
      const repoContext = request.context
        ? await this.getRepoContext(request.context)
        : "";

      // Build the prompt
      const prompt = this.buildPrompt(request, repoContext);

      // Get AI response
      const response = await this.aiService.complete({
        prompt,
        options: {
          temperature: 0.3, // Lower temperature for more deterministic output
          format: "json",
          schema: {
            type: "object",
            properties: {
              script: { type: "string" },
              language: { type: "string" },
              description: { type: "string" },
              inputs: { type: "array", items: { type: "string" } },
              outputs: { type: "array", items: { type: "string" } },
            },
            required: ["script", "language", "description"],
          },
          language: request.language,
        },
      });

      // Parse and validate response
      const result = JSON.parse(response);

      // Validate language
      if (!this.SUPPORTED_LANGUAGES.includes(result.language.toLowerCase())) {
        throw new Error(`Unsupported programming language: ${result.language}`);
      }

      return {
        success: true,
        data: {
          script: result.script,
          language: result.language,
          description: result.description,
          inputs: result.inputs || [],
          outputs: result.outputs || [],
        },
      };
    } catch (err) {
      console.error("Script Agent Error:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  // Utility method to verify script syntax (basic check)
  private async validateScript(
    script: string,
    language: string
  ): Promise<boolean> {
    // This could be expanded to use language-specific parsers
    try {
      if (language === "javascript" || language === "typescript") {
        // Basic syntax check using Function constructor
        new Function(script);
      }
      // Add other language validators as needed
      return true;
    } catch (err) {
      return false;
    }
  }
}
