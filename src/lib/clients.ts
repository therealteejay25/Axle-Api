import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "../config/env";
import { logger } from "../services/logger";

// ============================================
// SINGLETON CLIENTS
// ============================================
// Pre-initialized clients to eliminate cold start latency
// ============================================

// Gemini client singleton
let geminiClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    logger.info("[Clients] Gemini client initialized");
  }
  return geminiClient;
}

// Pinecone client singleton
let pineconeClient: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: env.PINECONE_API_KEY });
    logger.info("[Clients] Pinecone client initialized");
  }
  return pineconeClient;
}

/**
 * Warm up connections on server start
 */
export async function warmupClients(): Promise<void> {
  try {
    // Initialize clients
    getGeminiClient();
    const pinecone = getPineconeClient();
    
    // Warm up Pinecone connection with a dummy query
    try {
      const index = pinecone.index(env.PINECONE_MEMORY_INDEX).namespace("__default__");
      await index.query({
        vector: new Array(3072).fill(0),
        topK: 1,
        includeMetadata: false,
      });
      logger.info("[Clients] Pinecone connection warmed up");
    } catch (error) {
      logger.warn("[Clients] Pinecone warmup failed (non-critical):", error);
    }
    
    logger.info("[Clients] All clients warmed up successfully");
  } catch (error) {
    logger.error("[Clients] Client warmup failed:", error);
  }
}

export default { getGeminiClient, getPineconeClient, warmupClients };
