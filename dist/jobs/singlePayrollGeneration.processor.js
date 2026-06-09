"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinglePayrollGenerationProcessor = void 0;
const client_1 = require("@prisma/client");
const scheduler_repository_1 = require("../modules/scheduler/scheduler.repository");
const payroll_service_1 = require("../modules/payroll/payroll.service");
class SinglePayrollGenerationProcessor {
    static async process(data) {
        await scheduler_repository_1.SchedulerRepository.updateRun(data.runId, {
            status: client_1.SchedulerRunStatus.RUNNING,
            startedAt: new Date(),
        });
        try {
            const result = await payroll_service_1.PayrollService.generate({
                employeeId: data.employeeId,
                periodStart: data.periodStart,
                periodEnd: data.periodEnd,
            }, data.currentUserRole, {
                userId: data.userId,
                ipAddress: data.ipAddress,
            });
            await scheduler_repository_1.SchedulerRepository.createRunItem({
                runId: data.runId,
                employeeId: data.employeeId,
                employeeCode: result.payroll.employee.employeeCode,
                periodStart: result.payroll.periodStart,
                periodEnd: result.payroll.periodEnd,
                status: client_1.SchedulerRunItemStatus.SUCCESS,
                payrollId: result.payroll.id,
            });
            await scheduler_repository_1.SchedulerRepository.updateRun(data.runId, {
                status: client_1.SchedulerRunStatus.COMPLETED,
                completedAt: new Date(),
                processedEmployees: 1,
                successCount: 1,
                metadata: {
                    mode: "BACKGROUND",
                    payrollId: result.payroll.id,
                    employeeId: data.employeeId,
                    periodStart: data.periodStart,
                    periodEnd: data.periodEnd,
                },
            });
            return {
                payrollId: result.payroll.id,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Payroll generation failed";
            await scheduler_repository_1.SchedulerRepository.createRunItem({
                runId: data.runId,
                employeeId: data.employeeId,
                periodStart: new Date(`${data.periodStart}T00:00:00.000Z`),
                periodEnd: new Date(`${data.periodEnd}T00:00:00.000Z`),
                status: client_1.SchedulerRunItemStatus.FAILED,
                errorMessage,
            });
            await scheduler_repository_1.SchedulerRepository.updateRun(data.runId, {
                status: client_1.SchedulerRunStatus.FAILED,
                completedAt: new Date(),
                processedEmployees: 1,
                failedCount: 1,
                errorMessage,
            });
            throw error;
        }
    }
}
exports.SinglePayrollGenerationProcessor = SinglePayrollGenerationProcessor;
//# sourceMappingURL=singlePayrollGeneration.processor.js.map