"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payslipWorker = void 0;
const client_1 = require("@prisma/client");
const bullmq_1 = require("bullmq");
const prisma_1 = require("../config/prisma");
const payslip_service_1 = require("../modules/payslips/payslip.service");
const payrollScheduler_queue_1 = require("./payrollScheduler.queue");
const logger_1 = require("../config/logger");
const sentry_1 = require("../config/sentry");
exports.payslipWorker = new bullmq_1.Worker("payslip-generation", async (job) => {
    const { payrollId } = job.data;
    try {
        const payslip = await payslip_service_1.PayslipService.createFromPayroll(payrollId);
        return {
            payrollId,
            payslipId: payslip.id,
        };
    }
    catch (error) {
        await prisma_1.prisma.payslip.updateMany({
            where: {
                payrollId,
            },
            data: {
                status: client_1.PayslipStatus.FAILED,
                errorMessage: error instanceof Error
                    ? error.message
                    : "Payslip generation failed",
            },
        });
        throw error;
    }
}, {
    connection: payrollScheduler_queue_1.redisConnection,
    concurrency: Number(process.env.PAYSLIP_WORKER_CONCURRENCY || 1),
    limiter: {
        max: Number(process.env.PAYSLIP_WORKER_RATE_LIMIT_MAX || 2),
        duration: Number(process.env.PAYSLIP_WORKER_RATE_LIMIT_DURATION || 1000),
    },
});
exports.payslipWorker.on("completed", (job) => {
    logger_1.logger.info({
        jobId: job.id,
        jobName: job.name,
        payrollId: job.data?.payrollId,
    }, "Payslip job completed");
});
exports.payslipWorker.on("failed", (job, error) => {
    logger_1.logger.error({
        jobId: job?.id,
        jobName: job?.name,
        payrollId: job?.data?.payrollId,
        error: {
            message: error.message,
            stack: error.stack,
        },
    }, "Payslip job failed");
    if (process.env.SENTRY_DSN) {
        sentry_1.Sentry.captureException(error, {
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
//# sourceMappingURL=payslip.worker.js.map