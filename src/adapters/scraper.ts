import * as cheerio from "cheerio";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logger } from "../services/logger";

// Create a typed interface for the integration config
interface IntegrationData {
  provider: string; // e.g. "github", "google"
  accessToken?: string;
  refreshToken?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  scopes?: string[];
}

// Add stealth plugin to Puppeteer
puppeteer.use(StealthPlugin());

// Shared browser utility to fetch content
// We launch a new browser for each request to ensure clean session (or could manage a pool)
const fetchWithPuppeteer = async (url: string): Promise<string> => {
    logger.debug("Puppeteer fetching:", { url });
    // Launch browser (headless but stealthy)
    // args: --no-sandbox is often needed in containerized/restricted envs
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        // Set a realistic viewport
        await page.setViewport({ width: 1366, height: 768 });
        
        // Go to URL
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        // Random small delay to behave human-like and allow dynamic rendering
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        
        // Get content
        const content = await page.content();
        return content;
    } catch (err: any) {
        logger.error("Puppeteer fetch failed", { url, error: err.message });
        throw err;
    } finally {
        await browser.close();
    }
};

export const fetchPage = async (
  url: string,
  options: {
    useProxy?: boolean;
    headers?: Record<string, string>;
  } = {}
) => {
  // Always use Puppeteer for robust fetching given previous blocks
  try {
      return await fetchWithPuppeteer(url);
  } catch (error: any) {
      logger.error("Error fetching page", { url, error: error.message });
      throw error;
  }
};

export const searchDuckDuckGo = async (
  params: {
    query: string;
    numResults?: number;
  },
  integration: IntegrationData
) => {
  const { query, numResults = 10 } = params;
  const encodedQuery = encodeURIComponent(query);
  
  // Use standard URL as Puppeteer can handle JS
  const searchUrl = `https://duckduckgo.com/?q=${encodedQuery}`;
  
  logger.debug("DuckDuckGo Puppeteer search", { query });

  try {
    const html = await fetchWithPuppeteer(searchUrl);
    const $ = cheerio.load(html);
    const results: { title: string; url: string; snippet: string }[] = [];

    // Selectors for DuckDuckGo (Dynamic/React)
    // Common container: article
    $("article").each((i, el) => {
        if (results.length >= numResults) return false;
        
        const $el = $(el);
        const titleEl = $el.find("h2 a, [data-testid='result-title-a']");
        const title = titleEl.text().trim();
        const url = titleEl.attr("href");
        const snippet = $el.find("[data-result='snippet'], .result__snippet").text().trim();
        
        if (title && url && !url.startsWith("/y.js") && !url.includes("duckduckgo.com")) {
            results.push({
                title,
                url,
                snippet: snippet.slice(0, 300)
            });
        }
    });

    // Fallback for Legacy selectors if React version didn't load
    if (results.length === 0) {
        $(".result").each((i, el) => {
            if (results.length >= numResults) return false;
            const $el = $(el);
            const title = $el.find("h2 a").text().trim();
            const url = $el.find("h2 a").attr("href");
            const snippet = $el.find(".result__snippet").text().trim();
            
             if (title && url) {
                results.push({ title, url, snippet: snippet.slice(0, 300) });
             }
        });
    }

    if (results.length === 0) {
      logger.warn("DuckDuckGo returned 0 results via Puppeteer", { 
        htmlTitle: $("title").text().trim(),
        query 
      });
    }

    return {
      query,
      resultsCount: results.length,
      results
    };
  } catch (error: any) {
    logger.error("DuckDuckGo search failed", { error: error.message });
    return {
      query,
      resultsCount: 0,
      results: [],
      error: error.message
    };
  }
};

export const searchGoogle = async (
  params: {
    query: string;
    numResults?: number;
  },
  integration: IntegrationData
) => {
  const { query, numResults = 10 } = params;
  const encodedQuery = encodeURIComponent(query);
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&num=${numResults}`;

  logger.debug("Google Puppeteer search", { query });

  try {
    const html = await fetchWithPuppeteer(searchUrl);
    const $ = cheerio.load(html);
    const results: { title: string; url: string; snippet: string }[] = [];

    // Google selectors
    $("div.g").each((i, el) => {
      if (results.length >= numResults) return false;

      const $el = $(el);
      const title = $el.find("h3").first().text().trim();
      const url = $el.find("a").first().attr("href");
      const snippet = $el.find(".VwiC3b, .IsZvec, [data-sncf]").first().text().trim();

      if (title && url && url.startsWith("http")) {
        results.push({
          title,
          url,
          snippet: snippet.slice(0, 300)
        });
      }
    });

    return {
      query,
      resultsCount: results.length,
      results
    };
  } catch (error: any) {
    logger.warn("Google search failed", { error: error.message });
    return {
      query,
      resultsCount: 0,
      results: [],
      error: error.message
    };
  }
};

export const extractMetadata = async (
  url: string,
  integration?: IntegrationData
) => {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const title = $("title").text().trim();
    const description = $('meta[name="description"]').attr("content") || "";
    const keywords = $('meta[name="keywords"]').attr("content") || "";

    return {
      title,
      description,
      keywords: keywords.split(",").map((k) => k.trim())
    };
  } catch (error: any) {
    logger.error("Metadata extraction failed", { url, error: error.message });
    return {
      title: "",
      description: "",
      keywords: []
    };
  }
};

export const extractLinks = async (
  url: string,
  integration?: IntegrationData
) => {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const links: string[] = [];

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href && href.startsWith("http")) {
        links.push(href);
      }
    });

    return [...new Set(links)]; // Deduplicate
  } catch (error: any) {
    logger.error("Link extraction failed", { url, error: error.message });
    return [];
  }
};
// Action handlers map
export const scraperActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  scraper_fetch_page: async (params, integration) => {
    return fetchPage(params.url, params.options);
  },
  scraper_extract_metadata: async (params, integration) => {
    return extractMetadata(params.url, integration);
  },
  scraper_extract_links: async (params, integration) => {
    return extractLinks(params.url, integration);
  }
};

export default scraperActions;
