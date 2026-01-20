import { LoadedAgent } from "./agentLoader";
import { AgentMemoryService } from "../services/AgentMemoryService";

// ============================================
// AUTONOMOUS CONTEXT BUILDER
// ============================================
// Focused, relevant context assembly for autonomous agents
// ============================================

/**
 * Build focused context with semantic memory search
 */
export const buildFocusedContext = async (
  loaded: LoadedAgent,
  payload: Record<string, any>,
): Promise<string> => {
  const { agent, user } = loaded;

  // Extract current task to find relevant memories
  const currentTask = payload?.input || payload?.task || payload?.message || "";

  // Detect task type for completion guidance
  const isSimpleGreeting = /^(hey|hi|hello|yo|sup|what's up|howdy|greetings)[\s!.,]*$/i.test(
    currentTask.trim(),
  );

  const hasActionWords = (text: string): boolean => {
    const actionWords = [
      "create",
      "make",
      "send",
      "post",
      "schedule",
      "check",
      "find",
      "search",
      "get",
      "fetch",
      "update",
      "delete",
      "list",
      "show",
      "tell me",
      "summarize",
      "write",
      "generate",
      "build",
      "compile",
      "run",
      "execute",
      "analyze",
    ];
    const lower = text.toLowerCase();
    return actionWords.some((word) => lower.includes(word));
  };

  const isCasualChat =
    currentTask.trim().length < 15 && !hasActionWords(currentTask);

  // Task guidance based on type
  const taskGuidance = isSimpleGreeting
    ? `The user just said "${currentTask}" which is a casual greeting, not a task. Respond warmly and briefly (1-2 sentences), then IMMEDIATELY call complete_task. Do not suggest things to do or ask questions - just greet them and complete.`
    : isCasualChat
    ? `The user said "${currentTask}" which appears to be casual conversation. Respond naturally and briefly, then call complete_task when done. Don't prolong the conversation unnecessarily.`
    : `The user has given you a task: "${currentTask}". Work on it using available tools until it's complete, then call complete_task with a summary of what you accomplished.`;

  // Get ONLY relevant memories (semantic search, not dump everything)
  let relevantMemories: Array<{ content: string }> = [];
  try {
    relevantMemories = await AgentMemoryService.findRelevantMemories({
      agentId: agent._id.toString(),
      query: currentTask,
      limit: 5, // Only top 5 most relevant
    });
  } catch (error) {
    // If semantic search fails, continue without memories
    console.warn("Failed to retrieve relevant memories:", error);
  }

  // Get recent conversation context (last 3 exchanges max, not 18k chars)
  const recentMessages = Array.isArray(payload?.messages)
    ? payload.messages.slice(-6) // Last 3 user-agent exchanges
    : [];

  const conversationContext =
    recentMessages.length > 0
      ? `\n\nRECENT CONVERSATION:\n${formatMessages(recentMessages)}\n`
      : "";

  const memoryContext =
    relevantMemories.length > 0
      ? `\n\nRELEVANT MEMORIES:\n${relevantMemories
          .map((m) => `- ${m.content}`)
          .join("\n")}\n`
      : "";

  // Build GitHub repo context if provided
  const githubRepo = payload?.githubRepo;
  const githubContext =
    githubRepo && githubRepo.owner && githubRepo.repo
      ? `\n\nGITHUB REPOSITORY CONTEXT:
You are currently working with: ${githubRepo.owner}/${githubRepo.repo}${
          githubRepo.ref ? ` (branch: ${githubRepo.ref})` : ""
        }
- Use this repository by default for GitHub actions
- When user asks to "scan this repo", "read files", etc., they mean: ${
          githubRepo.owner
        }/${githubRepo.repo}\n`
      : "";

  // Build core instructions
  return `You are ${agent.name}${
    agent.description ? `: ${agent.description}` : ""
  }.

YOUR INSTRUCTIONS:
${
  agent.instructions ||
  "Help the user accomplish their goals efficiently and proactively."
}

CURRENT TASK TYPE: ${
    isSimpleGreeting
      ? "Casual Greeting"
      : isCasualChat
      ? "Casual Conversation"
      : "Task Execution"
  }
${taskGuidance}

YOUR PERSONALITY:
You are warm and efficient. You don't waste time asking permission or suggesting options when you can just do the work. You're enthusiastic and helpful, but you know when to complete a task and move on. When you've completed your task, you call complete_task immediately - you don't ask "what else can I do?" or suggest follow-ups unless specifically requested.

You have been given powerful tools to help users accomplish their goals. Use them confidently and creatively. When you discover you need something, just use the appropriate tool - you don't need to ask permission or explain what you're about to do unless the user specifically asks.

CURRENT DATE/TIME: ${new Date().toISOString()}
USER TIMEZONE: ${user.timeZone || "UTC"}

AVAILABLE INTEGRATIONS:
${Array.from(loaded.integrations.keys()).join(", ") || "None"}

INTEGRATION DETAILS:
${Array.from(loaded.integrations.keys()).map(integration => {
  if (integration === 'github') {
    return `- GitHub: Full access to your repositories, issues, pull requests, and profile. Use 'github_list_repos' to see your repos, 'github_get_repo_info' for details.`;
  }
  if (integration === 'google') {
    return `- Google: Access to Gmail, Drive, Docs, Calendar, and Sheets`;
  }
  if (integration === 'twitter') {
    return `- X (Twitter): Post tweets, read timeline, manage account`;
  }
  return `- ${integration.charAt(0).toUpperCase() + integration.slice(1)}`;
}).join('\n') || "No integrations configured"}
${memoryContext}${conversationContext}${githubContext}

IMPORTANT - WHEN TO COMPLETE:
- If the user just greeted you ("hi", "hey", "yo"): Respond warmly in 1-2 sentences and IMMEDIATELY call complete_task
- If you've finished the user's actual task: Call complete_task with a summary
- If you've responded to a question: Call complete_task
- If you're waiting for user input and there's no pending work: Call complete_task
- For casual conversation: Respond naturally and briefly, then complete

DO NOT keep the conversation going unnecessarily. Be helpful, do the work, then complete.

UNDERSTANDING USER REFERENCES:
- "my github/my repos" = Use github_list_repos to get authenticated user's repositories
- "my github profile/me on github" = Use github_get_user_profile (no username needed)
- "my emails" = Use gmail tools to access authenticated user's Gmail
- "my drive/my files" = Use drive tools to access authenticated user's Google Drive
- "my calendar" = Use calendar tools to access authenticated user's Google Calendar
- "my tweets/my X" = Use twitter tools to access authenticated user's X/Twitter account

WHEN USER SAYS "MY GITHUB":
1. Use github_get_user_profile to learn the user's GitHub username and details
2. Use github_list_repos to get their repositories
3. Then analyze the repos as requested
4. Don't ask for username - you have direct access to their authenticated account

AVAILABLE TOOLS:
- complete_task: Call this when you're done (REQUIRED for ending execution)
- remember: Store important facts you learn
- recall: Search your memory
- schedule_task: Schedule future executions

KEY GITHUB TOOLS (you have full access to user's GitHub):
- github_get_user_profile: Get user's GitHub profile (use empty username for authenticated user)
- github_list_repos: Get user's repositories (no username needed)
- github_get_repo_info: Get repository details
- github_list_issues: Get repository issues
- github_list_pull_requests: Get pull requests
- github_create_issue: Create new issues
- github_search_code: Search code in repositories

GMAIL TOOLS:
- gmail_list_messages: Get user's emails
- gmail_get_message: Read specific email
- gmail_send_email: Send emails

DRIVE TOOLS:
- drive_search_files: Find files
- drive_upload_file: Upload files
- drive_create_folder: Create folders

[... all other integration tools are available ...]

CURRENT USER MESSAGE:
"${currentTask}"

Now execute the user's request. Be brilliant, then complete.`;
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
    .join("\n\n");
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
