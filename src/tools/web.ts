import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";

// --- WEB SCRAPING --- //

export const scrape_url = tool({
  name: "scrape_url",
  description:
    "Scrape content from a URL and extract text, links, and metadata",
  parameters: z.object({
    url: z.string(),
    extract_text: z.boolean().default(true),
    extract_links: z.boolean().default(true),
    extract_images: z.boolean().default(false),
    selector: z.string().nullable().optional(), // CSS selector to extract specific content
  }),
  execute: async (
    { url, extract_text, extract_links, extract_images, selector },
    ctx?: RunContext<any>
  ) => {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      const result: any = { url, title: $("title").text() };

      if (selector) {
        result.content = $(selector).text();
      } else if (extract_text) {
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
    } catch (error) {
      throw new Error(`Failed to scrape URL: ${error.message}`);
    }
  },
});

export const http_request = tool({
  name: "http_request",
  description: "Make an HTTP request (GET, POST, PUT, DELETE, etc.)",
  parameters: z.object({
    url: z.string(),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
      .default("GET"),
    headers: z.record(z.string(), z.string()).nullable().optional(),
    body: z.unknown().nullable().optional(),
    params: z.record(z.string(), z.string()).nullable().optional(),
  }),
  execute: async (
    { url, method, headers, body, params },
    ctx?: RunContext<any>
  ) => {
    try {
      const config: any = {
        method,
        url,
        headers: headers || {},
        timeout: 30000,
      };

      if (params) {
        config.params = params;
      }

      if (
        body &&
        (method === "POST" || method === "PUT" || method === "PATCH")
      ) {
        config.data = body;
        if (typeof body === "object" && !headers?.["Content-Type"]) {
          config.headers["Content-Type"] = "application/json";
        }
      }

      const response = await axios(config);
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
      };
    } catch (error) {
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

export const search_web = tool({
  name: "search_web",
  description:
    "Search the web using a search engine (simulated - integrate with Google Search API, DuckDuckGo, etc.)",
  parameters: z.object({
    query: z.string(),
    limit: z.number().default(10),
    engine: z.enum(["google", "duckduckgo", "bing"]).default("google"),
  }),
  execute: async ({ query, limit, engine }, ctx?: RunContext<any>) => {
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

export default {};
