"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = exports.buildContext = void 0;
const buildContext = (loaded, triggerType, triggerPayload) => {
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
        availableIntegrations: Array.from(loaded.integrations.keys())
    };
};
exports.buildContext = buildContext;
// Build the system prompt for the AI
const buildSystemPrompt = (loaded, context) => {
    const actionsList = context.availableActions.length > 0
        ? context.availableActions.join(", ")
        : "none configured";
    const integrationsList = context.availableIntegrations.length > 0
        ? context.availableIntegrations.join(", ")
        : "none connected";
    return `${loaded.agent.brain.systemPrompt}

---
CONTEXT:
- Current time: ${context.environment.timestamp}
- Timezone: ${context.environment.timezone}
- Trigger type: ${context.trigger.type}
- Available actions: ${actionsList}
- Connected integrations: ${integrationsList}

TRIGGER PAYLOAD:
${JSON.stringify(context.trigger.payload, null, 2)}

---
INSTRUCTIONS:
You must respond with a valid JSON object containing an "actions" array.
Each action must have:
- "type": one of the available actions listed above
- "params": an object with the parameters for that action

Example response:
{
  "actions": [
    {
      "type": "send_slack_message",
      "params": {
        "channel": "#general",
        "message": "Hello world!"
      }
    }
  ]
}

If no action is needed, respond with:
{
  "actions": []
}

IMPORTANT:
- Only use actions from the available list
- Only use integrations that are connected
- Respond ONLY with valid JSON, no explanations`;
};
exports.buildSystemPrompt = buildSystemPrompt;
exports.default = { buildContext: exports.buildContext, buildSystemPrompt: exports.buildSystemPrompt };
