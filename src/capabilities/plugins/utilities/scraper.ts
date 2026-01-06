import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// WEB SCRAPING TOOLS
// ============================================
// ADK-compatible web scraping tools
// Converted from legacy adapters/scraper.ts
// ============================================

/**
 * Extract content from a specific URL
 */
export class ScrapeUrlTool extends BaseTool {
  name = 'scrape_url';
  description = 'Extract text content, title, and metadata from a specific webpage. Use this when you need to read content from a URL.';
  
  inputSchema = z.object({
    url: z.string().url().describe('URL to scrape'),
    selector: z.string().optional().describe('CSS selector to extract specific content (optional)'),
    waitFor: z.number().optional().describe('Milliseconds to wait before scraping (for dynamic content)')
  });

  async runImpl(params: any, context: ToolContext) {
    const { scraperActions } = await import('../../../adapters/scraper');
    
    return scraperActions.scraper_scrape_url(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}

/**
 * Scrape multiple URLs in batch
 */
export class ScrapeMultipleUrlsTool extends BaseTool {
  name = 'scrape_multiple_urls';
  description = 'Scrape multiple URLs at once and return their content. Efficient for batch processing.';
  
  inputSchema = z.object({
    urls: z.array(z.string().url()).describe('Array of URLs to scrape'),
    selector: z.string().optional().describe('CSS selector to extract specific content from all pages')
  });

  async runImpl(params: any, context: ToolContext) {
    const { scraperActions } = await import('../../../adapters/scraper');
    
    return scraperActions.scraper_scrape_multiple(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}

/**
 * Extract all links from a webpage
 */
export class ExtractLinksTool extends BaseTool {
  name = 'scrape_extract_links';
  description = 'Extract all links (URLs) from a webpage. Useful for discovering related pages or building sitemaps.';
  
  inputSchema = z.object({
    url: z.string().url().describe('URL to extract links from'),
    filter: z.string().optional().describe('Filter pattern to match links (e.g., "https://example.com/*")')
  });

  async runImpl(params: any, context: ToolContext) {
    const { scraperActions } = await import('../../../adapters/scraper');
    
    return scraperActions.scraper_extract_links(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}

/**
 * Take a screenshot of a webpage
 */
export class ScreenshotUrlTool extends BaseTool {
  name = 'scrape_screenshot';
  description = 'Take a screenshot of a webpage and return the image URL. Useful for visual verification or archiving.';
  
  inputSchema = z.object({
    url: z.string().url().describe('URL to screenshot'),
    fullPage: z.boolean().optional().default(false).describe('Capture full page or just viewport'),
    width: z.number().optional().describe('Viewport width in pixels'),
    height: z.number().optional().describe('Viewport height in pixels')
  });

  async runImpl(params: any, context: ToolContext) {
    const { scraperActions } = await import('../../../adapters/scraper');
    
    return scraperActions.scraper_screenshot(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}
