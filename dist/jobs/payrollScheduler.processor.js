"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollSchedulerProcessor = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
const dashboard_summary_service_1 = require("../modules/dashboard/dashboard-summary.service");
const scheduler_service_1 = require("../modules/scheduler/scheduler.service");
class PayrollSchedulerProcessor {
    static async process(runId, triggeredBy, triggeredByType = "MANUAL", salaryTypes) {
        await prisma_1.prisma.schedulerRun.update({
            where: { id: runId },
            data: {
                status: client_1.SchedulerRunStatus.RUNNING,
                startedAt: new Date(),
            },
        });
        try {
            const result = await scheduler_service_1.SchedulerService.runPayrollScheduler(triggeredByType, {
                runId,
                triggeredByUserId: triggeredBy,
                mode: "BACKGROUND",
                salaryTypes,
            });
            try {
                await dashboard_summary_service_1.DashboardSummaryService.refreshGlobalSummary({});
            }
            catch (summaryError) {
                console.error("Dashboard summary refresh failed after scheduler run", {
                    runId,
                    error: summaryError instanceof Error
                        ? summaryError.message
                        : "Unknown error",
                });
            }
            await prisma_1.prisma.schedulerRun.update({
                where: { id: runId },
                data: {
                    status: result.failureCount > 0
                        ? client_1.SchedulerRunStatus.PARTIAL_SUCCESS
                        : client_1.SchedulerRunStatus.COMPLETED,
                    completedAt: new Date(),
                    processedEmployees: result.processedEmployees,
                    successCount: result.successCount,
                    skippedCount: result.skippedCount,
                    failedCount: result.failureCount,
                    metadata: result,
                },
            });
            return result;
        }
        catch (error) {
            await prisma_1.prisma.schedulerRun.update({
                where: { id: runId },
                data: {
                    status: client_1.SchedulerRunStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: error instanceof Error ? error.message : "Scheduler failed",
                },
            });
            throw error;
        }
    }
}
exports.PayrollSchedulerProcessor = PayrollSchedulerProcessor;
//# sourceMappingURL=payrollScheduler.processor.js.map