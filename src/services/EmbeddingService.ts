import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "../config/env";
import { logger } from "./logger";

// ============================================
// EMBEDDING SERVICE
// ============================================
// Google text-embedding-004 + Pinecone vector storage
// ============================================

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });

export class EmbeddingService {
  /**
   * Generate embedding using Google text-embedding-004
   */
  static async embed(text: string): Promise<number[]> {
    try {
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      logger.error("Failed to generate embedding", { error });
      throw error;
    }
  }

  /**
   * Upsert vector to Pinecone index
   */
  static async upsert(params: {
    indexName: "axle-memory" | "axle-rag";
    id: string;
    text: string;
    metadata: Record<string, string | number | boolean>;
  }): Promise<void> {
    try {
      const { indexName, id, text, metadata } = params;

      // Get the appropriate index name from env
      const actualIndexName =
        indexName === "axle-memory"
          ? env.PINECONE_MEMORY_INDEX
          : env.PINECONE_RAG_INDEX;

      // Generate embedding
      const embedding = await this.embed(text);

      // Get index
      const index = pinecone.index(actualIndexName);

      // Upsert vector with metadata (including the original text)
      await index.upsert([
        {
          id,
          values: embedding,
          metadata: {
            ...metadata,
            text, // Store original text in metadata for retrieval
          },
        },
      ]);

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
    indexName: "axle-memory" | "axle-rag";
    queryText: string;
    filter: object;
    topK: number;
  }): Promise<Array<{ text: string; metadata: any; score: number }>> {
    try {
      const { indexName, queryText, filter, topK } = params;

      // Get the appropriate index name from env
      const actualIndexName =
        indexName === "axle-memory"
          ? env.PINECONE_MEMORY_INDEX
          : env.PINECONE_RAG_INDEX;

      // Generate query embedding
      const queryEmbedding = await this.embed(queryText);

      // Get index
      const index = pinecone.index(actualIndexName);

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
