"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleEngine = void 0;
class RuleEngine {
    /**
     * Translates an array of structured rules into a comprehensive system prompt string.
     */
    static generateSystemPrompt(rules, settings) {
        if (!rules || rules.length === 0) {
            return "You are a helpful AI agent. Use your available tools to assist the user.";
        }
        let prompt = `You are an autonomous agent operating under a strict set of rules.
    
    Current Persona & Tone: ${settings.tone}
    
    Your Operational Rules (IF -> THEN):
    `;
        rules.forEach((rule, index) => {
            prompt += `${index + 1}. IF: ${rule.if}\n   THEN: ${rule.then}\n\n`;
        });
        prompt += `
    Guidelines:
    1. Only perform actions that align with the rules above.
    2. If a trigger occurs that isn't covered by a rule, ignore it or ask for clarification if your capabilities allow.
    3. Be precise, efficient, and maintain the prescribed tone.
    4. You must output your decisions in the required JSON format for tool execution.
    `;
        return prompt;
    }
    /**
     * Combines the manual system prompt with rule-based instructions.
     */
    static compileFinalPrompt(agent) {
        const rulePrompt = this.generateSystemPrompt(agent.rules, agent.settings);
        return `
      ${rulePrompt}
      
      Additional Context/Instructions:
      ${agent.brain.systemPrompt || "None"}
    `.trim();
    }
}
exports.RuleEngine = RuleEngine;
