"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.researchActions = exports.findNews = exports.researchTopic = exports.findJobs = exports.summarizeUrl = exports.webSearch = void 0;
const logger_1 = require("../services/logger");
const scraper_1 = require("./scraper");
// ==================== ACTIONS ====================
/**
 * Perform a comprehensive web search
 * Uses DuckDuckGo and returns enriched results
 */
const webSearch = async (params, integration) => {
    const { query, numResults = 8 } = params;
    logger_1.logger.debug("Research: web search", { query });
    // Use DuckDuckGo for reliable scraping
    const searchResults = await (0, scraper_1.searchDuckDuckGo)({ query, numResults }, integration);
    return {
        query,
        source: "duckduckgo",
        results: searchResults.results,
        totalResults: searchResults.resultsCount
    };
};
exports.webSearch = webSearch;
/**
 * Summarize content from a URL
 * Fetches the page and extracts key information
 */
const summarizeUrl = async (params, integration) => {
    const { url, maxLength = 5000 } = params;
    logger_1.logger.debug("Research: summarize URL", { url });
    const [pageContent, metadata] = await Promise.all([
        (0, scraper_1.fetchPage)({ url }, integration),
        (0, scraper_1.extractMetadata)({ url }, integration)
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
exports.summarizeUrl = summarizeUrl;
/**
 * Search for job listings based on keywords
 * Searches multiple job boards via web search
 */
const findJobs = async (params, integration) => {
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
    logger_1.logger.debug("Research: finding jobs", { keywords, location, remote });
    const allResults = [];
    // Search each query
    for (const query of searchQueries) {
        try {
            const results = await (0, scraper_1.searchDuckDuckGo)({ query, numResults: Math.ceil(numResults / searchQueries.length) }, integration);
            for (const result of results.results) {
                // Determine source
                let source = "web";
                if (result.url.includes("linkedin"))
                    source = "LinkedIn";
                else if (result.url.includes("indeed"))
                    source = "Indeed";
                else if (result.url.includes("wellfound") || result.url.includes("angel.co"))
                    source = "Wellfound";
                else if (result.url.includes("glassdoor"))
                    source = "Glassdoor";
                allResults.push({
                    title: result.title,
                    url: result.url,
                    snippet: result.snippet,
                    source
                });
            }
        }
        catch (error) {
            logger_1.logger.warn("Job search query failed", { query, error });
        }
    }
    // Deduplicate by URL
    const uniqueResults = allResults.filter((item, index, self) => index === self.findIndex((t) => t.url === item.url)).slice(0, numResults);
    return {
        searchedFor: keywords,
        location: location || "any",
        remote,
        jobsFound: uniqueResults.length,
        jobs: uniqueResults
    };
};
exports.findJobs = findJobs;
/**
 * Research a topic by searching and summarizing top results
 */
const researchTopic = async (params, integration) => {
    const { topic, depth = 3 } = params;
    logger_1.logger.debug("Research: deep topic research", { topic, depth });
    // Search for the topic
    const searchResults = await (0, scraper_1.searchDuckDuckGo)({ query: topic, numResults: depth + 2 }, integration);
    const summaries = [];
    // Summarize top results
    for (const result of searchResults.results.slice(0, depth)) {
        try {
            const summary = await (0, exports.summarizeUrl)({ url: result.url, maxLength: 2000 }, integration);
            summaries.push({
                url: result.url,
                title: summary.title || result.title,
                summary: summary.content.slice(0, 500)
            });
        }
        catch (error) {
            logger_1.logger.warn("Failed to summarize URL", { url: result.url, error });
        }
    }
    return {
        topic,
        sourcesResearched: summaries.length,
        sources: summaries
    };
};
exports.researchTopic = researchTopic;
/**
 * Find news articles about a topic
 */
const findNews = async (params, integration) => {
    const { topic, numResults = 10 } = params;
    // Search news sites
    const newsQuery = `${topic} site:techcrunch.com OR site:theverge.com OR site:arstechnica.com OR site:wired.com OR site:news.ycombinator.com`;
    const results = await (0, scraper_1.searchDuckDuckGo)({ query: newsQuery, numResults }, integration);
    return {
        topic,
        articlesFound: results.resultsCount,
        articles: results.results
    };
};
exports.findNews = findNews;
// Action handlers map
exports.researchActions = {
    research_web_search: exports.webSearch,
    research_summarize_url: exports.summarizeUrl,
    research_find_jobs: exports.findJobs,
    research_topic: exports.researchTopic,
    research_find_news: exports.findNews
};
exports.default = exports.researchActions;
