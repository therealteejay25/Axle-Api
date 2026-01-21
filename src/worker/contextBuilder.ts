import { LoadedAgent } from "./agentLoader";
import { AgentMemoryService } from "../services/AgentMemoryService";

// ============================================
// FOCUSED CONTEXT BUILDER
// ============================================
// Minimal, effective prompts for intelligent agent behavior
// ============================================

/**
 * Build focused context with relevant memories
 */
export const buildFocusedContext = async (
  loaded: LoadedAgent,
  payload: Record<string, any>,
): Promise<string> => {
  const { agent, user } = loaded;

  const currentTask = payload?.input || payload?.task || payload?.message || "";

  // Get relevant memories (semantic search)
  let relevantMemories: Array<{ content: string }> = [];
  try {
    relevantMemories = await AgentMemoryService.findRelevantMemories({
      agentId: agent._id.toString(),
      query: currentTask,
      limit: 3,
    });
  } catch {
    // Continue without memories if search fails
  }

  // Get recent conversation (last 4 messages max)
  const recentMessages = Array.isArray(payload?.messages)
    ? payload.messages.slice(-4)
    : [];

  const conversationContext =
    recentMessages.length > 0
      ? `\n\nRecent conversation:\n${formatMessages(recentMessages)}\n`
      : "";

  const memoryContext =
    relevantMemories.length > 0
      ? `\n\nThings you remember:\n${relevantMemories
          .map((m) => `- ${m.content}`)
          .join("\n")}\n`
      : "";

  // GitHub repo context
  const githubRepo = payload?.githubRepo;
  const githubContext =
    githubRepo?.owner && githubRepo?.repo
      ? `\n\nActive GitHub repo: ${githubRepo.owner}/${githubRepo.repo}${
          githubRepo.ref ? ` (${githubRepo.ref})` : ""
        }\n`
      : "";

  // Get integrations list
  const integrations = Array.from(loaded.integrations.keys());

  return `You are ${agent.name}${agent.description ? ` — ${agent.description}` : ""}.

${agent.instructions || "Help the user accomplish their goals."}

Connected services: ${integrations.join(", ") || "None"}
Current time: ${new Date().toISOString()} (User timezone: ${user.timeZone || "UTC"})
${memoryContext}${conversationContext}${githubContext}
BEHAVIOR:
- Be warm, direct, and efficient
- Just do the work — don't ask permission or explain what you're about to do
- Use tools proactively to accomplish tasks
- For greetings like "hi", respond briefly and naturally (no tools needed)
- For tasks, use whatever tools you need, then call complete_task when done

TOOL NOTES:
- complete_task: Call this when you're finished (required to end execution)
- remember/recall: Store and retrieve important information
- GitHub tools: You have full access to the user's authenticated account
- Google tools: Access to Gmail, Drive, Calendar, Docs
- Twitter tools: Post tweets, read timeline

User says: "${currentTask}"`;
};

/**
 * Format messages for context
 */
const formatMessages = (messages: any[]): string => {
  return messages
    .map((m) => {
      const role = m.role === "user" ? "User" : "You";
      const content = m.content || m.parts?.[0]?.text || "";
      return `${role}: ${content}`;
    })
    .join("\n");
};

// Legacy exports for backward compatibility
export const buildContext = (
  loaded: LoadedAgent,
  triggerType: any,
  triggerPayload: Record<string, any>,
) => {
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
  };
};

export const buildSystemPrompt = async (
  loaded: LoadedAgent,
  context: any,
  githubRepo?: { owner: string; repo: string; ref?: string },
): Promise<string> => {
  const payload = context?.trigger?.payload || {};
  if (githubRepo) {
    payload.githubRepo = githubRepo;
  }
  return buildFocusedContext(loaded, payload);
};

export default { buildContext, buildSystemPrompt, buildFocusedContext };
