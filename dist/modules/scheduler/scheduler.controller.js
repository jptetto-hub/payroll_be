"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerController = void 0;
const client_1 = require("@prisma/client");
const scheduler_service_1 = require("./scheduler.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
const scheduler_repository_1 = require("./scheduler.repository");
const payrollScheduler_queue_1 = require("../../jobs/payrollScheduler.queue");
class SchedulerController {
    static async manualAdvanceReminders(req, res, next) {
        try {
            const result = await scheduler_service_1.SchedulerService.getManualAdvanceDeductionReminders();
            res.json({
                success: true,
                message: result.message,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async runPayroll(req, res, next) {
        try {
            await scheduler_service_1.SchedulerService.recoverStaleRuns();
            const existingManualRun = await scheduler_repository_1.SchedulerRepository.findActiveRunByName("MANUAL_PAYROLL_SCHEDULER");
            const existingCronRun = await scheduler_repository_1.SchedulerRepository.findActiveRunByName("CRON_PAYROLL_SCHEDULER");
            if (existingManualRun || existingCronRun) {
                return res.status(409).json({
                    success: false,
                    message: "A payroll scheduler run is already in progress",
                    data: existingManualRun || existingCronRun,
                });
            }
            const pendingPayrollCount = await scheduler_service_1.SchedulerService.countPendingCurrentCyclePayrolls();
            if (pendingPayrollCount === 0) {
                return res.status(409).json({
                    success: false,
                    message: "All current payroll cycles are already handled. There is no payroll to generate.",
                });
            }
            const run = await scheduler_repository_1.SchedulerRepository.createRun({
                name: "MANUAL_PAYROLL_SCHEDULER",
                status: client_1.SchedulerRunStatus.PENDING,
                metadata: {
                    triggeredBy: req.user.id,
                    triggeredAt: new Date().toISOString(),
                    mode: "BACKGROUND",
                },
            });
            try {
                await payrollScheduler_queue_1.payrollSchedulerQueue.add("manual-payroll-run", {
                    runId: run.id,
                    triggeredBy: req.user.id,
                    triggeredByType: "MANUAL",
                }, {
                    attempts: 1,
                    removeOnComplete: false,
                    removeOnFail: false,
                });
            }
            catch (error) {
                await scheduler_repository_1.SchedulerRepository.updateRun(run.id, {
                    status: client_1.SchedulerRunStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: error instanceof Error ? error.message : "Failed to enqueue job",
                });
                throw error;
            }
            res.status(202).json({
                success: true,
                message: "Payroll scheduler started",
                jobId: run.id,
                status: run.status,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async runStatus(req, res, next) {
        try {
            const id = req.params.id;
            if (!id || Array.isArray(id)) {
                res.status(400).json({
                    success: false,
                    message: "Scheduler run id is required",
                });
                return;
            }
            const run = await scheduler_service_1.SchedulerService.getRunStatus(id);
            if (!run) {
                res.status(404).json({
                    success: false,
                    message: "Scheduler run not found",
                });
                return;
            }
            res.json({
                success: true,
                data: run,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async runs(req, res, next) {
        try {
            const result = await scheduler_service_1.SchedulerService.listRuns(req.query);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "PAYROLL_GENERATE",
                module: "SCHEDULER",
                newData: {
                    triggeredBy: "MANUAL",
                    result,
                },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Scheduler runs fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async runItems(req, res, next) {
        try {
            const id = req.params.id;
            if (!id || Array.isArray(id)) {
                res.status(400).json({
                    success: false,
                    message: "Scheduler run id is required",
                });
                return;
            }
            const result = await scheduler_service_1.SchedulerService.listRunItems(id, req.query);
            if (!result) {
                res.status(404).json({
                    success: false,
                    message: "Scheduler run not found",
                });
                return;
            }
            res.json({
                success: true,
                message: "Scheduler run items fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SchedulerController = SchedulerController;
//# sourceMappingURL=scheduler.controller.js.map