/**
 * Core unified types for Axle AI agents
 * (script, general, validation, cron, etc.)
 */

export type AgentResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Request types per agent
 */
export type ScriptRequest = {
  type: "script";
  repo?: string;              // Optional: "owner/repo"
  command: string;            // User's instruction
  context?: string;           // Optional manual code/context
  repoContext?: {             // Optional live repo context
    owner: string;
    repo: string;
    token?: string;           // GitHub OAuth token to fetch files
    fileList: { path: string; type: string; sha: string }[];
  };
};


export type ValidationRequest = {
  type: "validation";
  prompt: string;
};

export type GeneralRequest = {
  type: "general";
  prompt: string;
  repo?: string;
  context?: string;
  repoContext?: {             // Optional live repo context
    owner: string;
    repo: string;
    token?: string;           // GitHub OAuth token to fetch files
    fileList: { path: string; type: string; sha: string }[];
  };
};

export type CronRequest = {
  type: "cron";
  schedule: string; // cron expression
  task: string; // what should run
  context?: string;
  repoContext?: {             // Optional live repo context
    owner: string;
    repo: string;
    token?: string;           // GitHub OAuth token to fetch files
    fileList: { path: string; type: string; sha: string }[];
  };
};

/**
 * Unified request type
 * (use this anywhere requests can be routed dynamically)
 */
export type AgentRequest =
  | ScriptRequest
  | ValidationRequest
  | GeneralRequest
  | CronRequest;

/**
 * Agent namespace for clear imports
 */
export namespace Agent {
  export type Request = AgentRequest;
  export type Response<T = any> = AgentResponse<T>;
}
