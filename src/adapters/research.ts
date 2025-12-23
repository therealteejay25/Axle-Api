import { logger } from "../services/logger";
import { fetchPage, searchDuckDuckGo, extractMetadata, extractLinks } from "./scraper";

// ============================================
// RESEARCH TOOLS ADAPTER
// ============================================
// Higher-level research capabilities.
// Combines scraping with intelligent data extraction.
// Designed for AI agents to perform research tasks.
// ============================================

interface IntegrationData {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
}

// ==================== ACTIONS ====================

/**
 * Perform a comprehensive web search
 * Uses DuckDuckGo and returns enriched results
 */
export const webSearch = async (
  params: {
    query: string;
    numResults?: number;
  },
  integration: IntegrationData
) => {
  const { query, numResults = 8 } = params;
  
  logger.debug("Research: web search", { query });
  
  // Use DuckDuckGo for reliable scraping
  const searchResults = await searchDuckDuckGo({ query, numResults }, integration);
  
  return {
    query,
    source: "duckduckgo",
    results: searchResults.results,
    totalResults: searchResults.resultsCount
  };
};

/**
 * Summarize content from a URL
 * Fetches the page and extracts key information
 */
export const summarizeUrl = async (
  params: {
    url: string;
    maxLength?: number;
  },
  integration: IntegrationData
) => {
  const { url, maxLength = 5000 } = params;
  
  logger.debug("Research: summarize URL", { url });
  
  const [pageContent, metadata] = await Promise.all([
    fetchPage({ url }, integration),
    extractMetadata({ url }, integration)
  ]);
  
  return {
    url,
    title: metadata.title || pageContent.title,
    description: metadata.description,
    author: metadata.author,
    content: pageContent.content.slice(0, maxLength),
    contentLength: pageContent.contentLength
  };
};

/**
 * Search for job listings based on keywords
 * Searches multiple job boards via web search
 */
export const findJobs = async (
  params: {
    keywords: string[] | string;
    location?: string;
    remote?: boolean;
    numResults?: number;
  },
  integration: IntegrationData
) => {
  const { location, remote = false, numResults = 15 } = params;
  let { keywords } = params;
  
  // Normalize keywords to array
  if (typeof keywords === "string") {
    keywords = keywords.split(",").map(k => k.trim());
  }
  
  // Build search queries for different job boards
  const skillsQuery = keywords.join(" ");
  const locationPart = location ? ` ${location}` : "";
  const remotePart = remote ? " remote" : "";
  
  const searchQueries = [
    `${skillsQuery} developer jobs${locationPart}${remotePart} site:linkedin.com/jobs`,
    `${skillsQuery} software engineer${locationPart}${remotePart} site:indeed.com`,
    `${skillsQuery} developer${locationPart}${remotePart} hiring site:wellfound.com`,
    `${skillsQuery} engineer jobs${locationPart}${remotePart}`
  ];

  logger.debug("Research: finding jobs", { keywords, location, remote });

  const allResults: { title: string; url: string; snippet: string; source: string }[] = [];

  // Search each query
  for (const query of searchQueries) {
    try {
      const results = await searchDuckDuckGo(
        { query, numResults: Math.ceil(numResults / searchQueries.length) },
        integration
      );
      
      for (const result of results.results) {
        // Determine source
        let source = "web";
        if (result.url.includes("linkedin")) source = "LinkedIn";
        else if (result.url.includes("indeed")) source = "Indeed";
        else if (result.url.includes("wellfound") || result.url.includes("angel.co")) source = "Wellfound";
        else if (result.url.includes("glassdoor")) source = "Glassdoor";
        
        allResults.push({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          source
        });
      }
    } catch (error) {
      logger.warn("Job search query failed", { query, error });
    }
  }

  // Deduplicate by URL
  const uniqueResults = allResults.filter((item, index, self) =>
    index === self.findIndex((t) => t.url === item.url)
  ).slice(0, numResults);

  return {
    searchedFor: keywords,
    location: location || "any",
    remote,
    jobsFound: uniqueResults.length,
    jobs: uniqueResults
  };
};

/**
 * Research a topic by searching and summarizing top results
 */
export const researchTopic = async (
  params: {
    topic: string;
    depth?: number;  // How many pages to summarize
  },
  integration: IntegrationData
) => {
  const { topic, depth = 3 } = params;
  
  logger.debug("Research: deep topic research", { topic, depth });
  
  // Search for the topic
  const searchResults = await searchDuckDuckGo({ query: topic, numResults: depth + 2 }, integration);
  
  const summaries: { url: string; title: string; summary: string }[] = [];
  
  // Summarize top results
  for (const result of searchResults.results.slice(0, depth)) {
    try {
      const summary = await summarizeUrl({ url: result.url, maxLength: 2000 }, integration);
      summaries.push({
        url: result.url,
        title: summary.title || result.title,
        summary: summary.content.slice(0, 500)
      });
    } catch (error) {
      logger.warn("Failed to summarize URL", { url: result.url, error });
    }
  }
  
  return {
    topic,
    sourcesResearched: summaries.length,
    sources: summaries
  };
};

/**
 * Find news articles about a topic
 */
export const findNews = async (
  params: {
    topic: string;
    numResults?: number;
  },
  integration: IntegrationData
) => {
  const { topic, numResults = 10 } = params;
  
  // Search news sites
  const newsQuery = `${topic} site:techcrunch.com OR site:theverge.com OR site:arstechnica.com OR site:wired.com OR site:news.ycombinator.com`;
  
  const results = await searchDuckDuckGo({ query: newsQuery, numResults }, integration);
  
  return {
    topic,
    articlesFound: results.resultsCount,
    articles: results.results
  };
};

// Action handlers map
export const researchActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  research_web_search: webSearch,
  research_summarize_url: summarizeUrl,
  research_find_jobs: findJobs,
  research_topic: researchTopic,
  research_find_news: findNews
};

export default researchActions;
