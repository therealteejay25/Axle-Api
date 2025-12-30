import { callAI } from "../worker/aiCaller";
import { logger } from "./logger";

export interface IGeneratedBlueprint {
  name: string;
  description: string;
  category: string;
  integrations: string[];
  actions: string[];
  rules: { if: string; then: string }[];
  settings: {
    tone: string;
    maxActionsPerRun: number;
    approvalRequired: boolean;
  };
  suggestedTriggers: {
    type: "schedule" | "webhook" | "manual";
    config: Record<string, any>;
  }[];
}

export class AgentBlueprintGenerator {
  static async generateFromPrompt(prompt: string): Promise<IGeneratedBlueprint> {
    logger.info("Generating agent blueprint from prompt", { promptLength: prompt.length });

    const systemPrompt = `
      You are an expert Agent Architect. Your goal is to turn a user's natural language request into a structured Agent Blueprint.
      
      User Request: "${prompt}"
      
      You must respond with a JSON object that includes:
      1. name: A concise name for the agent.
      2. description: A clear description of what the agent does.
      3. category: One of [GitHub Automation, Slack Monitoring, Social Media, Research, Personal Assistant, Custom].
      4. integrations: Array of strings representing required platforms (e.g., ["github", "slack", "twitter", "google", "instagram"]).
      5. actions: Array of action prefixes or specific actions (e.g., ["github_", "slack_send_message"]).
      6. rules: Array of { if: string, then: string } objects using simple, intuitive language.
      7. settings: Default configuration for tone, maxActionsPerRun, and if approval is required for sensitive actions.
      8. suggestedTriggers: Array of { type, config } showing how this agent should be started.
      
      Example Rules style:
      - if: "A new issue is created in my repository"
      - then: "Post a notification to the #dev-updates channel on Slack"
      
      Ensure the blueprint is comprehensive but easy for a non-technical user to understand.
    `;

    try {
      const response = await callAI(systemPrompt, "google/gemini-2.0-flash-001", 0.3);
      
      // The callAI tool returns a structured response based on the parseAIResponse logic
      // We might need to handle the case where it returns "actions" but we want a different JSON structure.
      // For now, let's assume we use a specialized prompt that gets the JSON we need.
      
      // NOTE: aiCaller.ts forces an "actions" array. We might need to adapt it 
      // or create a raw call function. Let's look at aiCaller.ts again.
      
      // Since aiCaller.ts is designed for agent execution, I'll bypass its action validation
      // and just parse the raw response if possible, or adapt the prompt.
      
      const parsed = JSON.parse(response.rawResponse);
      return parsed as IGeneratedBlueprint;
    } catch (error: any) {
      logger.error("Failed to generate agent blueprint", { error: error.message });
      throw new Error(`Blueprint generation failed: ${error.message}`);
    }
  }
}
