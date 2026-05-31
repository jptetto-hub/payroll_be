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

const getAdapterConnectionString = (connectionString: string | undefined) => {
  if (!connectionString) {
    return connectionString;
  }

  const url = new URL(connectionString);

  // Keep TLS enabled, but use libpq's sslmode=require behavior for poolers
  // whose certificate chain cannot be verified by the local Node trust store.
  if (
    url.searchParams.get("sslmode") === "require" &&
    !url.searchParams.has("uselibpqcompat")
  ) {
    url.searchParams.set("uselibpqcompat", "true");
  }

  return url.toString();
};

const createPoolConfig = (connectionString: string | undefined, max: number) => ({
  connectionString: getAdapterConnectionString(connectionString),
  max,
  connectionTimeoutMillis: Number(
    process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS || 10_000,
  ),
  idleTimeoutMillis: Number(
    process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || 30_000,
  ),
});

const adapter = new PrismaPg(createPoolConfig(
  env.databaseUrl,
  Number(process.env.DATABASE_POOL_MAX || 1),
));

const readAdapter = new PrismaPg(createPoolConfig(
  env.readDatabaseUrl,
  Number(process.env.READ_DATABASE_POOL_MAX || 1),
));

const transactionOptions = {
  maxWait: Number(process.env.PRISMA_TRANSACTION_MAX_WAIT_MS || 30_000),
  timeout: Number(process.env.PRISMA_TRANSACTION_TIMEOUT_MS || 60_000),
};

export const prisma = new PrismaClient({
  adapter,
  transactionOptions,
  log: prismaLogConfig as any,
});

export const readPrisma = new PrismaClient({
  adapter: readAdapter,
  transactionOptions,
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
