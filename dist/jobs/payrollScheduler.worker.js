"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payrollSchedulerWorker = void 0;
const bullmq_1 = require("bullmq");
const payrollScheduler_queue_1 = require("./payrollScheduler.queue");
const payrollScheduler_processor_1 = require("./payrollScheduler.processor");
const singlePayrollGeneration_processor_1 = require("./singlePayrollGeneration.processor");
const logger_1 = require("../config/logger");
const sentry_1 = require("../config/sentry");
exports.payrollSchedulerWorker = new bullmq_1.Worker("payroll-scheduler", async (job) => {
    if (job.name === "manual-payroll-run") {
        return payrollScheduler_processor_1.PayrollSchedulerProcessor.process(job.data.runId, job.data.triggeredBy, job.data.triggeredByType, job.data.salaryTypes);
    }
    if (job.name === "single-payroll-generation") {
        return singlePayrollGeneration_processor_1.SinglePayrollGenerationProcessor.process(job.data);
    }
    throw new Error(`Unknown payroll scheduler job: ${job.name}`);
}, {
    connection: payrollScheduler_queue_1.redisConnection,
    concurrency: Number(process.env.PAYROLL_WORKER_CONCURRENCY || 1),
    limiter: {
        max: Number(process.env.PAYROLL_WORKER_RATE_LIMIT_MAX || 1),
        duration: Number(process.env.PAYROLL_WORKER_RATE_LIMIT_DURATION || 1000),
    },
});
exports.payrollSchedulerWorker.on("completed", (job) => {
    logger_1.logger.info({
        jobId: job.id,
        jobName: job.name,
        runId: job.data?.runId,
    }, "Payroll scheduler job completed");
});
exports.payrollSchedulerWorker.on("failed", (job, error) => {
    logger_1.logger.error({
        jobId: job?.id,
        jobName: job?.name,
        runId: job?.data?.runId,
        error: {
            message: error.message,
            stack: error.stack,
        },
    }, "Payroll scheduler job failed");
    if (process.env.SENTRY_DSN) {
        sentry_1.Sentry.captureException(error, {
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
//# sourceMappingURL=payrollScheduler.worker.js.map