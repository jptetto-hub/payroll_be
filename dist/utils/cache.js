"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const isCacheEnabled = () => process.env.ENABLE_REDIS_CACHE === "true";
const CACHE_TIMEOUT_MS = Number(process.env.REDIS_CACHE_TIMEOUT_MS || 100);
const withCacheTimeout = (promise) => new Promise((resolve, reject) => {
    const timeoutRef = setTimeout(() => reject(new Error("Redis cache operation timed out")), CACHE_TIMEOUT_MS);
    promise.then((value) => {
        clearTimeout(timeoutRef);
        resolve(value);
    }, (error) => {
        clearTimeout(timeoutRef);
        reject(error);
    });
});
class CacheService {
    static async get(key) {
        if (!isCacheEnabled()) {
            return null;
        }
        try {
            if (redis_1.redis.status !== "ready")
                return null;
            const cached = await withCacheTimeout(redis_1.redis.get(key));
            if (!cached) {
                return null;
            }
            return JSON.parse(cached);
        }
        catch (error) {
            logger_1.logger.warn({ key, error }, "Redis cache get failed");
            return null;
        }
    }
    static async set(key, value, ttlSeconds = Number(process.env.CACHE_DEFAULT_TTL_SECONDS || 300)) {
        if (!isCacheEnabled()) {
            return;
        }
        try {
            if (redis_1.redis.status !== "ready")
                return;
            await withCacheTimeout(redis_1.redis.set(key, JSON.stringify(value), "EX", ttlSeconds));
        }
        catch (error) {
            logger_1.logger.warn({ key, error }, "Redis cache set failed");
        }
    }
    static async del(key) {
        if (!isCacheEnabled()) {
            return;
        }
        try {
            if (redis_1.redis.status !== "ready")
                return;
            await withCacheTimeout(redis_1.redis.del(key));
        }
        catch (error) {
            logger_1.logger.warn({ key, error }, "Redis cache delete failed");
        }
    }
    static async delByPattern(pattern) {
        if (!isCacheEnabled()) {
            return;
        }
        try {
            if (redis_1.redis.status !== "ready")
                return;
            let cursor = "0";
            do {
                const [nextCursor, keys] = await withCacheTimeout(redis_1.redis.scan(cursor, "MATCH", pattern, "COUNT", 100));
                cursor = nextCursor;
                if (keys.length > 0) {
                    await withCacheTimeout(redis_1.redis.del(...keys));
                }
            } while (cursor !== "0");
        }
        catch (error) {
            logger_1.logger.warn({ pattern, error }, "Redis cache pattern delete failed");
        }
    }
    static buildKey(...parts) {
        return parts
            .filter((part) => part !== undefined && part !== null && part !== "")
            .join(":");
    }
}
exports.CacheService = CacheService;
//# sourceMappingURL=cache.js.map