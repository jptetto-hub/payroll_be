"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorkerHeartbeat = startWorkerHeartbeat;
const prisma_1 = require("../../config/prisma");
const logger_1 = require("../../config/logger");
function startWorkerHeartbeat(name) {
    if (process.env.WORKER_HEARTBEAT_ENABLED === "false") {
        logger_1.logger.info({ worker: name }, "Worker heartbeat disabled");
        return undefined;
    }
    let consecutiveFailures = 0;
    const writeHeartbeat = async () => {
        try {
            await prisma_1.prisma.workerHeartbeat.upsert({
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
        }
        catch (error) {
            consecutiveFailures += 1;
            const message = error instanceof Error ? error.message : "";
            const isConnectionTimeout = message.includes("timeout exceeded") ||
                message.includes("Connection terminated due to connection timeout");
            const log = isConnectionTimeout && consecutiveFailures < 3
                ? logger_1.logger.warn.bind(logger_1.logger)
                : logger_1.logger.error.bind(logger_1.logger);
            log({ error, worker: name, consecutiveFailures }, "Worker heartbeat failed");
        }
    };
    writeHeartbeat();
    return setInterval(writeHeartbeat, Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS || 30_000));
}
//# sourceMappingURL=worker-heartbeat.service.js.map