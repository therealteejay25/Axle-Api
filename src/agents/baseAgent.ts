import { EventEmitter } from "events";

export interface AgentMessage {
  from: string;
  to: string;
  content: string;
  type: string;
  timestamp: Date;
  priority: "low" | "normal" | "high";
  metadata?: Record<string, any>;
  retryCount?: number;
}

export interface AgentState {
  status: "idle" | "busy" | "error" | "learning";
  load: number;
  lastActive: Date;
  currentTask?: string;
  errorCount?: number;
  performanceMetrics?: {
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export type AgentCapability =
  | "code_generation"
  | "code_review"
  | "documentation"
  | "testing"
  | "debugging"
  | "optimization"
  | "security_analysis"
  | "dependency_management"
  | "architecture_design"
  | "database_management"
  | "deployment"
  | "monitoring"
  | "natural_language_processing"
  | "machine_learning"
  | "data_analysis"
  | "api_integration"
  | "version_control"
  | "ci_cd"
  | "problem_solving"
  | "learning";

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  maxLoad?: number;
  learningEnabled?: boolean;
  priority?: number;
  dependencies?: string[];
}

export interface AgentContext {
  networkState: Record<string, AgentState>;
  agentCapabilities: Record<string, AgentCapability[]>;
  conversationHistory: AgentMessage[];
  sharedKnowledge: Record<string, any>;
}

export class BaseAgent extends EventEmitter {
  public readonly id: string;
  protected name: string;
  protected description: string;
  protected capabilities: Set<AgentCapability>;
  protected state: AgentState;
  protected memory: {
    shortTerm: Map<string, any>;
    longTerm: Map<string, any>;
    context: Map<string, any>;
  };
  protected config: AgentConfig;
  protected learningEnabled: boolean;

  constructor(config: AgentConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.capabilities = new Set(config.capabilities);
    this.config = config;
    this.learningEnabled = config.learningEnabled ?? true;

    this.state = {
      status: "idle",
      load: 0,
      lastActive: new Date(),
      performanceMetrics: {
        successRate: 1,
        averageResponseTime: 0,
        errorRate: 0,
      },
    };

    this.memory = {
      shortTerm: new Map(),
      longTerm: new Map(),
      context: new Map(),
    };

    // Set up internal event handlers
    this.on("task_start", this.onTaskStart.bind(this));
    this.on("task_complete", this.onTaskComplete.bind(this));
    this.on("error", this.onError.bind(this));
    this.on("learn", this.onLearn.bind(this));
  }

  public async processMessage(
    message: AgentMessage,
    context: AgentContext
  ): Promise<void> {
    try {
      // Update last active timestamp
      this.state.lastActive = new Date();

      // Process message based on type
      switch (message.type) {
        case "task_request":
          await this.handleTaskRequest(message, context);
          break;
        case "knowledge_share":
          await this.handleKnowledgeShare(message, context);
          break;
        case "state_query":
          await this.handleStateQuery(message);
          break;
        case "capability_query":
          await this.handleCapabilityQuery(message);
          break;
        case "learning_update":
          if (this.learningEnabled) {
            await this.handleLearningUpdate(message, context);
          }
          break;
        default:
          await this.handleCustomMessage(message, context);
      }

      // Update metrics
      this.updatePerformanceMetrics("success");
    } catch (err) {
      this.updatePerformanceMetrics("error");
      throw err;
    }
  }

  protected async handleTaskRequest(
    message: AgentMessage,
    context: AgentContext
  ): Promise<void> {
    // Default implementation - override in specialized agents
    throw new Error("Task handling not implemented");
  }

  protected async handleKnowledgeShare(
    message: AgentMessage,
    context: AgentContext
  ): Promise<void> {
    const knowledge = JSON.parse(message.content);
    this.memory.longTerm.set(knowledge.key, knowledge.value);
  }

  protected async handleStateQuery(message: AgentMessage): Promise<void> {
    this.emit("message", {
      from: this.id,
      to: message.from,
      type: "state_response",
      content: JSON.stringify(this.state),
      timestamp: new Date(),
      priority: "normal",
    });
  }

  protected async handleCapabilityQuery(message: AgentMessage): Promise<void> {
    this.emit("message", {
      from: this.id,
      to: message.from,
      type: "capability_response",
      content: JSON.stringify(Array.from(this.capabilities)),
      timestamp: new Date(),
      priority: "normal",
    });
  }

  protected async handleLearningUpdate(
    message: AgentMessage,
    context: AgentContext
  ): Promise<void> {
    if (!this.learningEnabled) return;

    const learningData = JSON.parse(message.content);
    await this.learn(learningData, context);
  }

  protected async handleCustomMessage(
    message: AgentMessage,
    context: AgentContext
  ): Promise<void> {
    // Default implementation - override in specialized agents
    console.warn(`Unhandled message type: ${message.type}`);
  }

  protected async learn(data: any, context: AgentContext): Promise<void> {
    // Default learning implementation - override in specialized agents
    console.log(`Learning new information: ${JSON.stringify(data)}`);
  }

  public onStateChange(agentId: string, newState: AgentState): void {
    // Handle state changes of other agents
    this.memory.context.set(`agent_state:${agentId}`, newState);
  }

  private onTaskStart(taskId: string): void {
    this.state.status = "busy";
    this.state.currentTask = taskId;
    this.emit("state_change", this.state);
  }

  private onTaskComplete(taskId: string): void {
    this.state.status = "idle";
    this.state.currentTask = undefined;
    this.emit("state_change", this.state);
  }

  private onError(error: Error): void {
    this.state.status = "error";
    this.state.errorCount = (this.state.errorCount || 0) + 1;
    this.emit("state_change", this.state);
  }

  private onLearn(data: any): void {
    if (this.learningEnabled) {
      this.state.status = "learning";
      this.emit("state_change", this.state);
      // Implement learning logic
      this.state.status = "idle";
      this.emit("state_change", this.state);
    }
  }

  private updatePerformanceMetrics(result: "success" | "error"): void {
    const metrics = this.state.performanceMetrics!;
    const total = metrics.successRate + metrics.errorRate;

    if (result === "success") {
      metrics.successRate++;
    } else {
      metrics.errorRate++;
    }

    metrics.averageResponseTime =
      (metrics.averageResponseTime * total +
        Date.now() -
        this.state.lastActive.getTime()) /
      (total + 1);
  }

  public hasCapability(capability: AgentCapability): boolean {
    return this.capabilities.has(capability);
  }

  public getLoad(): number {
    return this.state.load;
  }

  public getState(): AgentState {
    return { ...this.state };
  }
}
