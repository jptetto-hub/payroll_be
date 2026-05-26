import { SalaryType, SchedulerRunStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { DashboardSummaryService } from "../modules/dashboard/dashboard-summary.service";
import { SchedulerService } from "../modules/scheduler/scheduler.service";

export class PayrollSchedulerProcessor {
  static async process(
    runId: string,
    triggeredBy?: string,
    triggeredByType: "CRON" | "MANUAL" = "MANUAL",
    salaryTypes?: SalaryType[],
  ) {
    await prisma.schedulerRun.update({
      where: { id: runId },
      data: {
        status: SchedulerRunStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      const result = await SchedulerService.runPayrollScheduler(triggeredByType, {
        runId,
        triggeredByUserId: triggeredBy,
        mode: "BACKGROUND",
        salaryTypes,
      });

      try {
        await DashboardSummaryService.refreshGlobalSummary({});
      } catch (summaryError) {
        console.error("Dashboard summary refresh failed after scheduler run", {
          runId,
          error:
            summaryError instanceof Error
              ? summaryError.message
              : "Unknown error",
        });
      }

      await prisma.schedulerRun.update({
        where: { id: runId },
        data: {
          status:
            result.failureCount > 0
              ? SchedulerRunStatus.PARTIAL_SUCCESS
              : SchedulerRunStatus.COMPLETED,
          completedAt: new Date(),
          processedEmployees: result.processedEmployees,
          successCount: result.successCount,
          skippedCount: result.skippedCount,
          failedCount: result.failureCount,
          metadata: result,
        },
      });

      return result;
    } catch (error) {
      await prisma.schedulerRun.update({
        where: { id: runId },
        data: {
          status: SchedulerRunStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Scheduler failed",
        },
      });

      throw error;
    }
  }
}
