import { LoadedAgent } from "./agentLoader";
import { TriggerType } from "../models/Trigger";
import { MemoryEntry } from "./aiCaller";

// ============================================
// CONTEXT BUILDER
// ============================================
// Builds the execution context that gets passed
// to the AI. This is what the AI "sees".
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
  previousExecutions?: any[]; // Recent execution history for memory
  
  // ITERATIVE MODE FIELDS (new - for THINK→DECIDE→ACT→OBSERVE loop)
  iteration?: number;           // Current iteration number (1-indexed)
  maxIterations?: number;       // Maximum allowed iterations
  actionHistory?: any[];        // Actions executed in current execution
  observations?: string[];      // AI observations from each iteration
  iterativeMemory?: MemoryEntry[]; // Structured memory within current execution
}

export const buildContext = (
  loaded: LoadedAgent,
  triggerType: TriggerType,
  triggerPayload: Record<string, any>,
  previousExecutions?: any[]
): ExecutionContext => {
  return {
    agent: {
      id: loaded.agent._id.toString(),
      name: loaded.agent.name,
      description: loaded.agent.description
    },
    trigger: {
      type: triggerType,
      payload: triggerPayload
    },
    environment: {
      timestamp: new Date().toISOString(),
      timezone: loaded.user.timeZone || "UTC"
    },
    availableActions: loaded.agent.actions,
    availableIntegrations: Array.from(loaded.integrations.keys()),
    previousExecutions: previousExecutions || []
  };
};

// ============================================
// ITERATIVE CONTEXT BUILDER
// ============================================
// Builds context for iterative execution loop.
// Includes action history and observations from
// previous iterations within the same execution.
// ============================================
export const buildIterativeContext = (
  loaded: LoadedAgent,
  triggerType: TriggerType,
  triggerPayload: Record<string, any>,
  iteration: number,
  maxIterations: number,
  actionHistory: any[],
  observations: string[],
  iterativeMemory: MemoryEntry[],  // Changed to structured memory
  previousExecutions?: any[]
): ExecutionContext => {
  const baseContext = buildContext(loaded, triggerType, triggerPayload, previousExecutions);
  
  return {
    ...baseContext,
    iteration,
    maxIterations,
    actionHistory,
    observations,
    iterativeMemory
  };
};

// Build the system prompt for the AI
export const buildSystemPrompt = (
  loaded: LoadedAgent,
  context: ExecutionContext
): string => {
  // SIMPLIFIED UX: Use instructions if present, otherwise fall back to brain.systemPrompt
  const baseInstructions = loaded.agent.instructions || loaded.agent.brain.systemPrompt || "You are a helpful AI agent. Follow the user's instructions precisely.";
  
  // ============================================
  // BUILD CAPABILITY-GROUPED TOOLS SECTION
  // ============================================
  // ============================================
  // BUILD CAPABILITY-GROUPED TOOLS SECTION
  // ============================================
  const { getAvailableActions } = require("../capabilities/executor");
  const { Capability } = require("../capabilities/types");
  const { getAvailableToolDefinitions } = require("../adapters/toolDefinitions");
  const { ToolCapability } = require("../adapters/types"); // Legacy enum
  
  // 1. NEW CAPABILITIES (Human-Action Layer)
  const newActions = getAvailableActions(context.availableIntegrations);
  const actionsByCap: Record<string, any[]> = {};
  
  for (const action of newActions) {
    const cap = action.capability;
    if (!actionsByCap[cap]) actionsByCap[cap] = [];
    actionsByCap[cap].push(action);
  }
  
  let toolsSection = '';
  
  const newCapabilityOrder = [
    Capability.DISCOVER,
    Capability.READ,
    Capability.WRITE,
    Capability.ENGAGE,
    Capability.ORGANIZE,
    Capability.NOTIFY
  ];
  
  const capDescriptions: Record<string, string> = {
    [Capability.DISCOVER]: 'Find information, people, or resources',
    [Capability.READ]: 'Consume and understand content',
    [Capability.WRITE]: 'Create new content',
    [Capability.ENGAGE]: 'React, like, follow, share (Social)',
    [Capability.ORGANIZE]: 'Structure and manage resources (Google/Files)',
    [Capability.NOTIFY]: 'Alert people or systems'
  };
  
  if (newActions.length > 0) {
    toolsSection += '**PRIMARY CAPABILITIES (Recommended):**\n';
    
    for (const cap of newCapabilityOrder) {
      const actions = actionsByCap[cap];
      if (!actions || actions.length === 0) continue;
      
      const capName = cap.toUpperCase();
      toolsSection += `\n*${capName}* - ${capDescriptions[cap] || ''}\n`;
      
      for (const action of actions) {
        // Build signature: action(param1, param2?)
        const params = Object.entries(action.inputSchema || {})
          .map(([key, def]: [string, any]) => {
            return def.required ? key : `${key}?`;
          })
          .join(', ');
          
        toolsSection += `  • ${action.actionId}(${params}): ${action.intent}`;
        if (action.whenToUse) {
          toolsSection += `\n    Use when: ${action.whenToUse}`;
        }
        toolsSection += '\n';
      }
    }
    toolsSection += '\n';
  }
  
  // 2. LEGACY TOOLS (Platform Layer)
  // Filter out legacy tools if we want to be strict, but for now show them
  // as "Advanced/Platform Specific"
  const legacyTools = getAvailableToolDefinitions(context.availableIntegrations);
  
  if (legacyTools.length > 0) {
    toolsSection += '**PLATFORM TOOLS (Advanced):**\n';
    
    // Group by legacy capability
    const legacyByCap: Record<string, any[]> = {};
    for (const tool of legacyTools) {
      const cap = tool.capability;
      if (!legacyByCap[cap]) legacyByCap[cap] = [];
      legacyByCap[cap].push(tool);
    }
    
    // Legacy order
    const legacyOrder = [
      ToolCapability.CODE_MANAGEMENT,
      ToolCapability.COMMUNICATION,
      ToolCapability.RESEARCH,
      ToolCapability.READ_CONTENT,
      ToolCapability.WRITE_CONTENT,
      ToolCapability.NOTIFICATIONS
    ];
    
    for (const cap of legacyOrder) {
      const tools = legacyByCap[cap];
      if (!tools || tools.length === 0) continue;
      
      const capName = cap.toUpperCase().replace(/_/g, ' ');
      toolsSection += `\n*${capName}*\n`;
      
      for (const tool of tools) {
        // Shorter listing for legacy tools to save tokens
        toolsSection += `  • ${tool.name}: ${tool.description}\n`;
      }
    }
  }
  
  const integrationsList = context.availableIntegrations.length > 0
    ? context.availableIntegrations.join(", ")
    : "none connected";

  // Build iterative mode context string if in iterative mode
  const iterativeContext = context.iteration ? `
---
🔄 ITERATIVE EXECUTION MODE (THINK→DECIDE→ACT→OBSERVE→MEMORY→REPLAN):

You are in iteration ${context.iteration} of ${context.maxIterations}.

**HOW ITERATIVE MODE WORKS:**
1. THINK: Analyze current situation and previous results
2. DECIDE: Choose ONE action to take next
3. ACT: System executes your chosen action
4. OBSERVE: You receive the action result
5. MEMORY: Update your understanding
6. REPLAN: Decide whether to continue or stop

**RESPONSE FORMAT FOR ITERATIVE MODE:**
{
  "reasoning": "Why I'm taking this specific action now",
  "action": { "type": "action_name", "params": {...} },  // ONE action only
  "observation": "What I expect to learn from this action",
  "continue": true,  // Set to false when task is complete
  "goalAchieved": false,  // Set to true when goal is met
  "memory": { "key": "value" }  // State to remember for next iteration
}

**CURRENT ITERATION STATE:**
- Iteration: ${context.iteration} / ${context.maxIterations}
- Actions executed so far: ${context.actionHistory?.length || 0}
${context.actionHistory && context.actionHistory.length > 0 ? `
- Previous actions:
${context.actionHistory.map((a: any, i: number) => `  ${i + 1}. ${a.type} - ${a.error ? 'FAILED: ' + a.error : 'SUCCESS'}`).join('\n')}
` : ''}
${context.observations && context.observations.length > 0 ? `
- Previous observations:
${context.observations.map((o: string, i: number) => `  ${i + 1}. ${o}`).join('\n')}
` : ''}
${context.iterativeMemory && context.iterativeMemory.length > 0 ? `
- Current memory (${context.iterativeMemory.length} entries):
${context.iterativeMemory.map((m: MemoryEntry, i: number) => `  ${i + 1}. [${m.type}] ${m.source} @ ${m.timestamp}: ${JSON.stringify(m.payload)}`).join('\n')}
` : ''}

**STRUCTURED MEMORY SYSTEM:**
You can store structured memory entries to track facts, errors, decisions, and constraints.

Memory entry format:
{
  "source": "ai",  // ai | system | action | user
  "timestamp": "${context.environment.timestamp}",  // Use current timestamp
  "type": "fact",  // fact | error | decision | constraint
  "payload": { "key": "value" }  // Your data
}

Memory types:
- fact: Factual information (IDs, URLs, data retrieved)
- error: Errors encountered and how you handled them
- decision: Strategic decisions you made and why
- constraint: Limitations or rules you discovered

Example response with memory:
{
  "action": { "type": "google_docs_create_doc", "params": {...} },
  "memory": [
    {
      "source": "ai",
      "timestamp": "${context.environment.timestamp}",
      "type": "decision",
      "payload": { 
        "decision": "Creating doc before email",
        "reason": "Need doc link for email content"
      }
    }
  ],
  "continue": true
}

**🚨 CRITICAL SAFETY RULES:**

1. **NEVER GUESS IDS OR IDENTIFIERS**
   - ❌ BAD: "documentId": "abc123"  // Hardcoded guess
   - ✅ GOOD: "documentId": "{{create_google_doc.documentId}}"  // From previous action

2. **ALWAYS DERIVE PARAMETERS FROM MEMORY OR RESULTS**
   - ❌ BAD: "issueNumber": 42  // Assumed value
   - ✅ GOOD: "issueNumber": "{{create_github_issue.number}}"  // From action result

3. **CHECK DEPENDENCIES BEFORE USE**
   - If you need data from a previous action, verify it succeeded
   - If previous action failed → choose RECOVER decision
   - If data is missing → choose RECOVER decision

4. **VALIDATE TOOL OUTPUTS**
   - If output doesn't match expectations → choose ADJUST decision
   - If output is null/empty → choose RECOVER decision
   - Store unexpected outputs in memory for analysis

**GOOD vs BAD EXAMPLES:**

**Example 1: Creating and Using a Document**

❌ BAD (Guessing IDs):
Iteration 1:
{
  "action": { "type": "create_google_doc", "params": { "title": "Report" } },
  "replanDecision": "CONTINUE",
  "continue": true
}

Iteration 2:
{
  "action": {
    "type": "send_email",
    "params": {
      "to": "user@example.com",
      "subject": "Report",
      "html": "View: https://docs.google.com/document/d/GUESSED_ID"  // ❌ WRONG
    }
  },
  "replanDecision": "CONTINUE",
  "continue": false
}

✅ GOOD (Using Results):
Iteration 1:
{
  "action": { "type": "create_google_doc", "params": { "title": "Report" } },
  "memory": [
    {
      "source": "ai",
      "timestamp": "${context.environment.timestamp}",
      "type": "decision",
      "payload": { "decision": "Creating doc first to get link" }
    }
  ],
  "replanDecision": "CONTINUE",
  "continue": true
}

Iteration 2 (after observing result):
{
  "action": {
    "type": "send_email",
    "params": {
      "to": "user@example.com",
      "subject": "Report",
      "html": "View: {{create_google_doc.webViewLink}}"  // ✅ CORRECT
    }
  },
  "replanDecision": "CONTINUE",
  "continue": false,
  "goalAchieved": true
}

**Example 2: Handling Failures**

❌ BAD (Ignoring Errors):
Iteration 1 result: { "error": "Repository not found" }

Iteration 2:
{
  "action": { "type": "create_github_issue", "params": {...} },  // ❌ Trying again with same params
  "replanDecision": "CONTINUE",  // ❌ Should be RECOVER
  "continue": true
}

✅ GOOD (Recovery):
Iteration 1 result: { "error": "Repository not found: user/wrong-repo" }

Iteration 2:
{
  "action": { "type": "github_list_repos", "params": {} },
  "replanDecision": "RECOVER",  // ✅ CORRECT
  "replanReason": "Repository name was incorrect, listing repos to find correct name",
  "recoveryStrategy": "List all repos, find the correct one, then retry issue creation",
  "memory": [
    {
      "source": "ai",
      "timestamp": "${context.environment.timestamp}",
      "type": "error",
      "payload": {
        "failedAction": "create_github_issue",
        "error": "Repository not found",
        "lesson": "Must verify repo name before creating issues"
      }
    }
  ],
  "continue": true
}

**Example 3: Unexpected Output**

❌ BAD (Assuming Success):
Iteration 1 result: { "ok": false, "error": "channel_not_found" }

Iteration 2:
{
  "action": { "type": "slack_send_message", "params": {...} },  // ❌ Trying again
  "replanDecision": "CONTINUE",  // ❌ Should be ADJUST
  "continue": true
}

✅ GOOD (Adjusting):
Iteration 1 result: { "ok": false, "error": "channel_not_found" }

Iteration 2:
{
  "action": { "type": "slack_list_channels", "params": {} },
  "replanDecision": "ADJUST",  // ✅ CORRECT
  "replanReason": "Channel name was invalid, need to list channels first",
  "adjustments": ["List channels to find correct channel ID"],
  "memory": [
    {
      "source": "ai",
      "timestamp": "${context.environment.timestamp}",
      "type": "error",
      "payload": {
        "failedAction": "slack_send_message",
        "error": "channel_not_found",
        "adjustment": "List channels first"
      }
    }
  ],
  "continue": true
}

**DYNAMIC REPLANNING:**

After EVERY action, you MUST explicitly choose a replanning decision:

1. **CONTINUE** - Goal on track, proceed as planned
   - Action succeeded as expected
   - Next step is clear
   - No adjustments needed

2. **ADJUST** - Minor changes needed
   - Action succeeded but output unexpected
   - Need to modify approach
   - Goal still achievable with changes

3. **RECOVER** - Error occurred, attempt recovery
   - Action failed
   - Error is recoverable
   - Alternative approach exists

4. **ABORT** - Unrecoverable error
   - Goal is impossible
   - User intervention required
   - No recovery strategy available

**Response format:**
{
  "action": { "type": "...", "params": {...} },
  "replanDecision": "CONTINUE",  // REQUIRED: CONTINUE | ADJUST | RECOVER | ABORT
  "replanReason": "Why this decision was made",  // REQUIRED
  "recoveryStrategy": "If RECOVER, what's the plan",  // Optional
  "adjustments": ["change1", "change2"],  // Optional for ADJUST
  "memory": [...],
  "continue": true
}

**IMPORTANT:**
- ALWAYS provide replanDecision and replanReason
- Failures should trigger RECOVER, not ABORT (unless truly unrecoverable)
- Store unexpected outputs in memory
- Explain your reasoning in replanReason

**Current replanning state:**
${context.iteration && context.iteration > 1 ? `
- Recovery attempts: ${(context as any).recoveryAttempts || 0}/${(context as any).maxRecoveryAttempts || 3}
${(context as any).adjustmentsMade && (context as any).adjustmentsMade.length > 0 ? `- Adjustments made: ${(context as any).adjustmentsMade.join(', ')}` : ''}
${(context as any).lastError ? `- Last error: ${(context as any).lastError}` : ''}
` : ''}

**WHEN TO STOP:**
- Set "continue": false when the goal is achieved
- Set "goalAchieved": true when task is complete
- You will automatically stop at iteration ${context.maxIterations}

**IMPORTANT:** Return ONE action per iteration. The system will call you again after execution.
` : '';

  // ONE-SHOT MODE instructions (backward compatible)
  const oneShotInstructions = !context.iteration ? `
---
📋 ONE-SHOT MODE (for simple tasks):

For simple tasks that don't require iteration, you can return multiple actions at once:
{
  "reasoning": "...",
  "executionName": "Task name",
  "actions": [
    { "type": "action1", "params": {...} },
    { "type": "action2", "params": {...} }
  ],
  "memory": { "key": "value" }
}

All actions will be executed sequentially in one go.
` : '';

  return `${baseInstructions}

---
CONTEXT:
- Current time: ${context.environment.timestamp}
- Timezone: ${context.environment.timezone}
- Trigger type: ${context.trigger.type}
- Connected integrations: ${integrationsList}

---
🛠️ AVAILABLE TOOLS (grouped by capability):
${toolsSection}
${iterativeContext}
${oneShotInstructions}

---
🧠 TWO-PHASE PLANNING APPROACH:

Before generating actions, ALWAYS think through your plan in two phases:

**PHASE 1 - ANALYSIS:**
1. What is the user's goal?
2. What data do I need from previous executions (check memory)?
3. What data do I need to fetch from APIs?
4. What is the correct SEQUENCE of actions?
5. Are there any dependencies between actions?

**PHASE 2 - EXECUTION PLAN:**
Generate your action sequence with:
- Correct action names (x_post_tweet NOT twitter_post_tweet)
- Proper parameter templates referencing previous results
- Memory updates to persist important IDs/state

**Example - Complex Workflow:**
TASK: "Send email with my latest GitHub commits"

PHASE 1 ANALYSIS:
- Goal: Email user with commit history
- Data needed: Repository name (from API), commits (from API)
- Sequence: 1) List repos → 2) Get commits → 3) Send email
- Dependencies: Commits depend on repo name

PHASE 2 EXECUTION:
\`\`\`json
{
  "reasoning": "Breaking into 3 sequential steps: list repos to get repo name, fetch commits using that name, compose and send email with results",
  "executionName": "GitHub Commits Email Digest",
  "actions": [
    { "type": "github_list_repos", "params": {} },
    { 
      "type": "github_list_commits", 
      "params": {
        "owner": "{{github_list_repos.0.owner.login}}",
        "repo": "{{github_list_repos.0.name}}"
      }
    },
    {
      "type": "email_send",
      "params": {
        "to": "{{user.email}}",
        "subject": "Latest Commits",
        "html": "<p>Latest commit: {{github_list_commits.0.commit.message}}</p>"
      }
    }
  ]
}
\`\`\`

---
CHAINING ACTIONS & TEMPLATES:
You can use results from previous actions and user data in subsequent actions using Handlebars templates.
Available context variables:
- user: properties like {{user.email}}, {{user.name}}
- agent: properties like {{agent.name}}, {{agent.id}}
- {action_type}: The result object of a previous action.
  - google_docs_create_doc: { documentId, title, webViewLink }
  - google_docs_get_doc: { documentId, title, body }
  - github_list_repos: [ { name, owner: { login }, description }, ... ]
  - x_get_user_tweets: [ { id, text, created_at }, ... ]

CRITICAL TEMPLATE RULES:
1. Templates can ONLY reference previous action results - you CANNOT call new actions inside templates
2. NO nested loops with params like {{#action params={...}}} - this is INVALID Handlebars
3. To use data from multiple actions, execute them SEQUENTIALLY, then reference results in later actions
4. If you need a userId for Twitter, first call x_get_profile (no params) to get your own user ID
5. ALWAYS use double curly braces: {{variable}} NOT {variable}

${context.previousExecutions && context.previousExecutions.length > 0 ? `
---
💾 MEMORY & PREVIOUS EXECUTIONS:
You have access to the last ${context.previousExecutions.length} successful executions for this agent:

${context.previousExecutions.map((exec: any, idx: number) => `
Execution ${idx + 1} (${new Date(exec.createdAt).toISOString()}):
- Name: ${exec.name || 'Unnamed'}
${exec.reasoning ? `- Reasoning: ${exec.reasoning}` : ''}
${exec.memory && Object.keys(exec.memory).length > 0 ? `- Memory: ${JSON.stringify(exec.memory, null, 2)}` : '- Memory: (empty)'}
- Actions: ${exec.actionsExecuted?.length || 0} executed
`).join('\n')}

🔒 MEMORY-FIRST RULES (CRITICAL):

**BEFORE** every resource creation action (create_doc, create_issue, etc.), you MUST:

1. **CHECK MEMORY**: Look for existing resource IDs in previous execution memory
2. **DECISION TREE**:
   - ✅ ID found in memory → REUSE IT (skip creation, use get/update actions instead)
   - ❌ ID NOT in memory → CREATE NEW and SAVE ID to memory
3. **MEMORY NAMING**: Use consistent keys: 
   - Google Docs: "{purpose}DocId", "{purpose}DocLink"
   - GitHub: "{purpose}IssueNumber", "{purpose}IssueUrl"
   - Tweets: "{purpose}TweetId", "{purpose}ThreadIds"
4. **ALWAYS UPDATE MEMORY**: Even if just accessing existing resources, update access timestamps

**WRONG** (Creates duplicate resources):
\`\`\`json
{
  "reasoning": "Creating content plan doc",
  "actions": [
    { "type": "google_docs_create_doc", "params": { "title": "Content Plan" } }
  ]
}
\`\`\`

**RIGHT** (Checks memory first - DAY 1):
\`\`\`json
{
  "reasoning": "No contentPlanDocId in memory. Creating new doc and storing ID.",
  "executionName": "Content Plan - Day 1 Setup",
  "actions": [
    { "type": "google_docs_create_doc", "params": { "title": "30-Day Content Plan" } }
  ],
  "memory": {
    "contentPlanDocId": "{{google_docs_create_doc.documentId}}",
    "contentPlanDocLink": "{{google_docs_create_doc.webViewLink}}",
    "createdAt": "{{environment.timestamp}}"
  }
}
\`\`\`

**RIGHT** (Checks memory first - DAY 2+):
\`\`\`json
{
  "reasoning": "Found contentPlanDocId (abc123) in memory. Doc exists, using get instead of create.",
  "executionName": "Content Plan - Day 2 Update",
  "actions": [
    { "type": "google_docs_get_doc", "params": { "documentId": "abc123" } }
  ],
  "memory": {
    "contentPlanDocId": "abc123", 
    "contentPlanDocLink": "https://docs.google.com/document/d/abc123",
    "lastAccessedAt": "{{environment.timestamp}}"
  }
}
\`\`\`

CRITICAL: Memory prevents duplicate resources and API waste!
` : ''}

TRIGGER PAYLOAD:
${JSON.stringify(context.trigger.payload, null, 2)}

---
ACTION NAMING CONVENTIONS:
All action names follow the pattern: {platform}_{action_name}

Examples:
- Twitter/X: x_post_tweet, x_post_thread, x_get_user_tweets (NOT twitter_post_tweet!)
- GitHub: github_create_issue, github_list_commits
- Slack: slack_send_message, slack_get_messages
- Instagram: ig_upload_post, ig_get_profile
- Google: google_calendar_create_event, google_gmail_send_email
- Email: email_send
- HTTP: http_request

IMPORTANT: Use the EXACT action names from the available actions list above!

---
SYSTEM THINKING:
- You are not just a task executor; you are a system orchestrator.
- PLAN SEQUENTIALLY: Break complex tasks into simple sequential steps. Get data first, then use it.
- VERIFY: If the user asks for something from GitHub, list the repositories or commits first to be sure you have the right data.
- NO PLACEHOLDERS: NEVER use text like "FILL_IN_LINK" or "REPLACE_ME". If you don't have a value, try to find it with a "get" or "list" action first.
- BE PRECISE: Use the exact IDs and names returned from previous action results. Always use the {{action_name.property}} syntax to reference data.
- GOOGLE DOCS: When using google_docs_edit_doc, you MUST use the "requests" parameter (an array of request objects). NEVER use "edits".
- TWITTER/X: For timeline access, use x_get_mentions (no userId required) or first call x_get_profile to get your userId, then use x_get_user_tweets with that ID.
- KEEP IT SIMPLE: Don't try to do everything in one template. Execute actions in order, reference results in later steps.

---
EMAIL STYLING:
When sending HTML emails, ALWAYS use inline CSS and proper styling:

1. **Use inline styles** - Email clients don't support <style> tags
2. **Table-based layout** - Use tables for structure (email clients have poor CSS support)
3. **Professional design** - Include colors, spacing, and clean typography
4. **Real data only** - Template variables must be resolved before sending

Example well-styled email body:
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Your Weekly Update</h1>
  </div>
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #667eea; margin-top: 0;">GitHub Activity</h2>
    <p>Latest commit: <strong>Added new feature</strong></p>
    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea;">
      <p style="margin: 0;">Repository: my-project</p>
      <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">By John Doe - 2 hours ago</p>
    </div>
  </div>
</body>
</html>

CRITICAL: Email body must have ALL data filled in, NO template code like {{variable}}.

---
INSTRUCTIONS:
You must respond with a valid JSON object containing:
- "reasoning": (REQUIRED) Explain your thinking. What did you check in memory? Why did you choose these actions?
- "executionName": a concise, human-readable name for this execution
- "actions": an array of action objects
- "memory": (optional) Key-value object to persist state for future executions

Each action must have:
- "type": one of the available actions listed above (use EXACT name!)
- "params": an object with the parameters for that action

Example response WITH memory:
{
  "reasoning": "Checked previous executions. Found contentPlanDocId in memory, so skipping doc creation. Posting day 2 content to X.",
  "executionName": "Post Day 2 Content",
  "actions": [
    {
      "type": "x_post_tweet",
      "params": {
        "text": "Day 2: Unlock Scalable Automation with Axle!"
      }
    },
    {
      "type": "email_send",
      "params": {
        "to": "{{user.email}}",
        "subject": "Day 2 Posted",
        "body": "Your day 2 content was posted successfully."
      }
    }
  ],
  "memory": {
    "contentPlanDocId": "1XBSkoyhG2ya1U9WlgC8M4MrclnSucuOKXj7AzV1rxXc",
    "lastPostedDay": 2,
    "lastPostTime": "2025-12-25T12:00:00Z"
  }
}

If no action is needed, respond with:
{
  "reasoning": "All tasks completed in previous execution. No further action required.",
  "executionName": "No action required",
  "actions": [],
  "memory": {}
}

IMPORTANT:
- ALWAYS include "reasoning" to explain your decisions
- Only use actions from the available list
- Use the EXACT action names (e.g., x_post_tweet NOT twitter_post_tweet)
- Only use integrations that are connected
- Respond ONLY with valid JSON, no explanations`
};

export default { buildContext, buildSystemPrompt };

