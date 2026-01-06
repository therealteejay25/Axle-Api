import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// RESEARCH TOOLS
// ============================================
// ADK-compatible AI-powered research tools
// Converted from legacy adapters/research.ts
// ============================================

/**
 * AI-powered web research on a topic
 */
export class ResearchWebTool extends BaseTool {
  name = 'research_web';
  description = 'Search the web and gather comprehensive information on a topic using AI. Returns a summary with sources and key points. Use this when you need to research current information or gather data from the internet.';
  
  inputSchema = z.object({
    query: z.string().describe('Research query or topic'),
    maxResults: z.number().optional().default(5).describe('Maximum number of sources to analyze'),
    depth: z.enum(['quick', 'standard', 'deep']).optional().default('standard').describe('Research depth level')
  });

  async runImpl(params: any, context: ToolContext) {
    const { researchActions } = await import('../../../adapters/research');

    return researchActions.research_topic(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}

/**
 * Web search with AI summarization
 */
export class SearchWebTool extends BaseTool {
  name = 'search_web';
  description = 'Search the web and get AI-summarized results. Faster than full research, good for quick lookups.';
  
  inputSchema = z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().default(10).describe('Number of search results to return')
  });

  async runImpl(params: any, context: ToolContext) {
    const { researchActions } = await import('../../../adapters/research');

    return researchActions.research_web_search(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}

/**
 * Analyze and summarize a specific webpage
 */
export class AnalyzePageTool extends BaseTool {
  name = 'research_analyze_page';
  description = 'Analyze a specific webpage and extract key information, main topics, and insights using AI.';
  
  inputSchema = z.object({
    url: z.string().url().describe('URL to analyze'),
    focus: z.string().optional().describe('Specific aspect to focus on (e.g., "pricing", "features", "technical details")')
  });

  async runImpl(params: any, context: ToolContext) {
    const { researchActions } = await import('../../../adapters/research');
    
    return researchActions.research_analyze_page(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}
