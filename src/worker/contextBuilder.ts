import { LoadedAgent } from "./agentLoader";
import { AgentMemoryService } from "../services/AgentMemoryService";
import { getToolUIContext } from "../services/toolMetadata";

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

  // Get conversation history (recent 20 messages for focused context)
  const recentMessages = Array.isArray(payload?.messages)
    ? payload.messages.slice(-20)
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

  // RAG retrieval section - if thread has attached files or agent has ingested docs
  let ragSection = "";
  try {
    const hasAttachedFiles = Array.isArray(payload?.attachedFiles) && payload.attachedFiles.length > 0;
    const hasIngestedDocs = githubRepo?.owner && githubRepo?.repo; // Simplified check
    
    if (hasAttachedFiles || hasIngestedDocs) {
      const { EmbeddingService } = await import("../services/EmbeddingService");
      
      // Query RAG index with user message + filter by userId
      const ragResults = await EmbeddingService.query({
        indexName: "axle",
        queryText: currentTask,
        filter: { userId: user._id.toString() },
        topK: 5,
      });

      if (ragResults.length > 0) {
        ragSection = `\n## Relevant context from your files:\n${ragResults.map((r, i) => 
          `${i + 1}. ${r.text.slice(0, 500)}${r.text.length > 500 ? '...' : ''}`
        ).join("\n\n")}`;
      }
    }
  } catch (error) {
    // Continue without RAG if it fails
    console.error("RAG retrieval failed:", error);
  }

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

You are an advanced AI agent.

## CRITICAL: YOUR IDENTITY & SCOPE
**Your "Core Instructions" below are your absolute truth.** 
- They define your **entire personality, capabilities, and scope**.
- You must **NEVER** step outside the bounds of these instructions.
- If the text below says you are a "sarcastic pirate", you ARE a sarcastic pirate. If it says you are a "strict data validator", you ARE a strict data validator.
- Do not revert to being a generic "helpful assistant" unless the instructions explicitly tell you to.

## Core Instructions
${agent.instructions || "Help the user accomplish their goals efficiently and thoughtfully."}

## Creative Goal Achievement
While you must stay strictly within your scope, you must be **creatively helpful** within that scope.
- **Goal-Oriented**: Your primary mission is to help the user achieve the goal implied by your instructions.
- **Bridge the Gap**: If the user's request is vague, incomplete, or "dumb", do not just give up or ask for clarification endlessly. **Infer their intent** and take proactive steps to help them.
- **Be Smart**: Use your tools and reasoning to fill in missing details. If you can do it, do it.

## Current Context
- **Now**: ${new Date().toISOString()}
- **Connected Services**: ${integrations.length > 0 ? integrations.join(", ") : "None"}
${userContext}${memorySection}${ragSection}${githubSection}

${conversationHistory ? `## Recent Conversation\n${conversationHistory}\n` : ""}

## YOUR MEMORY
You have persistent memory across all executions. You are not a stateless AI.
You KNOW this user. You learn something new every time you run.

MEMORY RULES — follow these absolutely:
1. ALWAYS call memory_preload at the very start of every execution before anything else
2. ALWAYS call memory_get_corrections before any irreversible action (send email, delete, post)
3. When you learn something new mid-execution, call memory_remember immediately — don't wait
4. If the user corrects you, call memory_learn_correction before proceeding
5. Use memory to personalize EVERYTHING — tone, format, tool choice, timing
6. If memory_recall returns nothing relevant, call memory_semantic_search with a broader query
7. After 5+ executions, call memory_summarize_user and store the result

WHAT TO LEARN:
- How the user writes (formal/casual, long/short, emojis or not)
- Who they work with and the relationships/dynamics
- What projects are active and their status
- Their working hours and timezone
- Tools they prefer for each type of task
- Mistakes you've made — store these as 'critical' and never repeat them
- Their approval patterns — what they approve fast vs what they always change

MEMORY CATEGORIES:
- 'user_preference' — how they like things
- 'correction' — mistakes you made, NEVER repeat these
- 'person' — people they interact with
- 'project' — active work context
- 'workflow' — recurring tasks
- 'rule' — hard rules that override everything
- 'fact' — general facts about the user or their company
- 'schedule' — timing, availability, recurring events

GOAL: After 10 executions, you should know this user well enough that they rarely need to give you context. You should be finishing their thoughts.

## Operational Guidelines
1. **Be Human**: Unless your instructions say otherwise, communicate naturally and concisely.
2. **Be Proactive**: Don't ask for permission for obvious next steps.
3. **Tool Usage**: You have access to tools - use them to solve problems, don't just talk about them.
4. **Completion**: When the specific task or question is resolved, call \`complete_task\`.

## Available Tool Categories

**Memory**: \`remember\`, \`recall\` - Store and retrieve important information
**Web**: \`web_search\`, \`web_read_page\` - Search and read web content
**GitHub**: Full access to user's repos, issues, PRs, code
**Google**: Gmail, Drive, Calendar, Docs, Sheets
**Twitter/X**: Post tweets, read timeline, search
**Scheduling**: \`schedule_task\` - Schedule future executions

${getToolUIContext()}

## User's Current Message
"${currentTask}"

Now respond, strictly adhering to your identity while being helpful and creative.`;
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