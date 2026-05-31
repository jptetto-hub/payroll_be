import {
  Role,
  SchedulerRunItemStatus,
  SchedulerRunStatus,
} from "@prisma/client";
import { SchedulerRepository } from "../modules/scheduler/scheduler.repository";
import { PayrollService } from "../modules/payroll/payroll.service";

type SinglePayrollGenerationJob = {
  runId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  currentUserRole: Role;
  userId: string;
  ipAddress?: string;
};

export class SinglePayrollGenerationProcessor {
  static async process(data: SinglePayrollGenerationJob) {
    await SchedulerRepository.updateRun(data.runId, {
      status: SchedulerRunStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      const result = await PayrollService.generate(
        {
          employeeId: data.employeeId,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
        },
        data.currentUserRole,
        {
          userId: data.userId,
          ipAddress: data.ipAddress,
        },
      );

      await SchedulerRepository.createRunItem({
        runId: data.runId,
        employeeId: data.employeeId,
        employeeCode: result.payroll.employee.employeeCode,
        periodStart: result.payroll.periodStart,
        periodEnd: result.payroll.periodEnd,
        status: SchedulerRunItemStatus.SUCCESS,
        payrollId: result.payroll.id,
      });

      await SchedulerRepository.updateRun(data.runId, {
        status: SchedulerRunStatus.COMPLETED,
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Payroll generation failed";

      await SchedulerRepository.createRunItem({
        runId: data.runId,
        employeeId: data.employeeId,
        periodStart: new Date(`${data.periodStart}T00:00:00.000Z`),
        periodEnd: new Date(`${data.periodEnd}T00:00:00.000Z`),
        status: SchedulerRunItemStatus.FAILED,
        errorMessage,
      });

      await SchedulerRepository.updateRun(data.runId, {
        status: SchedulerRunStatus.FAILED,
        completedAt: new Date(),
        processedEmployees: 1,
        failedCount: 1,
        errorMessage,
      });

      throw error;
    }
  }
}
