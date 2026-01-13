"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = exports.buildContext = void 0;
const buildContext = (loaded, triggerType, triggerPayload) => {
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
exports.buildContext = buildContext;
// ============================================
// DYNAMIC PROMPT SYSTEM
// ============================================
// Clean, modular prompt builder for agent execution
// ============================================
const buildSystemPrompt = (loaded, context) => {
    const agent = loaded.agent;
    const user = loaded.user;
    const integrations = Array.from(loaded.integrations.keys());
    // Build user context
    const userContext = buildUserContext(user);
    // Build integration context
    const integrationContext = buildIntegrationContext(loaded.integrations);
    // Build task context
    const task = context.trigger.payload?.task || "Execute assigned task";
    // Construct final prompt
    return `You are ${agent.name}${agent.description ? `: ${agent.description}` : ""}

${userContext}

${integrationContext}

CURRENT TASK: ${task}

INSTRUCTIONS:
You are an AI assistant. Think step by step and provide helpful responses based on your knowledge and the available context.

RESPONSE FORMAT:
{
  "reasoning": "Explain your approach and what you know",
  "response": "Your final answer or action plan",
  "confidence": "high|medium|low"
}`;
};
exports.buildSystemPrompt = buildSystemPrompt;
// ============================================
// MODULAR PROMPT COMPONENTS
// ============================================
function buildUserContext(user) {
    if (!user)
        return "USER: No user information available";
    return `USER PROFILE:
- Name: ${user.name || "Unknown"}
- Email: ${user.email || "Unknown"}
- Timezone: ${user.timeZone || "UTC"}`;
}
function buildIntegrationContext(integrations) {
    const integrationList = Array.from(integrations.keys());
    if (integrationList.length === 0)
        return "INTEGRATIONS: None connected";
    let context = `CONNECTED INTEGRATIONS: ${integrationList.join(", ")}

INTEGRATION DETAILS:`;
    for (const [provider, integration] of integrations.entries()) {
        const metadata = integration?.metadata || {};
        switch (provider) {
            case "github":
                context += `\n- GitHub: ${metadata.githubLogin || "Unknown"} (${metadata.githubName || ""})`;
                break;
            case "twitter":
            case "x":
                context += `\n- X/Twitter: ${metadata.xUsername || "Unknown"} (${metadata.xName || ""})`;
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
exports.default = { buildContext: exports.buildContext, buildSystemPrompt: exports.buildSystemPrompt };
