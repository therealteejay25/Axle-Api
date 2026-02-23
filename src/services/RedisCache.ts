import { redis } from "../lib/redis";
import { logger } from "./logger";

// ============================================
// REDIS CACHE SERVICE
// ============================================
// Generic caching layer for performance optimization
// ============================================

export class RedisCache {
  /**
   * Get a value from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`[RedisCache] Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   */
  static async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error(`[RedisCache] Error setting key ${key}:`, error);
    }
  }

  /**
   * Invalidate a specific key
   */
  static async invalidate(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error(`[RedisCache] Error invalidating key ${key}:`, error);
    }
  }

  /**
   * Invalidate all keys matching a pattern
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error(`[RedisCache] Error invalidating pattern ${pattern}:`, error);
    }
  }

  /**
   * Get or compute a value (cache-aside pattern)
   */
  static async getOrCompute<T>(
    key: string,
    ttlSeconds: number,
    compute: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await compute();

    // Store in cache (fire-and-forget)
    this.set(key, value, ttlSeconds).catch((err) => {
      logger.error(`[RedisCache] Failed to cache key ${key}:`, err);
    });

    return value;
  }
}

export default RedisCache;
