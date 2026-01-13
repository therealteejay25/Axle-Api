import { LoadedAgent } from "./agentLoader";
import { TriggerType } from "../models/Trigger";

// ============================================
// DYNAMIC PROMPT SYSTEM
// ============================================
// Clean, modular prompt builder for agent execution
// ============================================
export interface ExecutionContext {
  agent: {
    id: string;
    name: string;
    description?: string;
  };
  trigger: {
    type: TriggerType;
    payload: Record<string, any>;
  };
  environment: {
    timestamp: string;
    timezone: string;
  };
  availableActions: string[];
  availableIntegrations: string[];
}

export const buildContext = (
  loaded: LoadedAgent,
  triggerType: TriggerType,
  triggerPayload: Record<string, any>
): ExecutionContext => {
  return {
    agent: {
      id: loaded.agent._id.toString(),
      name: loaded.agent.name,
      description: loaded.agent.description,
    },
    trigger: {
      type: triggerType,
      payload: triggerPayload,
    },
    environment: {
      timestamp: new Date().toISOString(),
      timezone: loaded.user.timeZone || "UTC",
    },
    availableActions: loaded.agent.actions,
    availableIntegrations: Array.from(loaded.integrations.keys()),
  };
};

// ============================================
// DYNAMIC PROMPT SYSTEM
// ============================================
// Clean, modular prompt builder for agent execution
// ============================================

export const buildSystemPrompt = (
  loaded: LoadedAgent,
  context: ExecutionContext,
  githubRepo?: { owner: string; repo: string; ref?: string }
): string => {
  const agent = loaded.agent;
  const user = loaded.user;
  const integrations = Array.from(loaded.integrations.keys());

  // Build user context
  const userContext = buildUserContext(user);

  // Build integration context
  const integrationContext = buildIntegrationContext(loaded.integrations);

  // Build GitHub repo context if provided
  const githubContext = githubRepo && githubRepo.owner && githubRepo.repo
    ? `\nGITHUB REPOSITORY CONTEXT:
You are currently working with the GitHub repository: ${githubRepo.owner}/${githubRepo.repo}${githubRepo.ref ? ` (branch: ${githubRepo.ref})` : ""}
- When using GitHub tools (create_issue, get_file_contents, github_list_issues, etc.), use this repository by default
- The owner is "${githubRepo.owner}" and the repository name is "${githubRepo.repo}"
- You can reference files, create issues, and perform other GitHub actions on this repository
- If the user asks to "scan this repo", "read files", or similar, they mean this repository: ${githubRepo.owner}/${githubRepo.repo}`
    : "";

  // Build task context - check input first, then task
  const task =
    context.trigger.payload?.input ||
    context.trigger.payload?.task ||
    "Execute assigned task";

  // Construct final prompt
  return `You are ${agent.name}${
    agent.description ? `: ${agent.description}` : ""
  }

${userContext}

${integrationContext}${githubContext}

CURRENT TASK: ${task}

INSTRUCTIONS:
You are a Reasoning Agent that follows a strict Think-Act-Observe cycle. You have access to tools for executing external actions.

THINK-ACT-OBSERVE CYCLE:
1. THINK: Analyze the task and determine if external tools are needed
2. ACT: If tools are needed, call them immediately as your FIRST response
3. OBSERVE: Wait for tool results, then provide final summary

STRICT TOOL RULE:
- If the task involves ANY external action (sending email, accessing data, etc.), you MUST call the appropriate tool as your very first and only action
- Do not respond with text descriptions like "I'll send an email" - actually execute the tool call
- Tool calls happen automatically - you just initiate them

TOOL EXECUTION:
- Available tools will be provided by the system
- Call tools when the task requires external actions
- Tools execute automatically - observe results and summarize

RESPONSE BEHAVIOR:
- For tool-required tasks: Output tool call immediately
- For simple tasks: Provide direct response
- Always be concise and action-oriented`;
};

// ============================================
// MODULAR PROMPT COMPONENTS
// ============================================

function buildUserContext(user: any): string {
  if (!user) return "USER: No user information available";

  return `USER PROFILE:
- Name: ${user.name || "Unknown"}
- Email: ${user.email || "Unknown"}
- Timezone: ${user.timeZone || "UTC"}`;
}

function buildIntegrationContext(integrations: Map<string, any>): string {
  const integrationList = Array.from(integrations.keys());
  if (integrationList.length === 0) return "INTEGRATIONS: None connected";

  let context = `CONNECTED INTEGRATIONS: ${integrationList.join(", ")}

INTEGRATION DETAILS:`;

  for (const [provider, integration] of integrations.entries()) {
    const metadata = (integration as any)?.metadata || {};

    switch (provider) {
      case "github":
        context += `\n- GitHub: ${metadata.githubLogin || "Unknown"} (${
          metadata.githubName || ""
        })`;
        break;
      case "twitter":
      case "x":
        context += `\n- X/Twitter: ${metadata.xUsername || "Unknown"} (${
          metadata.xName || ""
        })`;
        break;
      case "google":
        context += `\n- Google: Connected`;
        break;
      case "slack":
        context += `\n- Slack: ${metadata.slackTeam || "Unknown"}`;
        break;
      default:
        context += `\n- ${provider}: Connected`;
    }
  }

  return context;
}

export default { buildContext, buildSystemPrompt };
