import { Worker } from "bullmq";
import { redisConnection } from "./payrollScheduler.queue";
import { PayrollSchedulerProcessor } from "./payrollScheduler.processor";
import { SinglePayrollGenerationProcessor } from "./singlePayrollGeneration.processor";
import { logger } from "../config/logger";
import { Sentry } from "../config/sentry";

export const payrollSchedulerWorker = new Worker(
  "payroll-scheduler",
  async (job) => {
    if (job.name === "manual-payroll-run") {
      return PayrollSchedulerProcessor.process(
        job.data.runId,
        job.data.triggeredBy,
        job.data.triggeredByType,
        job.data.salaryTypes,
      );
    }

    if (job.name === "single-payroll-generation") {
      return SinglePayrollGenerationProcessor.process(job.data);
    }

    throw new Error(`Unknown payroll scheduler job: ${job.name}`);
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.PAYROLL_WORKER_CONCURRENCY || 1),
    limiter: {
      max: Number(process.env.PAYROLL_WORKER_RATE_LIMIT_MAX || 1),
      duration: Number(process.env.PAYROLL_WORKER_RATE_LIMIT_DURATION || 1000),
    },
  },
);

payrollSchedulerWorker.on("completed", (job) => {
  logger.info(
    {
      jobId: job.id,
      jobName: job.name,
      runId: job.data?.runId,
    },
    "Payroll scheduler job completed",
  );
});

payrollSchedulerWorker.on("failed", (job, error) => {
  logger.error(
    {
      jobId: job?.id,
      jobName: job?.name,
      runId: job?.data?.runId,
      error: {
        message: error.message,
        stack: error.stack,
      },
    },
    "Payroll scheduler job failed",
  );

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: {
        worker: "payroll-scheduler",
        jobId: String(job?.id),
      },
      extra: {
        jobData: job?.data,
      },
    });
  }
});
