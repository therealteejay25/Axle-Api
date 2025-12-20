import { LoadedAgent } from "./agentLoader";
import { TriggerType } from "../models/Trigger";

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

// Build the system prompt for the AI
export const buildSystemPrompt = (
  loaded: LoadedAgent,
  context: ExecutionContext
): string => {
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

export default { buildContext, buildSystemPrompt };
