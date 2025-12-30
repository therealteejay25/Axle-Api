"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeDecision = exports.executeAgent = exports.executeTool = void 0;
const registry_1 = require("../tools/registry");
const Agent_1 = require("../models/Agent");
// Get tool by name
const getToolByName = (name) => {
    return registry_1.tools.find((t) => {
        return (t.name === name || t.toolName === name || (t.tool && t.tool.name === name));
    });
};
// Extract execute or invoke function from tool
const getExecuteFn = (tool) => {
    if (!tool)
        return undefined;
    // Try invoke first (OpenAI tool() format)
    if (typeof tool.invoke === "function") {
        return tool.invoke;
    }
    // Try execute
    if (typeof tool.execute === "function") {
        return tool.execute;
    }
    // Try nested
    if (tool.tool?.invoke && typeof tool.tool.invoke === "function") {
        return tool.tool.invoke;
    }
    if (tool.tool?.execute && typeof tool.tool.execute === "function") {
        return tool.tool.execute;
    }
    return undefined;
};
/**
 * Execute a tool decision
 */
const executeTool = async (decision, userId) => {
    try {
        console.log("[toolExecutor] Executing tool decision:", {
            type: decision.type,
            target: decision.target,
            argsKeys: Object.keys(decision.args || {}),
        });
        if (decision.type !== "tool") {
            return {
                success: false,
                error: `Executor only handles tool decisions. Got: ${decision.type}`,
            };
        }
        const toolName = decision.target;
        const tool = getToolByName(toolName);
        if (!tool) {
            const availableTools = registry_1.tools
                .map((t) => t.name || t.toolName)
                .filter(Boolean)
                .join(", ");
            return {
                success: false,
                error: `Tool not found: ${toolName}. Available: ${availableTools}`,
            };
        }
        console.log("[toolExecutor] Tool found:", toolName);
        const execFn = getExecuteFn(tool);
        console.log("[toolExecutor] Tool object structure:", {
            hasInvoke: typeof tool.invoke === "function",
            hasExecute: typeof tool.execute === "function",
            hasTool: !!tool.tool,
            toolKeys: Object.keys(tool),
            toolType: tool.constructor?.name,
        });
        if (!execFn) {
            return {
                success: false,
                error: `Tool ${toolName} has no executable function`,
            };
        }
        console.log("[toolExecutor] Executing function...");
        // Clean args for JSON safety
        const cleanArgs = JSON.parse(JSON.stringify(decision.args || {}));
        console.log("[toolExecutor] Clean args:", {
            type: typeof cleanArgs,
            keys: Object.keys(cleanArgs),
            preview: JSON.stringify(cleanArgs).substring(0, 200),
        });
        // Call the tool with context
        const context = {
            context: {
                caller: "axle",
                userId,
            },
        };
        let result;
        try {
            // Try with context
            result = await execFn(cleanArgs, context);
        }
        catch (err) {
            // Fallback: try without context
            console.warn("[toolExecutor] First attempt failed, trying without context:", err?.message);
            try {
                result = await execFn(cleanArgs);
            }
            catch (err2) {
                console.error("[toolExecutor] Both attempts failed:", {
                    err1: err?.message,
                    err2: err2?.message,
                });
                throw err; // throw original error
            }
        }
        console.log("[toolExecutor] Tool execution result:", {
            type: typeof result,
            hasError: typeof result === "string" && result.includes("Error"),
        });
        // Check if result contains an error message
        if (typeof result === "string" && result.includes("Error")) {
            return {
                success: false,
                error: result,
            };
        }
        return {
            success: true,
            result,
        };
    }
    catch (err) {
        const errorMsg = err?.message || String(err);
        console.error("[toolExecutor] Error executing tool:", errorMsg);
        return {
            success: false,
            error: errorMsg,
        };
    }
};
exports.executeTool = executeTool;
/**
 * Execute an agent decision (delegate to another agent)
 */
const executeAgent = async (decision, userId) => {
    try {
        console.log("[toolExecutor] Executing agent decision:", {
            target: decision.target,
            input: decision.args?.input,
        });
        if (decision.type !== "agent") {
            return {
                success: false,
                error: `This handler only processes agent decisions. Got: ${decision.type}`,
            };
        }
        // Find the agent
        const agentId = decision.target;
        const agent = await Agent_1.Agent.findById(agentId).lean();
        if (!agent) {
            return {
                success: false,
                error: `Agent not found: ${agentId}`,
            };
        }
        console.log("[toolExecutor] Agent found:", agent.name);
        // Import dynamically to avoid circular dependencies
        const axleAgent = (await Promise.resolve().then(() => __importStar(require("../agent/main")))).default;
        // Run the agent
        const result = await axleAgent.run({
            input: decision.args?.input || "",
            userId: userId || String(agent.ownerId),
            context: {
                agentId,
                delegatedFrom: "parentAgent",
            },
        });
        console.log("[toolExecutor] Agent execution completed");
        return {
            success: true,
            result,
        };
    }
    catch (err) {
        const errorMsg = err?.message || String(err);
        console.error("[toolExecutor] Error executing agent:", errorMsg);
        return {
            success: false,
            error: errorMsg,
        };
    }
};
exports.executeAgent = executeAgent;
/**
 * Execute any decision (tool or agent)
 */
const executeDecision = async (decision, userId) => {
    console.log("[toolExecutor] Executing decision:", {
        type: decision.type,
        target: decision.target,
    });
    if (decision.type === "tool") {
        return (0, exports.executeTool)(decision, userId);
    }
    else if (decision.type === "agent") {
        return (0, exports.executeAgent)(decision, userId);
    }
    else {
        return {
            success: false,
            error: `Unknown decision type: ${decision.type}`,
        };
    }
};
exports.executeDecision = executeDecision;
