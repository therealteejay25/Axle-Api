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
  } catch (err) {
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
  } catch (error) {
    logger.error("Error fetching page", { url, error: error.message });
    throw error;
  }
};

// Real-time web search implementation using DuckDuckGo
const simpleHttpSearch = async (query: string, numResults: number) => {
  logger.debug("Using real-time DuckDuckGo search", { query });

  try {
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(
      query
    )}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results: any[] = [];

    // Parse DuckDuckGo results
    $(".result").each((index, element) => {
      if (results.length >= numResults) return false;

      const title = $(element).find(".result__title").text().trim();
      const url =
        $(element).find(".result__url").attr("href") ||
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
  } catch (error) {
    logger.error("DuckDuckGo search failed", { error: error.message });

    // Fallback to a basic search API if available
    try {
      const fallbackResponse = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(
          query
        )}&format=json&no_html=1`
      );
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        const results =
          data.RelatedTopics?.slice(0, numResults).map((topic: any) => ({
            title: topic.Text?.split(" - ")[0] || "Search Result",
            url: topic.FirstURL || "#",
            snippet: topic.Text || "",
          })) || [];

        return {
          results,
          resultsCount: results.length,
        };
      }
    } catch (fallbackError) {
      logger.error("Fallback search also failed", {
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

export const searchDuckDuckGo = async (
  params: {
    query: string;
    numResults?: number;
  },
  integration: IntegrationData
) => {
  const { query, numResults = 10 } = params;

  logger.debug("DuckDuckGo search", { query });

  try {
    // Try simple HTTP search first (more reliable)
    return await simpleHttpSearch(query, numResults);
  } catch (error) {
    logger.error("Simple search failed, falling back to mock", {
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
  } catch (error) {
    logger.warn("Google search failed", { error: error.message });
    return {
      query,
      resultsCount: 0,
      results: [],
      error: error.message,
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
      keywords: keywords.split(",").map((k) => k.trim()),
    };
  } catch (error) {
    logger.error("Metadata extraction failed", { url, error: error.message });
    return {
      title: "",
      description: "",
      keywords: [],
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
  } catch (error) {
    logger.error("Link extraction failed", { url, error: error.message });
    return [];
  }
};
// Action handlers map
export const scraperActions: Record<
  string,
  (params: any, integration: IntegrationData) => Promise<any>
> = {
  scraper_fetch_page: async (params, integration) => {
    return fetchPage(params.url, params.options);
  },
  scraper_extract_metadata: async (params, integration) => {
    return extractMetadata(params.url, integration);
  },
  scraper_extract_links: async (params, integration) => {
    return extractLinks(params.url, integration);
  },
};

export default scraperActions;
