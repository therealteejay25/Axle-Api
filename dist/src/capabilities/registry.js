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
exports.ToolRegistry = void 0;
const BaseTool_1 = require("./BaseTool");
// UTILITIES - Only keep custom tools not duplicated by Gemini
const UtilityTools = __importStar(require("./plugins/utilities/index"));
/**
 * Registry to manage available tools and instantiate them for agents.
 */
class ToolRegistry {
    static manualTools = [];
    // Custom providers for dynamic/OpenAPI tools
    static providers = [];
    /**
     * Initialize and register all known tools.
     */
    static registerAll() {
        this.manualTools = [];
        // Register Manual Tools
        const add = (T) => {
            const instance = new T();
            // Convert to ADK FunctionTool
            this.manualTools.push(instance.toFunctionTool());
        };
        [UtilityTools].forEach(namespace => {
            Object.values(namespace).forEach(ToolClass => {
                if (typeof ToolClass === 'function' && ToolClass.prototype instanceof BaseTool_1.BaseTool) {
                    add(ToolClass);
                }
            });
        });
    }
    static registerProvider(provider) {
        this.providers.push(provider);
    }
    /**
     * Get tools for a specific agent execution context.
     * Filters based on connected integrations and agent permissions.
     * CRITICAL: Returns pure FunctionTool[] only, no wrappers.
     */
    static async getToolsForAgent(integrations, permissions = []) {
        if (this.manualTools.length === 0 && this.providers.length === 0) {
            this.registerAll();
        }
        const authorizedTools = [];
        // 1. Manual Tools (already FunctionTool instances)
        const manualFiltered = this.manualTools.filter(tool => {
            // Permission check
            if (permissions.length > 0 && !permissions.includes(tool.name) && !permissions.includes('*')) {
                return false;
            }
            // Integration check - utility tools don't require integrations
            if (tool.name.startsWith('http_'))
                return true;
            if (tool.name.startsWith('scrape_'))
                return true;
            if (tool.name.startsWith('research_'))
                return true;
            if (tool.name.startsWith('email_'))
                return true; // Email has fallback logic
            if (tool.name.startsWith('github_') && !integrations.has('github'))
                return false;
            if (tool.name.startsWith('google_') && !integrations.has('google'))
                return false;
            if (tool.name.startsWith('gmail_') && !integrations.has('google'))
                return false;
            if (tool.name.startsWith('calendar_') && !integrations.has('google'))
                return false;
            if (tool.name.startsWith('drive_') && !integrations.has('google'))
                return false;
            if (tool.name.startsWith('docs_') && !integrations.has('google'))
                return false;
            if (tool.name.startsWith('sheets_') && !integrations.has('google'))
                return false;
            if ((tool.name.startsWith('x_') || tool.name.startsWith('twitter_')) && !integrations.has('twitter'))
                return false;
            if (tool.name.startsWith('slack_') && !integrations.has('slack'))
                return false;
            if (tool.name.startsWith('ig_') && !integrations.has('instagram'))
                return false;
            return true;
        });
        authorizedTools.push(...manualFiltered);
        // 2. Dynamic/OpenAPI Tools (Lazy Load)
        // These return BaseTool instances, need to convert to FunctionTool
        if (integrations.has('github')) {
            try {
                const ghTools = await GithubTools.getOpenAPITools({ integrations });
                // Convert BaseTool instances to FunctionTool instances
                if (Array.isArray(ghTools)) {
                    const functionTools = ghTools
                        .filter(t => t && typeof t === 'object' && t instanceof BaseTool_1.BaseTool)
                        .map(tool => tool.toFunctionTool());
                    authorizedTools.push(...functionTools);
                }
            }
            catch (e) {
                console.error('Error loading GitHub OpenAPI tools', e);
            }
        }
        // Generic providers
        for (const provider of this.providers) {
            try {
                const dynamicTools = await provider({ integrations });
                if (Array.isArray(dynamicTools)) {
                    const functionTools = dynamicTools
                        .filter(t => t && typeof t === 'object')
                        .map(tool => tool instanceof BaseTool_1.BaseTool ? tool.toFunctionTool() : tool);
                    authorizedTools.push(...functionTools);
                }
            }
            catch (e) {
                console.error('Failed to load dynamic tools', e);
            }
        }
        // CRITICAL VALIDATION: Ensure all tools are valid FunctionTool instances
        const validated = authorizedTools.filter(tool => {
            if (!tool || typeof tool !== 'object') {
                console.error('Invalid tool detected (not an object)', tool);
                return false;
            }
            if (!('name' in tool)) {
                console.error('Invalid tool detected (missing name)', tool);
                return false;
            }
            return true;
        });
        if (validated.length !== authorizedTools.length) {
            const diff = authorizedTools.length - validated.length;
            console.warn(`Filtered out ${diff} invalid tools`);
        }
        return validated;
    }
}
exports.ToolRegistry = ToolRegistry;
