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
exports.search_web = exports.http_request = exports.scrape_url = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
// --- WEB SCRAPING --- //
exports.scrape_url = (0, agents_1.tool)({
    name: "scrape_url",
    description: "Scrape content from a URL and extract text, links, and metadata",
    parameters: zod_1.z.object({
        url: zod_1.z.string(),
        extract_text: zod_1.z.boolean().default(true),
        extract_links: zod_1.z.boolean().default(true),
        extract_images: zod_1.z.boolean().default(false),
        selector: zod_1.z.string().nullable().optional(), // CSS selector to extract specific content
    }),
    execute: async ({ url, extract_text, extract_links, extract_images, selector }, ctx) => {
        try {
            const response = await axios_1.default.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
                timeout: 10000,
            });
            const $ = cheerio.load(response.data);
            const result = { url, title: $("title").text() };
            if (selector) {
                result.content = $(selector).text();
            }
            else if (extract_text) {
                result.text = $("body").text().replace(/\s+/g, " ").trim();
            }
            if (extract_links) {
                result.links = [];
                $("a[href]").each((_, el) => {
                    const href = $(el).attr("href");
                    const text = $(el).text().trim();
                    if (href) {
                        result.links.push({ href, text });
                    }
                });
            }
            if (extract_images) {
                result.images = [];
                $("img[src]").each((_, el) => {
                    const src = $(el).attr("src");
                    const alt = $(el).attr("alt") || "";
                    if (src) {
                        result.images.push({ src, alt });
                    }
                });
            }
            result.metadata = {
                description: $('meta[name="description"]').attr("content"),
                keywords: $('meta[name="keywords"]').attr("content"),
                ogTitle: $('meta[property="og:title"]').attr("content"),
                ogDescription: $('meta[property="og:description"]').attr("content"),
            };
            return result;
        }
        catch (error) {
            throw new Error(`Failed to scrape URL: ${error.message}`);
        }
    },
});
exports.http_request = (0, agents_1.tool)({
    name: "http_request",
    description: "Make an HTTP request (GET, POST, PUT, DELETE, etc.)",
    parameters: zod_1.z.object({
        url: zod_1.z.string(),
        method: zod_1.z
            .enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
            .default("GET"),
        headers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).nullable().optional(),
        body: zod_1.z.unknown().nullable().optional(),
        params: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).nullable().optional(),
    }),
    execute: async ({ url, method, headers, body, params }, ctx) => {
        try {
            const config = {
                method,
                url,
                headers: headers || {},
                timeout: 30000,
            };
            if (params) {
                config.params = params;
            }
            if (body &&
                (method === "POST" || method === "PUT" || method === "PATCH")) {
                config.data = body;
                if (typeof body === "object" && !headers?.["Content-Type"]) {
                    config.headers["Content-Type"] = "application/json";
                }
            }
            const response = await (0, axios_1.default)(config);
            return {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data,
            };
        }
        catch (error) {
            if (error.response) {
                return {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data,
                    error: true,
                };
            }
            throw new Error(`HTTP request failed: ${error.message}`);
        }
    },
});
exports.search_web = (0, agents_1.tool)({
    name: "search_web",
    description: "Search the web using a search engine (simulated - integrate with Google Search API, DuckDuckGo, etc.)",
    parameters: zod_1.z.object({
        query: zod_1.z.string(),
        limit: zod_1.z.number().default(10),
        engine: zod_1.z.enum(["google", "duckduckgo", "bing"]).default("google"),
    }),
    execute: async ({ query, limit, engine }, ctx) => {
        // Simulated - replace with actual search API integration
        return {
            query,
            engine,
            results: Array.from({ length: limit }).map((_, i) => ({
                title: `Search Result ${i + 1} for "${query}"`,
                url: `https://example.com/result-${i + 1}`,
                snippet: `This is a simulated search result snippet for query "${query}"`,
            })),
        };
    },
});
exports.default = {};
