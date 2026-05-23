import { redis } from "../config/redis";
import { logger } from "../config/logger";

const isCacheEnabled = () => process.env.ENABLE_REDIS_CACHE === "true";

export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    if (!isCacheEnabled()) {
      return null;
    }

    try {
      const cached = await redis.get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      logger.warn({ key, error }, "Redis cache get failed");
      return null;
    }
  }

  static async set<T>(
    key: string,
    value: T,
    ttlSeconds = Number(process.env.CACHE_DEFAULT_TTL_SECONDS || 300),
  ) {
    if (!isCacheEnabled()) {
      return;
    }

    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      logger.warn({ key, error }, "Redis cache set failed");
    }
  }

  static async del(key: string) {
    if (!isCacheEnabled()) {
      return;
    }

    try {
      await redis.del(key);
    } catch (error) {
      logger.warn({ key, error }, "Redis cache delete failed");
    }
  }

  static async delByPattern(pattern: string) {
    if (!isCacheEnabled()) {
      return;
    }

    try {
      let cursor = "0";

      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (error) {
      logger.warn({ pattern, error }, "Redis cache pattern delete failed");
    }
  }

  static buildKey(...parts: Array<string | number | undefined | null>) {
    return parts
      .filter((part) => part !== undefined && part !== null && part !== "")
      .join(":");
  }
}
