import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "./env";
import { logger } from "./logger";

const prismaLogConfig =
  process.env.ENABLE_PRISMA_QUERY_LOG === "true"
    ? [
        { emit: "event", level: "query" },
        { emit: "stdout", level: "error" },
        { emit: "stdout", level: "warn" },
      ]
    : [
        { emit: "stdout", level: "error" },
        { emit: "stdout", level: "warn" },
      ];

const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
});

const readAdapter = new PrismaPg({
  connectionString: env.readDatabaseUrl,
});

export const prisma = new PrismaClient({
  adapter,
  log: prismaLogConfig as any,
});

export const readPrisma = new PrismaClient({
  adapter: readAdapter,
  log: prismaLogConfig as any,
});

if (process.env.ENABLE_PRISMA_QUERY_LOG === "true") {
  const attachSlowQueryLogger = (client: PrismaClient, clientName: string) => {
    (client as any).$on("query", (event: Prisma.QueryEvent) => {
      const slowQueryMs = Number(process.env.SLOW_QUERY_MS || 500);

      if (event.duration >= slowQueryMs) {
        logger.warn({
          client: clientName,
          durationMs: event.duration,
          query: event.query,
          params: event.params,
          target: event.target,
        }, "Slow Prisma query");
      }
    });
  };

  attachSlowQueryLogger(prisma, "primary");
  attachSlowQueryLogger(readPrisma, "read");
}
