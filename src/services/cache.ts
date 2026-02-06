import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

class CacheService {
    private redis: Redis | null = null;
    private memoryCache: Map<string, { value: any; expiry: number }> = new Map();

    constructor() {
        if (env.REDIS_URL) {
            this.redis = new Redis(env.REDIS_URL);

            this.redis.on("error", (err) => {
                logger.error("[CacheService] Redis error:", err);
            });

            this.redis.on("connect", () => {
                logger.info("[CacheService] Connected to Redis");
            });
        } else {
            logger.warn("[CacheService] REDIS_URL not set, using in-memory cache");
        }
    }

    /**
     * Get value from cache
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            if (this.redis) {
                const data = await this.redis.get(key);
                return data ? JSON.parse(data) : null;
            } else {
                const item = this.memoryCache.get(key);
                if (!item) return null;
                if (Date.now() > item.expiry) {
                    this.memoryCache.delete(key);
                    return null;
                }
                return item.value;
            }
        } catch (err) {
            logger.error(`[CacheService] Error getting key ${key}:`, err);
            return null;
        }
    }

    /**
     * Set value in cache
     * @param ttlSeconds Time to live in seconds (default: 300s / 5m)
     */
    async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
        try {
            if (this.redis) {
                await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
            } else {
                this.memoryCache.set(key, {
                    value,
                    expiry: Date.now() + ttlSeconds * 1000,
                });
            }
        } catch (err) {
            logger.error(`[CacheService] Error setting key ${key}:`, err);
        }
    }

    /**
     * Delete value from cache
     */
    async del(key: string): Promise<void> {
        try {
            if (this.redis) {
                await this.redis.del(key);
            } else {
                this.memoryCache.delete(key);
            }
        } catch (err) {
            logger.error(`[CacheService] Error deleting key ${key}:`, err);
        }
    }

    /**
     * Wrap a function with caching
     */
    async wrap<T>(
        key: string,
        fn: () => Promise<T>,
        ttlSeconds: number = 300
    ): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached) {
            return cached;
        }

        const result = await fn();
        await this.set(key, result, ttlSeconds);
        return result;
    }
}

export const cacheService = new CacheService();
