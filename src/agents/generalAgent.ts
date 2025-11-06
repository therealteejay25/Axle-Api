import {
  GeneralRequest,
  GeneralResponse,
  RepoContext,
} from "../utils/agentTypes";
import { AIService } from "../services/aiService";
import { GithubService } from "../services/githubService";
import { DocGenerator } from "../services/docGenerator";
import { getRepoContents, buildFileIndex } from "../services/githubSevice";

export class GeneralAgent {
  private aiService: AIService;
  private githubService: GithubService;
  private docGenerator: DocGenerator;
  private readonly MAX_CONTEXT_SIZE = 15000;

  constructor() {
    this.aiService = new AIService();
    this.githubService = new GithubService();
    this.docGenerator = new DocGenerator();
  }

  private async getRepoContext(context: RepoContext): Promise<string> {
    try {
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

      // Sort files by relevance to the current path
      const relevantFiles = context.fileList
        .filter((file) => {
          // Skip binary and generated files
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
          // Prioritize files closer to the current path
          const aDistance = context.path
            ? this.getPathDistance(context.path, a.path)
            : 0;
          const bDistance = context.path
            ? this.getPathDistance(context.path, b.path)
            : 0;
          return aDistance - bDistance;
        });

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

  private getPathDistance(basePath: string, targetPath: string): number {
    const baseParts = basePath.split("/");
    const targetParts = targetPath.split("/");
    const minLength = Math.min(baseParts.length, targetParts.length);

    let commonPath = 0;
    for (let i = 0; i < minLength; i++) {
      if (baseParts[i] === targetParts[i]) {
        commonPath++;
      } else {
        break;
      }
    }

    return (
      Math.abs(baseParts.length - commonPath) +
      Math.abs(targetParts.length - commonPath)
    );
  }

  private async handleRepoConnect(
    request: GeneralRequest
  ): Promise<GeneralResponse> {
    try {
      // Extract repo name from command
      const repoName = this.extractRepoName(request.prompt);
      if (!repoName) {
        return {
          success: false,
          data: {
            response:
              "Please specify a repository name in the format owner/repo",
            actions: [],
          },
        };
      }

      // Connect to repository
      const result = await this.githubService.connectToRepo(
        request.userId,
        repoName
      );

      return {
        success: result.success,
        data: {
          response: result.success
            ? `Successfully connected to repository: ${repoName}`
            : `Failed to connect: ${result.error}`,
          actions: [],
        },
      };
    } catch (err) {
      return {
        success: false,
        data: {
          response: `Failed to connect to repository: ${err.message}`,
          actions: [],
        },
      };
    }
  }

  private async handleDocGeneration(
    request: GeneralRequest
  ): Promise<GeneralResponse> {
    try {
      const command = request.prompt.toLowerCase();
      const type = command.includes("api") ? "api" : "frontend";

      const docPath = await this.docGenerator.generateDocs(
        type,
        request.userId
      );

      return {
        success: true,
        data: {
          response: `Documentation generated successfully: ${docPath}`,
          actions: [],
        },
      };
    } catch (err) {
      return {
        success: false,
        data: {
          response: `Failed to generate documentation: ${err.message}`,
          actions: [],
        },
      };
    }
  }

  private extractRepoName(prompt: string): string | null {
    const words = prompt.toLowerCase().split(" ");
    const repoIndex = words.findIndex(
      (word) => word === "repo" || word === "repository"
    );

    if (repoIndex >= 0 && words[repoIndex + 1]) {
      // Handle "owner/repo" format
      return words[repoIndex + 1].replace(/['"]/g, "");
    }

    return null;
  }

  private buildPrompt(request: GeneralRequest, repoContext: string): string {
    const { prompt, settings = {} } = request;

    let systemPrompt = `You are an advanced AI assistant specialized in software development and repository management. Your task is to:
1. Understand the user's request
2. Analyze any provided repository context
3. Generate a detailed response
4. Suggest specific actions when applicable

Output format:
{
  "response": "Detailed explanation or answer",
  "actions": [
    {
      "type": "edit_file|create_file|delete_file|run_command",
      "payload": {
        // Action-specific parameters
      }
    }
  ]
}

${repoContext ? `Repository context:\n${repoContext}\n` : ""}

Settings:
${Object.entries(settings)
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}

User request: ${prompt}

Provide a comprehensive response that addresses all aspects of the request.`;

    return systemPrompt;
  }

  async execute(request: GeneralRequest): Promise<GeneralResponse> {
    try {
      const command = request.prompt.toLowerCase();

      // Handle simple commands first
      if (command.includes("connect") && command.includes("repo")) {
        return this.handleRepoConnect(request);
      }

      if (command.includes("create") && command.includes("doc")) {
        return this.handleDocGeneration(request);
      }

      // For other requests, proceed with AI processing
      const repoContext = request.context
        ? await this.getRepoContext(request.context)
        : "";
      const prompt = this.buildPrompt(request, repoContext);

      // Get AI response
      const response = await this.aiService.complete({
        prompt,
        options: {
          temperature: 0.7, // Higher temperature for more creative responses
          format: "json",
          schema: {
            type: "object",
            properties: {
              response: { type: "string" },
              actions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: [
                        "edit_file",
                        "create_file",
                        "delete_file",
                        "run_command",
                      ],
                    },
                    payload: { type: "object" },
                  },
                  required: ["type", "payload"],
                },
              },
            },
            required: ["response"],
          },
          language: request.language,
        },
      });

      // Parse and validate response
      const result = JSON.parse(response);

      return {
        success: true,
        data: {
          response: result.response,
          actions: result.actions || [],
        },
      };
    } catch (err) {
      console.error("General Agent Error:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  // Helper method to validate action payloads
  private validateAction(action: any): boolean {
    try {
      switch (action.type) {
        case "edit_file":
          return (
            typeof action.payload.path === "string" &&
            typeof action.payload.content === "string"
          );
        case "create_file":
          return (
            typeof action.payload.path === "string" &&
            typeof action.payload.content === "string"
          );
        case "delete_file":
          return typeof action.payload.path === "string";
        case "run_command":
          return typeof action.payload.command === "string";
        default:
          return false;
      }
    } catch {
      return false;
    }
  }
}
