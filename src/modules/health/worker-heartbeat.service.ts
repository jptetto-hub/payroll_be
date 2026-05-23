import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";

export function startWorkerHeartbeat(name: string) {
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
    } catch (error) {
      logger.error({ error, worker: name }, "Worker heartbeat failed");
    }
  };

  writeHeartbeat();

  return setInterval(writeHeartbeat, 30_000);
}
