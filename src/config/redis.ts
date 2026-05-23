import IORedis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

export const redis = env.redisUrl
  ? new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  : new IORedis({
      host: env.redisHost,
      port: env.redisPort,
      password: env.redisPassword,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

redis.on("error", (error) => {
  logger.error({ error }, "Redis connection error");
});
