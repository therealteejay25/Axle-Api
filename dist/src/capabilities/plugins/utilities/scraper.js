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
exports.ScreenshotUrlTool = exports.ExtractLinksTool = exports.ScrapeMultipleUrlsTool = exports.ScrapeUrlTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// WEB SCRAPING TOOLS
// ============================================
// ADK-compatible web scraping tools
// Converted from legacy adapters/scraper.ts
// ============================================
/**
 * Extract content from a specific URL
 */
class ScrapeUrlTool extends BaseTool_1.BaseTool {
    name = 'scrape_url';
    description = 'Extract text content, title, and metadata from a specific webpage. Use this when you need to read content from a URL.';
    inputSchema = zod_1.z.object({
        url: zod_1.z.string().url().describe('URL to scrape'),
        selector: zod_1.z.string().optional().describe('CSS selector to extract specific content (optional)'),
        waitFor: zod_1.z.number().optional().describe('Milliseconds to wait before scraping (for dynamic content)')
    });
    async runImpl(params, context) {
        const { scraperActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/scraper')));
        return scraperActions.scraper_scrape_url(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.ScrapeUrlTool = ScrapeUrlTool;
/**
 * Scrape multiple URLs in batch
 */
class ScrapeMultipleUrlsTool extends BaseTool_1.BaseTool {
    name = 'scrape_multiple_urls';
    description = 'Scrape multiple URLs at once and return their content. Efficient for batch processing.';
    inputSchema = zod_1.z.object({
        urls: zod_1.z.array(zod_1.z.string().url()).describe('Array of URLs to scrape'),
        selector: zod_1.z.string().optional().describe('CSS selector to extract specific content from all pages')
    });
    async runImpl(params, context) {
        const { scraperActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/scraper')));
        return scraperActions.scraper_scrape_multiple(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.ScrapeMultipleUrlsTool = ScrapeMultipleUrlsTool;
/**
 * Extract all links from a webpage
 */
class ExtractLinksTool extends BaseTool_1.BaseTool {
    name = 'scrape_extract_links';
    description = 'Extract all links (URLs) from a webpage. Useful for discovering related pages or building sitemaps.';
    inputSchema = zod_1.z.object({
        url: zod_1.z.string().url().describe('URL to extract links from'),
        filter: zod_1.z.string().optional().describe('Filter pattern to match links (e.g., "https://example.com/*")')
    });
    async runImpl(params, context) {
        const { scraperActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/scraper')));
        return scraperActions.scraper_extract_links(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.ExtractLinksTool = ExtractLinksTool;
/**
 * Take a screenshot of a webpage
 */
class ScreenshotUrlTool extends BaseTool_1.BaseTool {
    name = 'scrape_screenshot';
    description = 'Take a screenshot of a webpage and return the image URL. Useful for visual verification or archiving.';
    inputSchema = zod_1.z.object({
        url: zod_1.z.string().url().describe('URL to screenshot'),
        fullPage: zod_1.z.boolean().optional().default(false).describe('Capture full page or just viewport'),
        width: zod_1.z.number().optional().describe('Viewport width in pixels'),
        height: zod_1.z.number().optional().describe('Viewport height in pixels')
    });
    async runImpl(params, context) {
        const { scraperActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/scraper')));
        return scraperActions.scraper_screenshot(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.ScreenshotUrlTool = ScreenshotUrlTool;
