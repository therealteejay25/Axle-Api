// ============================================
// TOOL ROUTING TYPES
// ============================================
// Type definitions for capability-based tool routing,
// schema validation, and hallucination detection.
// ============================================

export enum ToolCapability {
  RESEARCH = 'research',              // Web search, data gathering
  READ_CONTENT = 'read_content',      // Fetch, read, list content
  WRITE_CONTENT = 'write_content',    // Create, update, delete content
  COMMUNICATION = 'communication',    // Send messages, emails
  CODE_MANAGEMENT = 'code_management', // GitHub repos, PRs, issues
  NOTIFICATIONS = 'notifications'     // Alerts, status updates
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  validation?: {
    min?: number;           // For numbers/strings (length)
    max?: number;           // For numbers/strings (length)
    pattern?: string;       // Regex pattern for strings
    enum?: any[];          // Allowed values
  };
  example?: any;
}

export interface ToolDefinition {
  name: string;
  capability: ToolCapability;
  provider?: string;  // Required integration (optional for HTTP, etc.)
  description: string;
  whenToUse?: string;  // NEW: Guidance for when to use this tool
  parameters: ToolParameter[];
  returns: {
    type: string;
    description: string;
    example?: any;
  };
  examples: Array<{
    description: string;
    params: Record<string, any>;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  hallucinated: string[];  // Parameters not in schema
  suggestions?: string[];  // Helpful suggestions
}

export interface IntegrationData {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
}

export type IntegrationMap = Map<string, IntegrationData>;
