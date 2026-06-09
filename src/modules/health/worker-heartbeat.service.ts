import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";

export function startWorkerHeartbeat(name: string) {
  if (process.env.WORKER_HEARTBEAT_ENABLED === "false") {
    logger.info({ worker: name }, "Worker heartbeat disabled");
    return undefined;
  }

  let consecutiveFailures = 0;

  const writeHeartbeat = async () => {
    try {
      await prisma.workerHeartbeat.upsert({
        where: {
          name,
        },
        update: {
          lastSeenAt: new Date(),
          metadata: {
            pid: process.pid,
            uptimeSeconds: process.uptime(),
          },
        },
        create: {
          name,
          lastSeenAt: new Date(),
          metadata: {
            pid: process.pid,
            uptimeSeconds: process.uptime(),
          },
        },
      });
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      const message = error instanceof Error ? error.message : "";
      const isConnectionTimeout =
        message.includes("timeout exceeded") ||
        message.includes("Connection terminated due to connection timeout");
      const log = isConnectionTimeout && consecutiveFailures < 3
        ? logger.warn.bind(logger)
        : logger.error.bind(logger);

      log(
        { error, worker: name, consecutiveFailures },
        "Worker heartbeat failed",
      );
    }
  };

  writeHeartbeat();

  return setInterval(
    writeHeartbeat,
    Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS || 30_000),
  );
}
