import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { redis } from "../../config/redis";
import { payrollSchedulerQueue } from "../../jobs/payrollScheduler.queue";
import { payslipQueue } from "../../jobs/payslip.queue";

export class HealthController {
  static async system(_req: Request, res: Response) {
    const startedAt = Date.now();
    const dbResult = await prisma.$queryRaw`SELECT 1`;
    const redisResult = await redis.ping();

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

  static async queues(_req: Request, res: Response) {
    const [schedulerCounts, payslipCounts] = await Promise.all([
      payrollSchedulerQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
      ),
      payslipQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
      ),
    ]);

    return res.json({
      success: true,
      data: {
        payrollScheduler: schedulerCounts,
        payslipGeneration: payslipCounts,
      },
    });
  }

  static async workers(_req: Request, res: Response) {
    const workers = await prisma.workerHeartbeat.findMany({
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
