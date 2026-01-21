import { LoadedAgent } from "./agentLoader";
import { AgentMemoryService } from "../services/AgentMemoryService";

/**
 * Build a powerful, focused context for the agent
 * No special-casing for greetings vs tasks - let the agent be intelligent
 */
export const buildFocusedContext = async (
  loaded: LoadedAgent,
  payload: Record<string, any>,
): Promise<string> => {
  const { agent, user } = loaded;
  const currentTask = payload?.input || payload?.task || payload?.message || "";

  // Fetch relevant memories based on semantic search
  let memories: Array<{ key: string; content: string; category: string }> = [];
  try {
    memories = await AgentMemoryService.findRelevantMemories({
      agentId: agent._id.toString(),
      query: currentTask,
      limit: 5,
    });
  } catch {
    // Continue without memories
  }

  // Get conversation history (increased to recent 100 messages for full context)
  const recentMessages = Array.isArray(payload?.messages)
    ? payload.messages.slice(-100)
    : [];

  // Format conversation history
  const conversationHistory = recentMessages.length > 0
    ? recentMessages.map((m: any) => {
        const role = m.role === "user" ? "Human" : "You";
        const content = m.content || m.parts?.[0]?.text || "";
        return `${role}: ${content}`;
      }).join("\n")
    : "";

  // Format memories
  const memorySection = memories.length > 0
    ? `\n## Your Memories\n${memories.map(m => `- [${m.category}] ${m.content}`).join("\n")}`
    : "";

  // GitHub context if available
  const githubRepo = payload?.githubRepo;
  const githubSection = githubRepo?.owner && githubRepo?.repo
    ? `\n## Active Repository\n${githubRepo.owner}/${githubRepo.repo}${githubRepo.ref ? ` (${githubRepo.ref})` : ""}`
    : "";

  // Connected integrations
  const integrations = Array.from(loaded.integrations.keys());

  // User context
  const userContext = `
## User Profile
- Name: ${user.name || "Unknown"}
- Email: ${user.email || "Unknown"}
- Timezone: ${user.timeZone || "UTC"}
- Plan: ${user.plan || "free"}`;

  // Build the powerful prompt
  return `# ${agent.name}
${agent.description ? `*${agent.description}*` : ""}

You are a brilliant, proactive AI assistant. You think deeply, act decisively, and communicate naturally.

## Your Core Instructions
${agent.instructions || "Help the user accomplish their goals efficiently and thoughtfully."}

## Current Context
- **Now**: ${new Date().toISOString()}
- **Connected Services**: ${integrations.length > 0 ? integrations.join(", ") : "None"}
${userContext}${memorySection}${githubSection}

${conversationHistory ? `## Recent Conversation\n${conversationHistory}\n` : ""}

## How You Work

**Be Human**: Talk like a smart friend, not a robot. Use contractions, be warm, show personality.

**Be Proactive**: If you can figure something out or do something helpful, just do it. Don't ask permission for obvious actions.

**Use Your Tools**: You have powerful tools - use them! Search the web, check calendars, manage files, post to social media, work with code. Don't tell the user what you could do - just do it.

**Remember Things**: Use the \`remember\` tool to store important facts you learn. Use \`recall\` to retrieve them later.

**Complete Tasks**: When you've accomplished what the user asked (or answered their question), call \`complete_task\` with a brief summary. This is how you signal you're done.

## Available Tool Categories

**Memory**: \`remember\`, \`recall\` - Store and retrieve important information
**Web**: \`web_search\`, \`web_read_page\` - Search and read web content
**GitHub**: Full access to user's repos, issues, PRs, code
**Google**: Gmail, Drive, Calendar, Docs, Sheets
**Twitter/X**: Post tweets, read timeline, search
**Scheduling**: \`schedule_task\` - Schedule future executions

## User's Current Message
"${currentTask}"

Now respond naturally. Be brilliant.`;
};

// Legacy exports
export const buildContext = (
  loaded: LoadedAgent,
  triggerType: any,
  triggerPayload: Record<string, any>,
) => ({
  agent: {
    id: loaded.agent._id.toString(),
    name: loaded.agent.name,
    description: loaded.agent.description,
  },
  trigger: { type: triggerType, payload: triggerPayload },
});

export const buildSystemPrompt = async (
  loaded: LoadedAgent,
  context: any,
  githubRepo?: { owner: string; repo: string; ref?: string },
): Promise<string> => {
  const payload = context?.trigger?.payload || {};
  if (githubRepo) payload.githubRepo = githubRepo;
  return buildFocusedContext(loaded, payload);
};

export default { buildContext, buildSystemPrompt, buildFocusedContext };