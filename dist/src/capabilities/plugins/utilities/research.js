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
exports.AnalyzePageTool = exports.SearchWebTool = exports.ResearchWebTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// RESEARCH TOOLS
// ============================================
// ADK-compatible AI-powered research tools
// Converted from legacy adapters/research.ts
// ============================================
/**
 * AI-powered web research on a topic
 */
class ResearchWebTool extends BaseTool_1.BaseTool {
    name = 'research_web';
    description = 'Search the web and gather comprehensive information on a topic using AI. Returns a summary with sources and key points. Use this when you need to research current information or gather data from the internet.';
    inputSchema = zod_1.z.object({
        query: zod_1.z.string().describe('Research query or topic'),
        maxResults: zod_1.z.number().optional().default(5).describe('Maximum number of sources to analyze'),
        depth: zod_1.z.enum(['quick', 'standard', 'deep']).optional().default('standard').describe('Research depth level')
    });
    async runImpl(params, context) {
        const { researchActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/research')));
        return researchActions.research_topic(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.ResearchWebTool = ResearchWebTool;
/**
 * Web search with AI summarization
 */
class SearchWebTool extends BaseTool_1.BaseTool {
    name = 'search_web';
    description = 'Search the web and get AI-summarized results. Faster than full research, good for quick lookups.';
    inputSchema = zod_1.z.object({
        query: zod_1.z.string().describe('Search query'),
        limit: zod_1.z.number().optional().default(10).describe('Number of search results to return')
    });
    async runImpl(params, context) {
        const { researchActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/research')));
        return researchActions.research_web_search(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.SearchWebTool = SearchWebTool;
/**
 * Analyze and summarize a specific webpage
 */
class AnalyzePageTool extends BaseTool_1.BaseTool {
    name = 'research_analyze_page';
    description = 'Analyze a specific webpage and extract key information, main topics, and insights using AI.';
    inputSchema = zod_1.z.object({
        url: zod_1.z.string().url().describe('URL to analyze'),
        focus: zod_1.z.string().optional().describe('Specific aspect to focus on (e.g., "pricing", "features", "technical details")')
    });
    async runImpl(params, context) {
        const { researchActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/research')));
        return researchActions.research_analyze_page(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.AnalyzePageTool = AnalyzePageTool;
