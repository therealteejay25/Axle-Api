import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "../config/env";
import { logger } from "./logger";

// ============================================
// EMBEDDING SERVICE
// ============================================
// Simple local embeddings + Pinecone for vector storage
// Using a basic TF-IDF style approach for now
// ============================================

const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });

export class EmbeddingService {
  /**
   * Generate embedding using a simple local approach
   * This creates a 3072-dimensional vector from text
   */
  static async embed(text: string): Promise<number[]> {
    try {
      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Text content is required for embedding generation');
      }

      // Simple hash-based embedding generation
      // This creates a deterministic 3072-dimensional vector
      const dimension = 3072;
      const embedding = new Array(dimension).fill(0);
      
      const cleanText = text.trim().toLowerCase();
      
      // Use character codes and positions to generate features
      for (let i = 0; i < cleanText.length; i++) {
        const charCode = cleanText.charCodeAt(i);
        const idx = (charCode * (i + 1)) % dimension;
        embedding[idx] += Math.sin(charCode * 0.1) * Math.cos(i * 0.1);
      }
      
      // Normalize the vector
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        for (let i = 0; i < dimension; i++) {
          embedding[i] = embedding[i] / magnitude;
        }
      }

      logger.info("Local embedding generated", { 
        dimension: embedding.length,
        textLength: cleanText.length
      });

      return embedding;
    } catch (error: any) {
      logger.error("Failed to generate embedding", { 
        error: error.message || error, 
        textLength: text?.length,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Upsert vector to Pinecone index
   */
  static async upsert(params: {
    indexName: "axle";
    id: string;
    text: string;
    metadata: Record<string, string | number | boolean>;
  }): Promise<void> {
    try {
      const { indexName, id, text, metadata } = params;

      // Verify env variable
      console.log('PINECONE_MEMORY_INDEX:', env.PINECONE_MEMORY_INDEX);

      // Use axle index
      const actualIndexName = env.PINECONE_MEMORY_INDEX;

      // Generate embedding
      const embedding = await this.embed(text);

      // Get index with explicit __default__ namespace
      const index = pinecone.index(actualIndexName).namespace('__default__');

      // Prepare the record with proper typing
      const records = [
        {
          id: String(id),
          values: embedding,
          metadata: {
            agentId: String(metadata.agentId),
            key: String(metadata.key),
            category: String(metadata.category),
            importance: String(metadata.importance),
            timestamp: Number(metadata.timestamp),
            text: String(text),
          },
        },
      ];

      logger.info("Upserting to Pinecone", {
        indexName: actualIndexName,
        recordCount: records.length,
        id: records[0].id,
        embeddingLength: records[0].values.length,
      });

      // Upsert to __default__ namespace - SDK v7 expects {records: [...]}
      await index.upsert({ records });

      logger.info("Vector upserted to Pinecone", {
        indexName: actualIndexName,
        id,
        metadataKeys: Object.keys(metadata),
      });
    } catch (error) {
      logger.error("Failed to upsert to Pinecone", { error, params });
      throw error;
    }
  }

  /**
   * Query Pinecone index for similar vectors
   */
  static async query(params: {
    indexName: "axle";
    queryText: string;
    filter: object;
    topK: number;
  }): Promise<Array<{ text: string; metadata: any; score: number }>> {
    try {
      const { indexName, queryText, filter, topK } = params;

      // Use axle index
      const actualIndexName = env.PINECONE_MEMORY_INDEX;

      // Generate query embedding
      const queryEmbedding = await this.embed(queryText);

      // Get index with explicit __default__ namespace
      const index = pinecone.index(actualIndexName).namespace('__default__');

      // Query vectors
      const queryResponse = await index.query({
        vector: queryEmbedding,
        filter,
        topK,
        includeMetadata: true,
      });

      // Extract results
      const results = (queryResponse.matches || []).map((match) => ({
        text: (match.metadata?.text as string) || "",
        metadata: match.metadata || {},
        score: match.score || 0,
      }));

      logger.info("Pinecone query completed", {
        indexName: actualIndexName,
        resultsCount: results.length,
        topScore: results[0]?.score || 0,
      });

      return results;
    } catch (error) {
      logger.error("Failed to query Pinecone", { error, params });
      throw error;
    }
  }
}
