import { PayslipStatus } from "@prisma/client";
import { Worker } from "bullmq";
import { prisma } from "../config/prisma";
import { PayslipService } from "../modules/payslips/payslip.service";
import { redisConnection } from "./payrollScheduler.queue";
import { logger } from "../config/logger";
import { Sentry } from "../config/sentry";

export const payslipWorker = new Worker(
  "payslip-generation",
  async (job) => {
    const { payrollId } = job.data;

    try {
      const payslip = await PayslipService.createFromPayroll(payrollId);

      return {
        payrollId,
        payslipId: payslip.id,
      };
    } catch (error) {
      await prisma.payslip.updateMany({
        where: {
          payrollId,
        },
        data: {
          status: PayslipStatus.FAILED,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Payslip generation failed",
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.PAYSLIP_WORKER_CONCURRENCY || 1),
    limiter: {
      max: Number(process.env.PAYSLIP_WORKER_RATE_LIMIT_MAX || 2),
      duration: Number(process.env.PAYSLIP_WORKER_RATE_LIMIT_DURATION || 1000),
    },
  },
);

payslipWorker.on("completed", (job) => {
  logger.info(
    {
      jobId: job.id,
      jobName: job.name,
      payrollId: job.data?.payrollId,
    },
    "Payslip job completed",
  );
});

payslipWorker.on("failed", (job, error) => {
  logger.error(
    {
      jobId: job?.id,
      jobName: job?.name,
      payrollId: job?.data?.payrollId,
      error: {
        message: error.message,
        stack: error.stack,
      },
    },
    "Payslip job failed",
  );

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: {
        worker: "payslip-generation",
        jobId: String(job?.id),
      },
      extra: {
        jobData: job?.data,
      },
    });
  }
});
