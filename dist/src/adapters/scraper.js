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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scraperActions = exports.extractLinks = exports.extractMetadata = exports.searchGoogle = exports.searchDuckDuckGo = exports.fetchPage = void 0;
const cheerio = __importStar(require("cheerio"));
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const logger_1 = require("../services/logger");
// Add stealth plugin to Puppeteer
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
// Shared browser utility to fetch content
// We launch a new browser for each request to ensure clean session (or could manage a pool)
const fetchWithPuppeteer = async (url) => {
    logger_1.logger.debug("Puppeteer fetching:", { url });
    // Launch browser (headless but stealthy)
    // args: --no-sandbox is often needed in containerized/restricted envs
    const browser = await puppeteer_extra_1.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
        const page = await browser.newPage();
        // Set a realistic viewport
        await page.setViewport({ width: 1366, height: 768 });
        // Go to URL
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        // Random small delay to behave human-like and allow dynamic rendering
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
        // Get content
        const content = await page.content();
        return content;
    }
    catch (err) {
        logger_1.logger.error("Puppeteer fetch failed", { url, error: err.message });
        throw err;
    }
    finally {
        await browser.close();
    }
};
const fetchPage = async (url, options = {}) => {
    // Always use Puppeteer for robust fetching given previous blocks
    try {
        return await fetchWithPuppeteer(url);
    }
    catch (error) {
        logger_1.logger.error("Error fetching page", { url, error: error.message });
        throw error;
    }
};
exports.fetchPage = fetchPage;
// Real-time web search implementation using DuckDuckGo
const simpleHttpSearch = async (query, numResults) => {
    logger_1.logger.debug("Using real-time DuckDuckGo search", { query });
    try {
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(searchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        const results = [];
        // Parse DuckDuckGo results
        $(".result").each((index, element) => {
            if (results.length >= numResults)
                return false;
            const title = $(element).find(".result__title").text().trim();
            const url = $(element).find(".result__url").attr("href") ||
                $(element).find(".result__title a").attr("href");
            const snippet = $(element).find(".result__snippet").text().trim();
            if (title && url && snippet) {
                results.push({
                    title,
                    url: url.startsWith("http") ? url : `https://${url}`,
                    snippet,
                });
            }
        });
        return {
            results,
            resultsCount: results.length,
        };
    }
    catch (error) {
        logger_1.logger.error("DuckDuckGo search failed", { error: error.message });
        // Fallback to a basic search API if available
        try {
            const fallbackResponse = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                const results = data.RelatedTopics?.slice(0, numResults).map((topic) => ({
                    title: topic.Text?.split(" - ")[0] || "Search Result",
                    url: topic.FirstURL || "#",
                    snippet: topic.Text || "",
                })) || [];
                return {
                    results,
                    resultsCount: results.length,
                };
            }
        }
        catch (fallbackError) {
            logger_1.logger.error("Fallback search also failed", {
                error: fallbackError.message,
            });
        }
        // Last resort - return empty results
        return {
            results: [],
            resultsCount: 0,
        };
    }
};
const searchDuckDuckGo = async (params, integration) => {
    const { query, numResults = 10 } = params;
    logger_1.logger.debug("DuckDuckGo search", { query });
    try {
        // Try simple HTTP search first (more reliable)
        return await simpleHttpSearch(query, numResults);
    }
    catch (error) {
        logger_1.logger.error("Simple search failed, falling back to mock", {
            query,
            error,
        });
        // Fallback mock results
        return {
            results: [
                {
                    title: `${query} - Search Result 1`,
                    url: `https://example.com/search?q=${encodeURIComponent(query)}`,
                    snippet: `Information about ${query} from web search.`,
                },
            ],
            resultsCount: 1,
        };
    }
};
exports.searchDuckDuckGo = searchDuckDuckGo;
const searchGoogle = async (params, integration) => {
    const { query, numResults = 10 } = params;
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.google.com/search?q=${encodedQuery}&num=${numResults}`;
    logger_1.logger.debug("Google Puppeteer search", { query });
    try {
        const html = await fetchWithPuppeteer(searchUrl);
        const $ = cheerio.load(html);
        const results = [];
        // Google selectors
        $("div.g").each((i, el) => {
            if (results.length >= numResults)
                return false;
            const $el = $(el);
            const title = $el.find("h3").first().text().trim();
            const url = $el.find("a").first().attr("href");
            const snippet = $el
                .find(".VwiC3b, .IsZvec, [data-sncf]")
                .first()
                .text()
                .trim();
            if (title && url && url.startsWith("http")) {
                results.push({
                    title,
                    url,
                    snippet: snippet.slice(0, 300),
                });
            }
        });
        return {
            query,
            resultsCount: results.length,
            results,
        };
    }
    catch (error) {
        logger_1.logger.warn("Google search failed", { error: error.message });
        return {
            query,
            resultsCount: 0,
            results: [],
            error: error.message,
        };
    }
};
exports.searchGoogle = searchGoogle;
const extractMetadata = async (url, integration) => {
    try {
        const html = await (0, exports.fetchPage)(url);
        const $ = cheerio.load(html);
        const title = $("title").text().trim();
        const description = $('meta[name="description"]').attr("content") || "";
        const keywords = $('meta[name="keywords"]').attr("content") || "";
        return {
            title,
            description,
            keywords: keywords.split(",").map((k) => k.trim()),
        };
    }
    catch (error) {
        logger_1.logger.error("Metadata extraction failed", { url, error: error.message });
        return {
            title: "",
            description: "",
            keywords: [],
        };
    }
};
exports.extractMetadata = extractMetadata;
const extractLinks = async (url, integration) => {
    try {
        const html = await (0, exports.fetchPage)(url);
        const $ = cheerio.load(html);
        const links = [];
        $("a").each((i, el) => {
            const href = $(el).attr("href");
            if (href && href.startsWith("http")) {
                links.push(href);
            }
        });
        return [...new Set(links)]; // Deduplicate
    }
    catch (error) {
        logger_1.logger.error("Link extraction failed", { url, error: error.message });
        return [];
    }
};
exports.extractLinks = extractLinks;
// Action handlers map
exports.scraperActions = {
    scraper_fetch_page: async (params, integration) => {
        return (0, exports.fetchPage)(params.url, params.options);
    },
    scraper_extract_metadata: async (params, integration) => {
        return (0, exports.extractMetadata)(params.url, integration);
    },
    scraper_extract_links: async (params, integration) => {
        return (0, exports.extractLinks)(params.url, integration);
    },
};
exports.default = exports.scraperActions;
