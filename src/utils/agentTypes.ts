/**
 * Core Agent Types for Axle
 */

// Base interfaces
export interface BaseRequest {
  userId: string;
  language?: string;
  settings?: AgentSettings;
}

export interface BaseResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Common Types
export interface AgentSettings {
  language?: string;
  aiModel?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface RepoContext {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  path?: string;
  fileList?: Array<{
    path: string;
    type: string;
    sha: string;
  }>;
  files?: Array<{
    path: string;
    content: string;
    type: string;
  }>;
}

// Agent-specific interfaces
export interface ValidationRequest extends BaseRequest {
  type: "validation";
  prompt: string;
  context?: RepoContext;
}

export interface ValidationResponse extends BaseResponse {
  data?: {
    type: "script" | "general" | "pr" | "cron" | "cicd";
    confidence: number;
    metadata?: Record<string, any>;
  };
}

export interface ScriptRequest extends BaseRequest {
  type: "script";
  prompt: string;
  context: RepoContext;
  settings?: {
    language?: string;
    framework?: string;
    target?: string;
  };
}

export interface ScriptResponse extends BaseResponse {
  data?: {
    script: string;
    language: string;
    description: string;
    inputs?: string[];
    outputs?: string[];
  };
}

export interface GeneralRequest extends BaseRequest {
  type: "general";
  prompt: string;
  context?: RepoContext;
  settings?: Record<string, any>;
}

export interface GeneralResponse extends BaseResponse {
  data?: {
    response: string;
    actions?: Array<{
      type: string;
      payload: any;
    }>;
  };
}

export interface PRRequest extends BaseRequest {
  type: "pr";
  context: RepoContext;
  action: "create" | "review" | "merge";
  prNumber?: number;
  branch?: string;
  title?: string;
  body?: string;
}

export interface PRResponse extends BaseResponse {
  data?: {
    url?: string;
    number?: number;
    status?: string;
    comments?: string[];
    mergeStatus?: string;
  };
}

export interface CronRequest extends BaseRequest {
  type: "cron";
  schedule: string;
  task: string;
  context?: RepoContext;
}

export interface CronResponse extends BaseResponse {
  data?: {
    id: string;
    schedule: string;
    nextRun: Date;
  };
}

export interface CICDRequest extends BaseRequest {
  type: "cicd";
  context: RepoContext;
  action: "test" | "build" | "deploy";
  environment?: string;
  config?: Record<string, any>;
}

export interface CICDResponse extends BaseResponse {
  data?: {
    status: string;
    logs: string[];
    artifacts?: string[];
  };
}

export interface HistoryRequest extends BaseRequest {
  type: "history";
  filter?: {
    type?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  };
  limit?: number;
  offset?: number;
}

export interface HistoryResponse extends BaseResponse {
  data?: {
    entries: Array<{
      id: string;
      type: string;
      command: string;
      output: string;
      timestamp: Date;
      status: string;
      metadata?: Record<string, any>;
    }>;
    total: number;
    hasMore: boolean;
  };
}

// Combined request type for routing
export type AgentRequest =
  | ValidationRequest
  | ScriptRequest
  | GeneralRequest
  | PRRequest
  | CronRequest
  | CICDRequest
  | HistoryRequest;

// Combined response type
export type AgentResponse =
  | ValidationResponse
  | ScriptResponse
  | GeneralResponse
  | PRResponse
  | CronResponse
  | CICDResponse
  | HistoryResponse;
