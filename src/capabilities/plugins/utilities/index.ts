// ============================================
// UTILITIES PLUGIN INDEX
// ============================================
// Exports only unique, non-duplicated utility tools
// (Gemini already has GitHub, Google, X/Twitter tools built-in)
// ============================================

// Web Scraping Tools (Unique - Gemini doesn't have web scraping)
export {
  ScrapeUrlTool,
  ScrapeMultipleUrlsTool,
  ExtractLinksTool
} from './scraper';

// HTTP Tools (Useful for API calls Gemini might not handle)
export {
  HttpGetTool,
  HttpPostTool
} from './http';

// Research Tools (Unique - AI-powered research with real web search)
export {
  ResearchWebTool,
  SearchWebTool,
  AnalyzePageTool
} from './research';

// Email Tools (Unique - Resend integration)
export {
  SendEmailTool,
  SendBulkEmailTool
} from './email';
