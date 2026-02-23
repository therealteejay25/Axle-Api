import { getPineconeClient } from "../lib/clients";
import { env } from "../config/env";
import { logger } from "./logger";
import { RedisCache } from "./RedisCache";
import crypto from "crypto";

// ============================================
// OPTIMIZED EMBEDDING SERVICE WITH CACHING
// ============================================
// Pinecone operations with in-memory cache and Redis cache
// ============================================

// Simple in-memory cache for Pinecone query results
interface CacheEntry {
  data: any[];
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const MAX_CACHE_SIZE = 100;

/**
 * Clean expired cache entries
 */
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of queryCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      queryCache.delete(key);
    }
  }
  
  // If still too large, remove oldest entries
  if (queryCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(queryCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, queryCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => queryCache.delete(key));
  }
}

/**
 * Generate cache key for a query
 */
function generateQueryCacheKey(params: {
  indexName: string;
  queryText: string;
  filter?: Record<string, any>;
  topK?: number;
}): string {
  const hash = crypto.createHash('md5')
    .update(JSON.stringify(params))
    .digest('hex');
  return `pinecone:query:${hash}`;
}

/**
 * Query Pinecone with in-memory caching
 */
export async function queryOptimized(params: {
  indexName: string;
  queryText: string;
  filter?: Record<string, any>;
  topK?: number;
}): Promise<Array<{
  id: string;
  score: number;
  text: string;
  metadata: Record<string, any>;
}>> {
  const { indexName, queryText, filter, topK = 10 } = params;
  
  // Check cache first
  const cacheKey = generateQueryCacheKey(params);
  const cached = queryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    logger.debug(`[EmbeddingService] Cache hit for query`);
    return cached.data;
  }
  
  try {
    // Import EmbeddingService for actual query
    const { EmbeddingService } = await import("./EmbeddingService");
    
    const results = await EmbeddingService.query({
      indexName: "axle" as const,
      queryText,
      filter: filter || {},
      topK,
    });
    
    // Store in cache
    queryCache.set(cacheKey, { data: results, timestamp: Date.now() });
    
    // Clean expired entries periodically
    if (Math.random() < 0.1) { // 10% chance
      cleanExpiredCache();
    }
    
    return results;
  } catch (error) {
    logger.error("[EmbeddingService] Query failed:", error);
    throw error;
  }
}

/**
 * Batch query optimization - single query with higher topK, filter client-side
 */
export async function batchQueryOptimized(params: {
  indexName: string;
  queryText: string;
  categories: string[];
  topKPerCategory: number;
}): Promise<Record<string, Array<{
  id: string;
  score: number;
  text: string;
  metadata: Record<string, any>;
}>>> {
  const { indexName, queryText, categories, topKPerCategory } = params;
  
  // Single query with higher topK
  const totalTopK = categories.length * topKPerCategory * 2; // 2x buffer
  
  const allResults = await queryOptimized({
    indexName,
    queryText,
    topK: totalTopK,
  });
  
  // Group by category client-side
  const grouped: Record<string, any[]> = {};
  
  for (const category of categories) {
    grouped[category] = allResults
      .filter(r => r.metadata.category === category)
      .slice(0, topKPerCategory);
  }
  
  return grouped;
}

/**
 * Upsert with the singleton Pinecone client
 */
export async function upsertOptimized(params: {
  indexName: string;
  id: string;
  text: string;
  metadata: Record<string, any>;
}): Promise<void> {
  const { EmbeddingService } = await import("./EmbeddingService");
  await EmbeddingService.upsert({
    indexName: "axle" as const,
    id: params.id,
    text: params.text,
    metadata: params.metadata as Record<string, string | number | boolean>,
  });
}

export default { queryOptimized, batchQueryOptimized, upsertOptimized };
