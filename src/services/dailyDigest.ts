import { DailyDigest } from "../models/DailyDigest";
import { User } from "../models/User";
import { Integration } from "../models/Integration";
import { logger } from "./logger";
import { gmailFetcher } from "./fetchers/gmail";
import { calendarFetcher } from "./fetchers/calendar";
import { githubFetcher } from "./fetchers/github";
import { slackFetcher } from "./fetchers/slack";
import { figmaFetcher } from "./fetchers/figma";
import { linearFetcher } from "./fetchers/linear";
import { notionFetcher } from "./fetchers/notion";
import { driveFetcher } from "./fetchers/drive";
import { docsFetcher } from "./fetchers/docs";
import { sheetsFetcher } from "./fetchers/sheets";
import { meetFetcher } from "./fetchers/meet";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const FETCHER_TIMEOUT_MS = 8000; // 8 seconds

interface DigestData {
  greeting: string;
  summary: string;
  sections: Array<{
    title: string;
    items: Array<{
      title: string;
      detail: string;
      source: string;
      link: string;
      action: string;
    }>;
  }>;
  stats: {
    totalItems: number;
    urgent: number;
  };
}

/**
 * Run a fetcher with timeout
 */
async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Generate daily digest for a user
 */
export async function generateDailyDigest(userId: string): Promise<DigestData> {
  try {
    // Check for cached digest
    const cached = await DailyDigest.findOne({ user: userId });
    if (cached) {
      const age = Date.now() - cached.createdAt.getTime();
      if (age < CACHE_DURATION_MS) {
        logger.debug(`Returning cached digest for user ${userId}`);
        return cached.data;
      }
    }

    // Load user and integrations
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const integrations = await Integration.find({ userId }).lean();

    logger.info(`Generating digest for user ${userId} with ${integrations.length} integrations`);

    // Build fetchers map
    const fetchers = {
      gmail: () => gmailFetcher(userId, integrations),
      calendar: () => calendarFetcher(userId, integrations),
      github: () => githubFetcher(userId, integrations),
      slack: () => slackFetcher(userId, integrations),
      figma: () => figmaFetcher(userId, integrations),
      linear: () => linearFetcher(userId, integrations),
      notion: () => notionFetcher(userId, integrations),
      drive: () => driveFetcher(userId, integrations),
      docs: () => docsFetcher(userId, integrations),
      sheets: () => sheetsFetcher(userId, integrations),
      meet: () => meetFetcher(userId, integrations),
    };

    // Run all fetchers with timeout
    const fetcherResults = await Promise.allSettled(
      Object.entries(fetchers).map(async ([name, fetcher]) => {
        const result = await runWithTimeout(fetcher(), FETCHER_TIMEOUT_MS);
        return { name, result };
      })
    );

    // Extract successful results
    const fetchedData: Record<string, any> = {};
    for (const result of fetcherResults) {
      if (result.status === "fulfilled" && result.value.result !== null) {
        fetchedData[result.value.name] = result.value.result;
      }
    }

    logger.debug(`Fetched data sources: ${Object.keys(fetchedData).join(", ")}`);

    // Prepare data for AI
    const dataForAI = JSON.stringify(fetchedData, null, 2);

    // Call Gemini 2.0 Flash
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const systemPrompt = `You are Axle's Daily Digest AI. Analyze the user's notifications and create a concise prioritized briefing. Be ruthlessly concise. Prioritize by urgency. Group related items. Include direct links. Output ONLY valid JSON in this exact shape: { greeting: string, summary: string, sections: [{ title: string, items: [{ title: string, detail: string, source: string, link: string, action: string }] }], stats: { totalItems: number, urgent: number } }`;

    const prompt = `${systemPrompt}\n\nUser data:\n${dataForAI}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();

    // Strip markdown code fences if present
    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Parse JSON
    const digestData: DigestData = JSON.parse(text);

    // Save to database (upsert)
    await DailyDigest.findOneAndUpdate(
      { user: userId },
      { user: userId, data: digestData },
      { upsert: true, new: true }
    );

    logger.info(`Generated digest for user ${userId}`);

    return digestData;
  } catch (error: any) {
    logger.error(`Failed to generate digest for user ${userId}:`, error);
    throw error;
  }
}
