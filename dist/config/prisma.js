"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPrisma = exports.prisma = void 0;
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma/client");
const env_1 = require("./env");
const logger_1 = require("./logger");
const prismaLogConfig = process.env.ENABLE_PRISMA_QUERY_LOG === "true"
    ? [
        { emit: "event", level: "query" },
        { emit: "stdout", level: "error" },
        { emit: "stdout", level: "warn" },
    ]
    : [
        { emit: "stdout", level: "error" },
        { emit: "stdout", level: "warn" },
    ];
const getAdapterConnectionString = (connectionString) => {
    if (!connectionString) {
        return connectionString;
    }
    const url = new URL(connectionString);
    // Keep TLS enabled, but use libpq's sslmode=require behavior for poolers
    // whose certificate chain cannot be verified by the local Node trust store.
    if (url.searchParams.get("sslmode") === "require" &&
        !url.searchParams.has("uselibpqcompat")) {
        url.searchParams.set("uselibpqcompat", "true");
    }
    return url.toString();
};
const createPoolConfig = (connectionString, max) => ({
    connectionString: getAdapterConnectionString(connectionString),
    max,
    connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS || 10_000),
    idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || 30_000),
});
const adapter = new adapter_pg_1.PrismaPg(createPoolConfig(env_1.env.databaseUrl, Number(process.env.DATABASE_POOL_MAX || 1)));
const readAdapter = new adapter_pg_1.PrismaPg(createPoolConfig(env_1.env.readDatabaseUrl, Number(process.env.READ_DATABASE_POOL_MAX || 1)));
const transactionOptions = {
    maxWait: Number(process.env.PRISMA_TRANSACTION_MAX_WAIT_MS || 30_000),
    timeout: Number(process.env.PRISMA_TRANSACTION_TIMEOUT_MS || 60_000),
};
exports.prisma = new client_1.PrismaClient({
    adapter,
    transactionOptions,
    log: prismaLogConfig,
});
exports.readPrisma = new client_1.PrismaClient({
    adapter: readAdapter,
    transactionOptions,
    log: prismaLogConfig,
});
if (process.env.ENABLE_PRISMA_QUERY_LOG === "true") {
    const attachSlowQueryLogger = (client, clientName) => {
        client.$on("query", (event) => {
            const slowQueryMs = Number(process.env.SLOW_QUERY_MS || 500);
            if (event.duration >= slowQueryMs) {
                logger_1.logger.warn({
                    client: clientName,
                    durationMs: event.duration,
                    query: event.query,
                    params: event.params,
                    target: event.target,
                }, "Slow Prisma query");
            }
        });
    };
    attachSlowQueryLogger(exports.prisma, "primary");
    attachSlowQueryLogger(exports.readPrisma, "read");
}
//# sourceMappingURL=prisma.js.map