import { z } from "zod";
import { logger } from "../services/logger";
import { FunctionTool } from "@google/adk";

// Use DuckDuckGo's HTML API with fetch - no browser required
export const createWebSearchTool = () => {
  return new FunctionTool({
    name: "web_search",
    description: "Search the web for information using DuckDuckGo. Use this to find current events, news, or specific information.",
    parameters: z.object({
      query: z.string().min(1, "Search query is required"),
    }),
    execute: async ({ query }) => {
      logger.info(`[WEB] Searching for: ${query}`);
      try {
        const fetchFn: typeof fetch =
          (globalThis as any).fetch ?? ((await import("node-fetch")) as any).default;

        // Use DuckDuckGo Instant Answer API (JSON)
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
        const response = await fetchFn(ddgUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        
        if (!response.ok) {
          throw new Error(`DuckDuckGo API returned ${response.status}`);
        }

        const data = await response.json();
        
        const results: { title: string; url: string; snippet: string }[] = [];

        // Extract abstract if available
        if (data.Abstract && data.AbstractURL) {
          results.push({
            title: data.Heading || "Summary",
            url: data.AbstractURL,
            snippet: data.Abstract
          });
        }

        // Extract related topics
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
          const flattened = data.RelatedTopics.flatMap((t: any) =>
            Array.isArray(t?.Topics) ? t.Topics : [t]
          );
          for (const topic of flattened.slice(0, 5)) {
            if (topic?.FirstURL && topic?.Text) {
              results.push({
                title: topic.Text.split(" - ")[0] || topic.Text.substring(0, 50),
                url: topic.FirstURL,
                snippet: topic.Text
              });
            }
          }
        }

        // If no results from Instant Answers, try scraping HTML version with fetch
        if (results.length === 0) {
          const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          const htmlResponse = await fetchFn(htmlUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
          });
          if (!htmlResponse.ok) {
            throw new Error(`DuckDuckGo HTML returned ${htmlResponse.status}`);
          }
          const html = await htmlResponse.text();

          const { load } = await import("cheerio");

          const normalizeUrl = (href: string) => {
            try {
              const trimmed = (href || "").trim();
              if (!trimmed) return "";
              const prefixed = trimmed.startsWith("//")
                ? `https:${trimmed}`
                : trimmed.startsWith("/")
                  ? `https://duckduckgo.com${trimmed}`
                  : trimmed;
              const u = new URL(prefixed);
              const uddg = u.searchParams.get("uddg");
              return uddg ? decodeURIComponent(uddg) : prefixed;
            } catch {
              return href;
            }
          };

          const $ = load(html);
          const items = $(".results .result").slice(0, 5);
          items.each((_, el) => {
            const a = $(el).find("a.result__a").first();
            const title = a.text().trim() || "Result";
            const url = normalizeUrl(a.attr("href") || "");
            const snippet = $(el).find(".result__snippet").text().trim();
            results.push({
              title,
              url,
              snippet,
            });
          });
        }

        logger.info(`[WEB] Found ${results.length} results`);
        return {
          success: true,
          results: results.length > 0 ? results : [{ title: "No results", url: "", snippet: `No results found for "${query}"` }]
        };
      } catch (error: any) {
        logger.error("[WEB] Search failed:", error);
        return {
          success: false,
          error: `Search failed: ${error.message}`
        };
      }
    }
  });
};

export const createWebReadPageTool = () => {
  return new FunctionTool({
    name: "web_read_page",
    description: "Read the content of a specific web page. Useful for summarizing articles or reading documentation.",
    parameters: z.object({
      url: z.string().url("Valid URL is required"),
    }),
    execute: async ({ url }) => {
      logger.info(`[WEB] Reading page: ${url}`);
      try {
        const fetchFn: typeof fetch =
          (globalThis as any).fetch ?? ((await import("node-fetch")) as any).default;

        const response = await fetchFn(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] || "Untitled";
        
        // Strip HTML tags and extract text content (simple approach)
        let content = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        logger.info(`[WEB] Read ${content.length} characters`);
        
        // Truncate if too long (max 10k chars)
        const maxLength = 10000;
        const truncated = content.length > maxLength 
          ? content.substring(0, maxLength) + "... (truncated)"
          : content;

        return {
          success: true,
          title,
          url,
          content: truncated
        };
      } catch (error: any) {
        logger.error("[WEB] Read page failed:", error);
        return {
          success: false,
          error: `Failed to read page: ${error.message}`
        };
      }
    }
  });
};
