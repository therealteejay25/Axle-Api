import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "../config/env";
import { logger } from "./logger";

// ============================================
// EMBEDDING SERVICE
// ============================================
// Using Pinecone Inference API for embeddings
// ============================================

const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });

export class EmbeddingService {
  /**
   * Generate embedding using Pinecone Inference API via REST
   * Uses multilingual-e5-large model (384 dimensions)
   */
  static async embed(text: string): Promise<number[]> {
    try {
      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Text content is required for embedding generation');
      }

      const cleanText = text.trim();

      // Use Pinecone Inference API via REST
      const model = "multilingual-e5-large";
      
      const response = await fetch("https://api.pinecone.io/v1/embed", {
        method: "POST",
        headers: {
          "Api-Key": env.PINECONE_API_KEY,
          "Content-Type": "application/json",
          "X-Pinecone-API-Version": "2024-10",
        },
        body: JSON.stringify({
          model,
          parameters: {
            input_type: "passage",
          },
          inputs: [
            {
              text: cleanText,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinecone API error: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      if (!result || !result.data || result.data.length === 0) {
        throw new Error("No embeddings returned from Pinecone");
      }

      const embedding = result.data[0].values;

      logger.info("Pinecone embedding generated", { 
        model,
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
