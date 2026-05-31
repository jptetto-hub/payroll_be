const { exec } = require("child_process");
const dotenv = require("dotenv");
const IORedis = require("ioredis");

dotenv.config();

const statusKey = "maintenance:system-restart-status";
const operationId = process.argv[2];
const command = process.env.APP_RESTART_COMMAND;
const redis = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 })
  : new IORedis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
    });

async function finish(status, message) {
  const raw = await redis.get(statusKey);
  const current = raw ? JSON.parse(raw) : {};

  if (current.id !== operationId) {
    return;
  }

  await redis.set(
    statusKey,
    JSON.stringify({
      ...current,
      status,
      completedAt: new Date().toISOString(),
      message,
    }),
  );
}

if (!operationId || !command) {
  process.exit(1);
}

exec(command, { cwd: process.cwd(), timeout: Number(process.env.APP_RESTART_TIMEOUT_MS || 120_000) }, async (error) => {
  try {
    await finish(
      error ? "FAILED" : "COMPLETED",
      error
        ? `Service restart failed: ${error.message}`
        : "API, worker, and frontend restart command completed.",
    );
  } finally {
    redis.disconnect();
  }
});
