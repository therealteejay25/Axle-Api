// ============================================
// CAPABILITY SYSTEM - CORE TYPES
// ============================================
// Human-action-based tool abstraction layer.
// Agents think in terms of WHAT they want to do,
// not HOW to call APIs.
// ============================================

export enum Capability {
  DISCOVER = 'discover',       // Find information, people, resources
  READ = 'read',               // Consume and understand content
  ANALYZE = 'analyze',         // Process and synthesize information
  WRITE = 'write',             // Create new content
  EDIT = 'edit',               // Modify existing content
  ORGANIZE = 'organize',       // Structure and categorize
  NOTIFY = 'notify',           // Alert people or systems
  ENGAGE = 'engage',           // React, like, follow, share (Social)
  COLLABORATE = 'collaborate', // Work with others
  AUTOMATE = 'automate',       // Trigger workflows
  VERIFY = 'verify'            // Confirm actions succeeded
}

export enum SafetyLevel {
  SAFE = 'safe',           // Read-only, no side effects
  CAUTIOUS = 'cautious',   // Writes, but reversible
  RISKY = 'risky',         // Destructive, needs confirmation
  DANGEROUS = 'dangerous'  // Never allow autonomous
}

// ============================================
// ACTION INTERFACES
// ============================================

export interface ActionInputs {
  // Human-understandable parameters
  // NO raw API fields
  [key: string]: any;
}

export interface ActionConstraints {
  readOnly?: boolean;
  requiresConfirmation?: boolean;
  rateLimit?: {
    maxPerHour: number;
    maxPerDay: number;
  };
  destructive?: boolean;
  safetyLevel: SafetyLevel;
}

export interface ActionVerification {
  method: 'read_back' | 'check_status' | 'none';
  expectedOutput?: Record<string, string>; // field: type
}

export interface ActionMetadata {
  estimatedDuration?: 'instant' | 'seconds' | 'minutes';
  costLevel?: 'free' | 'low' | 'medium' | 'high';
  requiresIntegration: string[]; // e.g., ['github', 'slack']
}

export interface ActionDefinition {
  actionId: string;
  capability: Capability;
  intent: string;              // Human-readable goal
  description: string;         // What this action does
  whenToUse: string;          // Guidance for agent
  inputSchema: Record<string, InputField>;
  outputSchema: Record<string, string>; // field: type
  constraints: ActionConstraints;
  verification?: ActionVerification;
  metadata: ActionMetadata;
  
  // Internal: maps to underlying tools
  executor: (inputs: ActionInputs, context: ExecutionContext) => Promise<any>;
}

export interface InputField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  enum?: any[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// ============================================
// EXECUTION CONTEXT
// ============================================

export interface ExecutionContext {
  integrations: Map<string, any>;
  executionId?: string;
  agentId?: string;
  previousResults?: Record<string, any>; // For context carry
  memory?: any[];
}

// ============================================
// ACTION RESULT
// ============================================

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    duration: number;
    toolsCalled: string[];
    verified?: boolean;
  };
}

// ============================================
// RATE LIMITING
// ============================================

export interface RateLimitUsage {
  action: string;
  currentHour: number;
  currentDay: number;
  resetHour: Date;
  resetDay: Date;
}
