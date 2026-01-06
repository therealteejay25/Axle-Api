"use strict";
// ============================================
// UTILITIES PLUGIN INDEX
// ============================================
// Exports only unique, non-duplicated utility tools
// (Gemini already has GitHub, Google, X/Twitter tools built-in)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendBulkEmailTool = exports.SendEmailTool = exports.AnalyzePageTool = exports.SearchWebTool = exports.ResearchWebTool = exports.HttpPostTool = exports.HttpGetTool = exports.ExtractLinksTool = exports.ScrapeMultipleUrlsTool = exports.ScrapeUrlTool = void 0;
// Web Scraping Tools (Unique - Gemini doesn't have web scraping)
var scraper_1 = require("./scraper");
Object.defineProperty(exports, "ScrapeUrlTool", { enumerable: true, get: function () { return scraper_1.ScrapeUrlTool; } });
Object.defineProperty(exports, "ScrapeMultipleUrlsTool", { enumerable: true, get: function () { return scraper_1.ScrapeMultipleUrlsTool; } });
Object.defineProperty(exports, "ExtractLinksTool", { enumerable: true, get: function () { return scraper_1.ExtractLinksTool; } });
// HTTP Tools (Useful for API calls Gemini might not handle)
var http_1 = require("./http");
Object.defineProperty(exports, "HttpGetTool", { enumerable: true, get: function () { return http_1.HttpGetTool; } });
Object.defineProperty(exports, "HttpPostTool", { enumerable: true, get: function () { return http_1.HttpPostTool; } });
// Research Tools (Unique - AI-powered research with real web search)
var research_1 = require("./research");
Object.defineProperty(exports, "ResearchWebTool", { enumerable: true, get: function () { return research_1.ResearchWebTool; } });
Object.defineProperty(exports, "SearchWebTool", { enumerable: true, get: function () { return research_1.SearchWebTool; } });
Object.defineProperty(exports, "AnalyzePageTool", { enumerable: true, get: function () { return research_1.AnalyzePageTool; } });
// Email Tools (Unique - Resend integration)
var email_1 = require("./email");
Object.defineProperty(exports, "SendEmailTool", { enumerable: true, get: function () { return email_1.SendEmailTool; } });
Object.defineProperty(exports, "SendBulkEmailTool", { enumerable: true, get: function () { return email_1.SendBulkEmailTool; } });
