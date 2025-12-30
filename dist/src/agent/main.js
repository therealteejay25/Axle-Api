"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.axleAgent = void 0;
const openai_1 = __importDefault(require("../lib/openai"));
const registry_1 = require("../tools/registry");
const parseModelJson_1 = require("../lib/parseModelJson");
const prompt_1 = require("../lib/prompt");
const User_1 = require("../models/User");
const Agent_1 = require("../models/Agent");
const Integration_1 = require("../models/Integration");
// Normalize tools - handle both old-style and OpenAI tool() wrapper format
const tools = registry_1.tools.map((tool) => {
    // If tool doesn't have a name, try to extract it from properties
    if (!tool.name && tool.toolName) {
        return { ...tool, name: tool.toolName };
    }
    // If tool is an OpenAI tool with nested structure, normalize it
    if (tool.name && tool.execute) {
        return tool; // Already in good shape
    }
    return tool;
});
// Helper to build rich context from database with comprehensive data
const buildRichContext = async (userId) => {
    try {
        const user = await User_1.User.findById(userId).lean();
        const userAgents = await Agent_1.Agent.find({ ownerId: userId })
            .sort({ updatedAt: -1 })
            .lean();
        const userIntegrations = await Integration_1.Integration.find({ userId })
            .sort({ createdAt: -1 })
            .lean();
        // Get app-wide statistics for better context
        const totalAgents = await Agent_1.Agent.countDocuments({ ownerId: userId });
        const activeAgents = await Agent_1.Agent.countDocuments({
            ownerId: userId,
            "schedule.enabled": true,
        });
        const recentAgentRuns = await Agent_1.Agent.find({ ownerId: userId })
            .sort({ lastRunAt: -1 })
            .limit(5)
            .select("name lastRunAt")
            .lean();
        const agents = userAgents.map((agent) => ({
            id: String(agent._id),
            name: agent.name,
            description: agent.description,
            systemPrompt: agent.systemPrompt,
            tools: agent.tools || [],
            integrations: agent.integrations || [],
            lastRunAt: agent.lastRunAt?.toISOString(),
            schedule: agent.schedule || { enabled: false },
            createdAt: agent.createdAt?.toISOString(),
            isActive: agent.schedule?.enabled || false,
        }));
        const integrations = userIntegrations.map((integration) => ({
            name: integration.name,
            connectedAt: integration.createdAt?.toISOString() || new Date().toISOString(),
            scope: Array.isArray(integration.scope)
                ? integration.scope
                : integration.scope
                    ? [integration.scope]
                    : [],
            expiresAt: integration.expiresAt?.toISOString(),
            isExpired: integration.expiresAt
                ? new Date(integration.expiresAt) < new Date()
                : false,
        }));
        const availableToolNames = tools
            .map((t) => t.name || t.toolName || (t.tool && t.tool.name))
            .filter(Boolean);
        // Categorize tools for better context
        const toolCategories = {
            github: availableToolNames.filter((t) => t.includes("github") ||
                t.includes("issue") ||
                t.includes("pr") ||
                t.includes("commit") ||
                t.includes("branch") ||
                t.includes("release") ||
                t.includes("workflow") ||
                t.includes("notification")),
            slack: availableToolNames.filter((t) => t.includes("slack")),
            x: availableToolNames.filter((t) => t.includes("x") || t.includes("tweet")),
            instagram: availableToolNames.filter((t) => t.includes("instagram")),
            google: availableToolNames.filter((t) => t.includes("google") ||
                t.includes("gmail") ||
                t.includes("drive") ||
                t.includes("sheet") ||
                t.includes("calendar")),
            web: availableToolNames.filter((t) => t.includes("scrape") || t.includes("http") || t.includes("search_web")),
            email: availableToolNames.filter((t) => t.includes("email")),
            data: availableToolNames.filter((t) => t.includes("analyze") ||
                t.includes("extract") ||
                t.includes("compare") ||
                t.includes("aggregate")),
            notification: availableToolNames.filter((t) => t.includes("notification") || t.includes("alert")),
            agent: availableToolNames.filter((t) => t.includes("agent")),
        };
        return {
            user: {
                id: userId,
                name: user?.name || undefined,
                email: user?.email || undefined,
                timeZone: user?.timeZone || undefined,
                workDayStart: user?.workDayStart?.toISOString(),
                workDayEnd: user?.workDayEnd?.toISOString(),
                pricingPlan: user?.pricingPlan,
            },
            agents,
            integrations,
            appData: {
                availableTools: availableToolNames,
                availableIntegrations: integrations.map((i) => i.name),
                // Add comprehensive statistics
                statistics: {
                    totalAgents,
                    activeAgents,
                    totalIntegrations: integrations.length,
                    recentRuns: recentAgentRuns.map((a) => ({
                        name: a.name,
                        lastRunAt: a.lastRunAt?.toISOString(),
                    })),
                },
                toolCategories,
            },
        };
    }
    catch (err) {
        console.error("Error building rich context:", err);
        return {
            user: { id: userId },
            agents: [],
            integrations: [],
            appData: {
                availableTools: tools
                    .map((t) => t.name || t.toolName || (t.tool && t.tool.name))
                    .filter(Boolean),
                availableIntegrations: [],
                statistics: {
                    totalAgents: 0,
                    activeAgents: 0,
                    totalIntegrations: 0,
                    recentRuns: [],
                },
                toolCategories: {},
            },
        };
    }
};
// Helper to extract the execute function from a tool object
const getToolExecuteFn = (tool) => {
    if (!tool)
        return undefined;
    // PRIORITY 1: Try to access the underlying execute function directly
    // OpenAI's tool() wrapper stores the original execute in a private property
    if (tool._execute && typeof tool._execute === "function") {
        console.log("[getToolExecuteFn] Found private _execute function");
        return tool._execute;
    }
    // PRIORITY 2: Check for execute in the tool config/definition
    if (tool.execute && typeof tool.execute === "function") {
        console.log("[getToolExecuteFn] Found execute property");
        return tool.execute;
    }
    // Direct execute property (OpenAI tools)
    if (typeof tool.execute === "function") {
        console.log("[getToolExecuteFn] Found direct execute function");
        return tool.execute;
    }
    // Check if execute exists but isn't enumerable
    if (Object.getOwnPropertyDescriptor(tool, "execute")?.value) {
        const executeFn = Object.getOwnPropertyDescriptor(tool, "execute")?.value;
        if (typeof executeFn === "function") {
            console.log("[getToolExecuteFn] Found non-enumerable execute function");
            return executeFn;
        }
    }
    // Check if execute exists in the tool's prototype chain
    for (let obj = tool; obj; obj = Object.getPrototypeOf(obj)) {
        if (obj.hasOwnProperty("execute") && typeof obj.execute === "function") {
            console.log("[getToolExecuteFn] Found execute in prototype chain");
            return obj.execute;
        }
    }
    // Check if execute exists in tool.tool (nested structure)
    if (tool.tool?.execute && typeof tool.tool.execute === "function") {
        console.log("[getToolExecuteFn] Found execute in tool.tool");
        return tool.tool.execute;
    }
    // invoke property (OpenAI tool() format)
    if (typeof tool.invoke === "function") {
        console.log("[getToolExecuteFn] Found invoke function for tool");
        return tool.invoke;
    }
    // Check if invoke exists but isn't enumerable
    if (Object.getOwnPropertyDescriptor(tool, "invoke")?.value) {
        const invokeFn = Object.getOwnPropertyDescriptor(tool, "invoke")?.value;
        if (typeof invokeFn === "function") {
            console.log("[getToolExecuteFn] Found non-enumerable invoke function");
            return invokeFn;
        }
    }
    // Alternative execute property (backward compat)
    if (typeof tool.run === "function") {
        return tool.run;
    }
    // Direct function
    if (typeof tool.fn === "function") {
        return tool.fn;
    }
    // Tool itself is a function
    if (typeof tool === "function") {
        return tool;
    }
    // Debug: log what we found
    console.warn("[getToolExecuteFn] Tool has no executable function", {
        toolKeys: Object.keys(tool || {}),
        allProps: Object.getOwnPropertyNames(tool || {}),
        toolType: typeof tool,
    });
    return undefined;
};
// Helper to get tool name from tool object
const getToolName = (tool) => {
    if (!tool)
        return undefined;
    if (typeof tool.name === "string")
        return tool.name;
    if (typeof tool.toolName === "string")
        return tool.toolName;
    if (tool.tool?.name)
        return tool.tool.name;
    return undefined;
};
// Simplified conversational runner.
exports.axleAgent = {
    name: "Axle",
    async run(options) {
        console.log("[axleAgent.run] ===== AGENT START =====");
        console.log("[axleAgent.run] Options:", {
            input: options.input?.substring(0, 100),
            userId: options.userId,
            hasContext: !!options.context,
        });
        const { input, context = {}, availableAgents = [], allowedTools, onStep, userId, model = "gpt-4o", // Default to gpt-4o if not specified
         } = options;
        // Build rich context from database if userId is provided
        let system = "";
        if (userId) {
            console.log("[axleAgent.run] Building rich context for userId:", userId);
            const richContext = await buildRichContext(userId);
            console.log("[axleAgent.run] Rich context ready");
            system = (0, prompt_1.buildPromptWithContext)(richContext);
            console.log("[axleAgent.run] System prompt generated, length:", system.length);
        }
        else {
            console.log("[axleAgent.run] No userId, using simple prompt");
            // Fallback to simple prompt if no userId
            const toolList = tools.map((t) => getToolName(t)).filter(Boolean);
            system = `You are Axle, a helpful assistant. You may speak naturally. You have access to the following tools: ${toolList.join(", ")}. If you want to call a tool, include a single JSON object somewhere in your reply matching one of these shapes:\n\nTool call:\n{ "type": "tool", "target": "<tool_name>", "args": { ... } }\n\nOtherwise, just reply in natural language. Do not include multiple JSON objects.\n`;
        }
        const maxLoops = 3;
        let messages = [
            { role: "system", content: system },
            { role: "user", content: input },
        ];
        console.log("[axleAgent.run] Messages initialized with", messages.length, "messages");
        let lastReply = "";
        for (let i = 0; i < maxLoops; i++) {
            console.log(`\n[axleAgent.run] ===== LOOP ${i + 1}/${maxLoops} =====`);
            if (onStep)
                onStep({ status: "model:call", attempt: i + 1 });
            try {
                console.log("[axleAgent.run] Calling OpenAI with messages count:", messages.length);
                console.log("[axleAgent.run] Request details:", {
                    model: "gpt-5",
                    temperature: 0.2,
                    max_tokens: 800,
                    messageCount: messages.length,
                    firstMessageRole: messages[0]?.role,
                    lastMessageRole: messages[messages.length - 1]?.role,
                });
                // Use the model from options, defaulting to gpt-4o
                const resp = await openai_1.default.chat.completions.create({
                    model: "gpt-5",
                    messages,
                });
                console.log("[axleAgent.run] OpenAI response received");
                console.log("[axleAgent.run] Full response object:", JSON.stringify(resp, null, 2));
                console.log("[axleAgent.run] Response choices:", resp.choices);
                console.log("[axleAgent.run] First choice:", resp.choices?.[0]);
                console.log("[axleAgent.run] Message content:", resp.choices?.[0]?.message?.content);
                let content = resp.choices?.[0]?.message?.content || "";
                // Ensure content is a string
                let text = typeof content === "string" ? content : JSON.stringify(content);
                // Fallback: if content is empty but reasoning exists, use reasoning as text
                // This handles cases where the model uses extended thinking/reasoning
                if (!text && resp.choices?.[0]?.message?.reasoning) {
                    console.log("[axleAgent.run] Content empty but reasoning exists, using reasoning as fallback");
                    const reasoning = resp.choices?.[0]?.message?.reasoning;
                    // Try to extract JSON from reasoning
                    const reasoningStr = typeof reasoning === "string"
                        ? reasoning
                        : JSON.stringify(reasoning);
                    console.log("[axleAgent.run] Reasoning length:", reasoningStr.length);
                    // Use the full reasoning text for JSON parsing
                    text = reasoningStr;
                }
                lastReply = text;
                console.log("[axleAgent.run] Model response length:", text.length);
                console.log("[axleAgent.run] Model response preview:", text.substring(0, 200));
                // Try to parse any JSON decision the model embedded
                let decision = null;
                try {
                    console.log("[axleAgent.run] Parsing JSON from model response...");
                    decision = (0, parseModelJson_1.parseModelJson)(text);
                    console.log("[axleAgent.run] JSON parsed successfully:", decision);
                }
                catch (err) {
                    console.log("[axleAgent.run] No JSON found, returning as natural language");
                    // No valid JSON found — return natural language reply
                    if (onStep)
                        onStep({ status: "model:reply", reply: text });
                    return { reply: text };
                }
                if (!decision || !decision.type) {
                    console.log("[axleAgent.run] No decision type in response, returning as text");
                    if (onStep)
                        onStep({ status: "model:reply", reply: text });
                    return { reply: text };
                }
                console.log("[axleAgent.run] Decision detected - Type:", decision.type, "Target:", decision.target);
                // Just return the decision as the reply - let the caller handle tool execution
                // This separates concerns: agent generates decisions, external executor runs tools
                console.log("[axleAgent.run] Returning decision to caller for execution");
                if (onStep)
                    onStep({ status: "decision:generated", decision });
                return { reply: text, decision };
            }
            catch (err) {
                const errorMsg = err?.message || String(err);
                console.error("[axleAgent] Error in agent loop iteration:", errorMsg, err);
                if (onStep)
                    onStep({ status: "model:error", error: errorMsg });
                // Return the error message so user knows what happened
                return { reply: `Agent error: ${errorMsg}` };
            }
        }
        // If loop completes without returning, return the last model reply
        console.log("[axleAgent.run] ===== AGENT COMPLETE =====");
        console.log("[axleAgent.run] Final reply length:", lastReply.length);
        console.log("[axleAgent.run] Final reply:", lastReply);
        return { reply: lastReply };
    },
};
