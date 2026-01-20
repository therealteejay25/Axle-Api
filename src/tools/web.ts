
import { z } from "zod";
import { logger } from "../services/logger";
import { FunctionTool } from "@google/adk";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

export const createWebSearchTool = () => {
  return new FunctionTool({
    name: "web_search",
    description: "Search the web for information using DuckDuckGo. Use this to find current events, news, or specific information.",
    parameters: z.object({
      query: z.string().min(1, "Search query is required"),
    }),
    execute: async ({ query }) => {
      logger.info(`[WEB] Searching for: ${query}`);
      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Go to DuckDuckGo
        await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
          waitUntil: 'networkidle0'
        });

        // Extract results
        const results = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.result__body'));
          return items.slice(0, 5).map(item => {
            const titleEl = item.querySelector('.result__a');
            const snippetEl = item.querySelector('.result__snippet');
            const url = titleEl?.getAttribute('href');
            
            return {
              title: titleEl?.textContent?.trim(),
              url: url,
              snippet: snippetEl?.textContent?.trim()
            };
          });
        });

        logger.info(`[WEB] Found ${results.length} results`);
        return {
          success: true,
          results
        };
      } catch (error: any) {
        logger.error("[WEB] Search failed:", error);
        return {
          success: false,
          error: `Search failed: ${error.message}`
        };
      } finally {
        if (browser) await browser.close();
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
      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Block resources to speed up
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        // Extract text
        const content = await page.evaluate(() => {
          return document.body.innerText;
        });
        
        const title = await page.title();

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
      } finally {
        if (browser) await browser.close();
      }
    }
  });
};
