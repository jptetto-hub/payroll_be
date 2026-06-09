"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const prisma_1 = require("../../config/prisma");
const redis_1 = require("../../config/redis");
const payrollScheduler_queue_1 = require("../../jobs/payrollScheduler.queue");
const payslip_queue_1 = require("../../jobs/payslip.queue");
class HealthController {
    static async system(_req, res) {
        const startedAt = Date.now();
        const dbResult = await prisma_1.prisma.$queryRaw `SELECT 1`;
        const redisResult = await redis_1.redis.ping();
        return res.json({
            success: true,
            data: {
                api: "OK",
                database: dbResult ? "OK" : "FAILED",
                redis: redisResult === "PONG" ? "OK" : "FAILED",
                responseTimeMs: Date.now() - startedAt,
                uptimeSeconds: process.uptime(),
                timestamp: new Date().toISOString(),
            },
        });
    }
    static async queues(_req, res) {
        const [schedulerCounts, payslipCounts] = await Promise.all([
            payrollScheduler_queue_1.payrollSchedulerQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
            payslip_queue_1.payslipQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
        ]);
        return res.json({
            success: true,
            data: {
                payrollScheduler: schedulerCounts,
                payslipGeneration: payslipCounts,
            },
        });
    }
    static async workers(_req, res) {
        const workers = await prisma_1.prisma.workerHeartbeat.findMany({
            orderBy: {
                lastSeenAt: "desc",
            },
        });
        const now = Date.now();
        return res.json({
            success: true,
            data: workers.map((worker) => {
                const ageMs = now - worker.lastSeenAt.getTime();
                return {
                    ...worker,
                    ageSeconds: Math.round(ageMs / 1000),
                    status: ageMs <= 120_000 ? "OK" : "STALE",
                };
            }),
        });
    }
}
exports.HealthController = HealthController;
//# sourceMappingURL=health.controller.js.map