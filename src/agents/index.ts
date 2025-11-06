import { ValidationAgent } from "./validationAgent";
import { ScriptAgent } from "./scriptAgent";
import { GeneralAgent } from "./generalAgent";
import { PRAgent } from "./prAgent";
import { CICDAgent } from "./cicdAgent";
import { HistoryAgent } from "./historyAgent";
import { CodeGenerationAgent } from "./codeGenerationAgent";
import { ChatAgent } from "./chatAgent";
import { AgentNetwork } from "./agentNetwork";
import { BaseAgent } from "./baseAgent";
import {
  AgentRequest,
  AgentResponse,
  ValidationRequest,
  ScriptRequest,
  GeneralRequest,
  PRRequest,
  CICDRequest,
  HistoryRequest,
  RepoContext,
} from "../utils/agentTypes";

type BaseAgentRequest = {
  userId: string;
  language?: string;
  settings?: Record<string, any>;
  context?: RepoContext;
};

type ExtractPrompt<T> = T extends { prompt: string } ? T["prompt"] : never;
type RequestWithPrompt = { prompt: string } & BaseAgentRequest;

export class AgentManager {
  private network: AgentNetwork;
  private validationAgent: ValidationAgent;
  private scriptAgent: ScriptAgent;
  private generalAgent: GeneralAgent;
  private prAgent: PRAgent;
  private cicdAgent: CICDAgent;
  private historyAgent: HistoryAgent;
  private codeGenerationAgent: CodeGenerationAgent;
  private chatAgent: ChatAgent;

  constructor() {
    // Initialize network for inter-agent communication
    this.network = new AgentNetwork();

    // Initialize basic agents
    this.validationAgent = new ValidationAgent();
    this.scriptAgent = new ScriptAgent();
    this.generalAgent = new GeneralAgent();
    this.prAgent = new PRAgent();
    this.cicdAgent = new CICDAgent();
    this.historyAgent = new HistoryAgent();

    // Initialize advanced agents
    this.codeGenerationAgent = new CodeGenerationAgent({
      id: "code-gen",
      name: "Code Generation Agent",
      description: "Generates and optimizes code",
      capabilities: ["code_generation", "optimization"],
    });

    this.chatAgent = new ChatAgent({
      id: "chat",
      name: "Chat Assistant",
      description: "Provides friendly conversational interface",
      capabilities: ["natural_language_processing", "personalization"],
    });

    // Register all agents in the network with their capabilities
    this.network.registerAgent(this.validationAgent, ["security_analysis"]);
    this.network.registerAgent(this.scriptAgent, [
      "code_generation",
      "script:execute",
    ]);
    this.network.registerAgent(this.generalAgent, [
      "natural_language_processing",
      "problem_solving",
    ]);
    this.network.registerAgent(this.prAgent, [
      "code_review",
      "version_control",
    ]);
    this.network.registerAgent(this.cicdAgent, ["ci_cd", "deployment"]);
    this.network.registerAgent(this.historyAgent, ["data_analysis"]);
    this.network.registerAgent(this.codeGenerationAgent, [
      "code_generation",
      "optimization",
    ]);
    this.network.registerAgent(this.chatAgent, ["natural_language_processing"]);
  }

  private getCommandString(request: AgentRequest): string {
    switch (request.type) {
      case "validation":
      case "script":
      case "general":
        return (request as RequestWithPrompt).prompt;
      case "pr":
        const prReq = request as PRRequest;
        return `PR ${prReq.action} ${prReq.prNumber || ""}`;
      case "cicd":
        const cicdReq = request as CICDRequest;
        return `${cicdReq.action.toUpperCase()} in ${
          cicdReq.environment || "default"
        }`;
      case "history":
        return "Query history";
      default:
        return "";
    }
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    try {
      let response: AgentResponse;

      // For non-validation requests, always validate first
      if (request.type !== "validation" && "prompt" in request) {
        const validationReq: ValidationRequest = {
          type: "validation",
          userId: request.userId,
          prompt: (request as RequestWithPrompt).prompt,
          language: request.language,
          context: "context" in request ? request.context : undefined,
        };

        const validationResult = await this.validationAgent.validate(
          validationReq
        );

        if (!validationResult.success) {
          return validationResult;
        }

        // If validation suggests a different agent type with high confidence
        if (
          validationResult.data &&
          validationResult.data.type !== request.type &&
          validationResult.data.confidence > 0.8
        ) {
          console.log(
            `Adjusting request type from ${request.type} to ${validationResult.data.type}`
          );
          request = {
            ...request,
            type: validationResult.data.type,
          } as AgentRequest;
        }
      }

      // Route to appropriate agent
      switch (request.type) {
        case "validation":
          response = await this.validationAgent.validate(
            request as ValidationRequest
          );
          break;

        case "script":
          response = await this.scriptAgent.generateScript(
            request as ScriptRequest
          );
          break;

        case "general":
          response = await this.generalAgent.execute(request as GeneralRequest);
          break;

        case "pr":
          response = await this.prAgent.handlePR(request as PRRequest);
          break;

        case "cicd":
          response = await this.cicdAgent.execute(request as CICDRequest);
          break;

        case "history":
          response = await this.historyAgent.queryHistory(
            request as HistoryRequest
          );
          break;

        default:
          throw new Error(`Unknown agent type: ${(request as any).type}`);
      }

      // Log command if successful
      await this.historyAgent.logCommand(request.userId, {
        type: request.type,
        command: this.getCommandString(request),
        output: JSON.stringify(response.data),
        status: response.success ? "success" : "failed",
        metadata: {
          settings: request.settings,
          timestamp: new Date(),
        },
      });

      return response;
    } catch (error) {
      console.error("Agent Manager Error:", error);

      // Log error
      await this.historyAgent.logCommand(request.userId, {
        type: request.type,
        command: this.getCommandString(request),
        output: error.message || "Unknown error occurred",
        status: "failed",
        metadata: {
          error: error.message || "Unknown error occurred",
          stack: error.stack || "",
          timestamp: new Date(),
        },
      });

      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  async getHistory(request: HistoryRequest): Promise<AgentResponse> {
    return this.historyAgent.queryHistory(request);
  }

  async getStatistics(
    userId: string,
    days?: number
  ): Promise<{
    success: boolean;
    data?: {
      totalCommands: number;
      successRate: number;
      commandsByType: Record<string, number>;
      commandsByDay: Record<string, number>;
    };
    error?: string;
  }> {
    return this.historyAgent.getStatistics(userId, days);
  }

  async chat(userId: string, message: string): Promise<string> {
    try {
      // Let the chat agent handle the conversation
      const response = await this.chatAgent.chat(userId, message);

      // Log the interaction
      await this.historyAgent.logCommand(userId, {
        type: "chat",
        command: message,
        output: response,
        status: "success",
        metadata: {
          timestamp: new Date(),
        },
      });

      return response;
    } catch (error) {
      console.error("Chat Error:", error);

      // Log error
      await this.historyAgent.logCommand(userId, {
        type: "chat",
        command: message,
        output: error.message || "Unknown error occurred",
        status: "failed",
        metadata: {
          error: error.message || "Unknown error occurred",
          timestamp: new Date(),
        },
      });

      return "I apologize, but I encountered an error. Could you try rephrasing your message?";
    }
  }

  async analyzePatterns(
    userId: string,
    days?: number
  ): Promise<{
    success: boolean;
    data?: {
      commonPatterns: Array<{
        pattern: string;
        count: number;
        successRate: number;
      }>;
      recommendations: string[];
    };
    error?: string;
  }> {
    return this.historyAgent.analyzePatterns(userId, days);
  }
}
